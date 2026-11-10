import {
  fromFiles,
  recordPath,
  texturePath,
  tombstonePath,
  type Files,
  type LibraryData,
} from "../storage/bundle";
import { readLibrary, writeSide } from "../storage/libraryIo";
import { applyToData, planMerge, type Side } from "../storage/merge";
import type { Repo } from "../storage/repo";
import type { SyncFolder } from "./folder";

export type SyncResult = { pulled: number; pushed: number };

const enc = new TextEncoder();
const json = (v: unknown) => enc.encode(JSON.stringify(v, null, 2));

/** Read the folder's records. Texture bytes are left empty here and fetched only if they are needed. */
async function readRemote(folder: SyncFolder): Promise<LibraryData> {
  const paths = await folder.list();
  const files: Files = new Map();
  for (const p of paths) {
    if (p.startsWith("textures/")) files.set(p, new Uint8Array());
    else {
      try {
        files.set(p, await folder.read(p));
      } catch {
        // a file that vanished or is half-synced by the cloud app: skip it this round
      }
    }
  }
  // a folder without a manifest is fine for sync; only validate record files
  files.set("manifest.json", json({ format: 1 }));
  return fromFiles(files).data;
}

async function writeRemote(
  folder: SyncFolder,
  side: Side,
  localTextures: Map<string, Uint8Array>,
  remote: LibraryData,
) {
  for (const f of side.put.folders)
    await folder.write(recordPath("folder", f.id), json(f));
  for (const p of side.put.projects)
    await folder.write(recordPath("project", p.id), json(p));
  for (const t of side.put.textures)
    await folder.write(texturePath(t), localTextures.get(t.id) ?? t.data);
  for (const m of side.put.materials)
    await folder.write(recordPath("material", m.id), json(m));
  for (const t of side.put.tombstones)
    await folder.write(tombstonePath(t), json(t));
  for (const d of side.del) await folder.remove(recordPath(d.kind, d.id));
  // textures no remaining material refers to
  const after = applyToData(remote, side);
  const used = new Set(
    after.materials
      .flatMap((m) => [m.textures?.out?.id, m.textures?.in?.id])
      .filter(Boolean),
  );
  for (const t of after.textures)
    if (!used.has(t.id)) await folder.remove(texturePath(t));
}

/** One round of two-way sync. Safe to run repeatedly: a second run with no edits changes nothing. */
export async function syncOnce(
  repo: Repo,
  folder: SyncFolder,
): Promise<SyncResult> {
  const local = await readLibrary(repo);
  const remote = await readRemote(folder);
  const plan = planMerge(local, remote);
  if (plan.changes === 0) return { pulled: 0, pushed: 0 };

  // images coming from the folder
  for (const t of plan.a.put.textures)
    t.data = await folder.read(texturePath(t));
  const localTextures = new Map(local.textures.map((t) => [t.id, t.data]));

  await writeRemote(folder, plan.b, localTextures, remote);
  await writeSide(repo, plan.a);
  const count = (s: Side) =>
    s.put.folders.length +
    s.put.projects.length +
    s.put.materials.length +
    s.del.length;
  return { pulled: count(plan.a), pushed: count(plan.b) };
}
