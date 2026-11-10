// The on-disk layout shared by backup archives and the sync folder:
//   manifest.json, folders/<id>.json, projects/<id>.json, materials/<id>.json,
//   textures/<id>.png|jpg, deleted/<kind>-<id>.json
// Settings are not included: they belong to the device.
import {
  sanitizeFolder,
  sanitizeMaterial,
  sanitizeProject,
  sanitizeTombstone,
  type Folder,
  type Material,
  type Project,
  type TextureData,
  type Tombstone,
} from "./model";

export const BUNDLE_FORMAT = 1;

export type LibraryData = {
  folders: Folder[];
  projects: Project[];
  materials: Material[];
  textures: TextureData[];
  tombstones: Tombstone[];
};

export const emptyLibrary = (): LibraryData => ({
  folders: [],
  projects: [],
  materials: [],
  textures: [],
  tombstones: [],
});

export type Files = Map<string, Uint8Array>;

const enc = new TextEncoder();
const dec = new TextDecoder();
const json = (v: unknown) => enc.encode(JSON.stringify(v, null, 2));
const ext = (mime: string) => (mime === "image/png" ? "png" : "jpg");

// ids come from files we didn't write, so keep them from escaping the folder
const safe = (id: string) =>
  id.replace(/[^\w.-]/g, "_").replace(/\.{2,}/g, "_");

export function recordPath(
  kind: "folder" | "project" | "material",
  id: string,
) {
  return `${kind}s/${safe(id)}.json`;
}
export const texturePath = (t: { id: string; mime: string }) =>
  `textures/${safe(t.id)}.${ext(t.mime)}`;
export const tombstonePath = (t: Tombstone) =>
  `deleted/${t.kind}-${safe(t.id)}.json`;

export function toFiles(d: LibraryData, now = Date.now()): Files {
  const f: Files = new Map();
  f.set(
    "manifest.json",
    json({ format: BUNDLE_FORMAT, app: "PackMate", createdAt: now }),
  );
  for (const x of d.folders) f.set(recordPath("folder", x.id), json(x));
  for (const x of d.projects) f.set(recordPath("project", x.id), json(x));
  for (const x of d.materials) f.set(recordPath("material", x.id), json(x));
  for (const t of d.textures) f.set(texturePath(t), t.data);
  for (const t of d.tombstones) f.set(tombstonePath(t), json(t));
  return f;
}

export type ParseResult = { data: LibraryData; skipped: number };

/** Read a bundle. Unknown files are ignored; malformed records are counted and skipped. */
export function fromFiles(files: Files): ParseResult {
  const manifest = files.get("manifest.json");
  if (manifest) {
    try {
      const m = JSON.parse(dec.decode(manifest));
      if (typeof m.format === "number" && m.format > BUNDLE_FORMAT)
        throw new Error("newer");
    } catch (e) {
      if (e instanceof Error && e.message === "newer")
        throw new Error("This backup was made by a newer version of PackMate.");
    }
  } else if (
    ![...files.keys()].some((k) => /^(folders|projects|materials)\//.test(k))
  ) {
    throw new Error("This doesn't look like a PackMate backup.");
  }

  const data = emptyLibrary();
  let skipped = 0;
  const each = <T>(dir: string, clean: (r: unknown) => T | null, out: T[]) => {
    for (const [path, bytes] of files) {
      if (!path.startsWith(dir + "/") || !path.endsWith(".json")) continue;
      try {
        const v = clean(JSON.parse(dec.decode(bytes)));
        if (v) out.push(v);
        else skipped++;
      } catch {
        skipped++;
      }
    }
  };
  each("folders", sanitizeFolder, data.folders);
  each("projects", sanitizeProject, data.projects);
  each("materials", sanitizeMaterial, data.materials);
  each("deleted", sanitizeTombstone, data.tombstones);

  for (const [path, bytes] of files) {
    const m = /^textures\/(.+)\.(png|jpg)$/.exec(path);
    if (!m) continue;
    data.textures.push({
      id: m[1],
      mime: m[2] === "png" ? "image/png" : "image/jpeg",
      data: bytes,
    });
  }
  return { data, skipped };
}
