import type { LibraryData } from "./bundle";
import type { Side } from "./merge";
import type { Repo } from "./repo";

/** Everything a backup or sync needs from the local database. */
export async function readLibrary(repo: Repo): Promise<LibraryData> {
  const [snap, textures, tombstones] = await Promise.all([
    repo.load(),
    repo.allTextures(),
    repo.listTombstones(),
  ]);
  return {
    folders: snap.folders,
    projects: snap.projects,
    materials: snap.materials,
    textures,
    tombstones,
  };
}

/** Apply a merge plan's writes for the local side. */
export async function writeSide(repo: Repo, side: Side): Promise<void> {
  for (const f of side.put.folders) await repo.putFolder(f);
  for (const p of side.put.projects) await repo.putProject(p);
  for (const t of side.put.textures) await repo.putTexture(t);
  for (const m of side.put.materials) await repo.putMaterial(m);
  for (const t of side.put.tombstones) await repo.putTombstone(t);
  for (const d of side.del) {
    if (d.kind === "folder") await repo.deleteFolder(d.id);
    else if (d.kind === "project") await repo.deleteProject(d.id);
    else await repo.deleteMaterial(d.id);
  }
}

/** Restore "replace everything": the library becomes exactly `data`. */
export async function replaceLibrary(
  repo: Repo,
  data: LibraryData,
): Promise<void> {
  await repo.clearLibrary();
  for (const f of data.folders) await repo.putFolder(f);
  for (const p of data.projects) await repo.putProject(p);
  for (const t of data.textures) await repo.putTexture(t);
  for (const m of data.materials) await repo.putMaterial(m);
  for (const t of data.tombstones) await repo.putTombstone(t);
  await repo.markSeeded();
}

/** Drop texture blobs no material refers to any more. */
export async function pruneTextures(repo: Repo): Promise<void> {
  const { materials } = await repo.load();
  const used = new Set(
    materials
      .flatMap((m) => [m.textures?.out?.id, m.textures?.in?.id])
      .filter(Boolean),
  );
  for (const t of await repo.allTextures())
    if (!used.has(t.id)) await repo.deleteTexture(t.id);
}
