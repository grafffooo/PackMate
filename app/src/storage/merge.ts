// Pure three-way-free merge used by "Restore: add to library" and by folder sync.
// Rule: per record, the newest `updatedAt` wins; a deletion beats a record that is not newer than it.
import type { LibraryData } from "./bundle";
import type {
  Folder,
  Material,
  Project,
  RecordKind,
  TextureData,
  Tombstone,
} from "./model";
import { tombstoneKey } from "./model";

type Rec = { id: string; updatedAt: number };

export type Side = {
  put: {
    folders: Folder[];
    projects: Project[];
    materials: Material[];
    textures: TextureData[];
    tombstones: Tombstone[];
  };
  del: { kind: RecordKind; id: string }[];
};

export type MergePlan = { a: Side; b: Side; changes: number };

const newSide = (): Side => ({
  put: {
    folders: [],
    projects: [],
    materials: [],
    textures: [],
    tombstones: [],
  },
  del: [],
});

/** Plan the writes that make side A and side B agree. */
export function planMerge(a: LibraryData, b: LibraryData): MergePlan {
  const plan: MergePlan = { a: newSide(), b: newSide(), changes: 0 };

  // newest tombstone per record, from either side
  const tombs = new Map<string, Tombstone>();
  for (const t of [...a.tombstones, ...b.tombstones]) {
    const cur = tombs.get(t.key);
    if (!cur || t.deletedAt > cur.deletedAt) tombs.set(t.key, t);
  }
  const have = (side: LibraryData) =>
    new Set(side.tombstones.map((t) => `${t.key}@${t.deletedAt}`));
  const aHas = have(a);
  const bHas = have(b);

  const kinds = [
    ["folder", "folders"],
    ["project", "projects"],
    ["material", "materials"],
  ] as const;

  for (const [kind, list] of kinds) {
    const am = new Map<string, Rec>((a[list] as Rec[]).map((r) => [r.id, r]));
    const bm = new Map<string, Rec>((b[list] as Rec[]).map((r) => [r.id, r]));
    for (const id of new Set([...am.keys(), ...bm.keys()])) {
      const ra = am.get(id);
      const rb = bm.get(id);
      const t = tombs.get(tombstoneKey(kind, id));
      const newest = Math.max(ra?.updatedAt ?? -1, rb?.updatedAt ?? -1);
      if (t && t.deletedAt >= newest) {
        if (ra) plan.a.del.push({ kind, id });
        if (rb) plan.b.del.push({ kind, id });
        continue;
      }
      if (ra && !rb) (plan.b.put[list] as Rec[]).push(ra);
      else if (rb && !ra) (plan.a.put[list] as Rec[]).push(rb);
      else if (ra && rb && ra.updatedAt > rb.updatedAt)
        (plan.b.put[list] as Rec[]).push(ra);
      else if (ra && rb && rb.updatedAt > ra.updatedAt)
        (plan.a.put[list] as Rec[]).push(rb);
    }
  }

  for (const t of tombs.values()) {
    const k = `${t.key}@${t.deletedAt}`;
    if (!aHas.has(k)) plan.a.put.tombstones.push(t);
    if (!bHas.has(k)) plan.b.put.tombstones.push(t);
  }

  // textures are immutable once uploaded: copy whichever ones the other side is missing
  const aTex = new Set(a.textures.map((t) => t.id));
  const bTex = new Set(b.textures.map((t) => t.id));
  const refs = (ms: Material[]) =>
    ms.flatMap((m) =>
      [m.textures?.out?.id, m.textures?.in?.id].filter((x): x is string => !!x),
    );
  for (const id of refs(plan.b.put.materials)) {
    const t = a.textures.find((x) => x.id === id);
    if (t && !bTex.has(id)) (plan.b.put.textures.push(t), bTex.add(id));
  }
  for (const id of refs(plan.a.put.materials)) {
    const t = b.textures.find((x) => x.id === id);
    if (t && !aTex.has(id)) (plan.a.put.textures.push(t), aTex.add(id));
  }

  for (const s of [plan.a, plan.b]) {
    plan.changes +=
      s.del.length +
      s.put.folders.length +
      s.put.projects.length +
      s.put.materials.length +
      s.put.textures.length +
      s.put.tombstones.length;
  }
  return plan;
}

export function applyToData(d: LibraryData, side: Side): LibraryData {
  const gone = new Set(side.del.map((x) => `${x.kind}:${x.id}`));
  const upsert = <T extends Rec>(cur: T[], add: T[], kind: RecordKind) => {
    const m = new Map(
      cur.filter((r) => !gone.has(`${kind}:${r.id}`)).map((r) => [r.id, r]),
    );
    for (const r of add) m.set(r.id, r);
    return [...m.values()];
  };
  const tex = new Map(d.textures.map((t) => [t.id, t]));
  for (const t of side.put.textures) tex.set(t.id, t);
  const tombs = new Map(d.tombstones.map((t) => [t.key, t]));
  for (const t of side.put.tombstones) tombs.set(t.key, t);
  return {
    folders: upsert(d.folders, side.put.folders, "folder"),
    projects: upsert(d.projects, side.put.projects, "project"),
    materials: upsert(d.materials, side.put.materials, "material"),
    textures: [...tex.values()],
    tombstones: [...tombs.values()],
  };
}
