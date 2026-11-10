import type { Params } from "../types";
import { isAccent, type AccentId, type SchemePref } from "../theme/palettes";
import type { Lang } from "../i18n";
import type { Unit } from "../units";

/** Bump when the shape of stored records changes, and add a step to `migrateSettings` / the repo upgrade. */
export const SCHEMA_VERSION = 2;

export type Folder = {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type Project = {
  id: string;
  name: string;
  /** null = not in any folder */
  folderId: string | null;
  /** engine template id, e.g. "mailer-box" */
  template: string;
  params: Params;
  materialId: string;
  createdAt: number;
  updatedAt: number;
};

/** An uploaded image for one face of a material. The bytes live in the `textures` store, keyed by id. */
export type TextureRef = {
  id: string;
  /** original file name, shown in the UI */
  name: string;
  w: number;
  h: number;
  mime: "image/jpeg" | "image/png";
};
export type TextureData = {
  id: string;
  mime: TextureRef["mime"];
  data: Uint8Array;
};

export type Material = {
  id: string;
  name: string;
  /** mm */
  thickness: number;
  gsm: number | null;
  /** #rrggbb */
  color: string;
  /** outside / inside face images; missing = plain colour */
  textures?: { out?: TextureRef; in?: TextureRef };
  createdAt: number;
  updatedAt: number;
};

export type RecordKind = "folder" | "project" | "material";
/** Remembers a deletion so it can reach other devices through sync. */
export type Tombstone = {
  key: string;
  kind: RecordKind;
  id: string;
  deletedAt: number;
};
export const tombstoneKey = (kind: RecordKind, id: string) => `${kind}:${id}`;

export type CustomMat = {
  id: string;
  name: string;
  w: number;
  h: number;
  margin: number;
};

export type Settings = {
  unit: Unit;
  machineId: string;
  customMats: CustomMat[];
  accent: AccentId;
  scheme: SchemePref;
  /** "system" follows the browser language */
  lang: Lang | "system";
  lastProjectId: string | null;
};

export const DEFAULT_SETTINGS: Settings = {
  unit: "mm",
  machineId: "none",
  customMats: [],
  accent: "seafoam",
  scheme: "system",
  lang: "system",
  lastProjectId: null,
};

/** Fill in missing fields (older or partial records) and drop junk. */
export function migrateSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>;
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (r.unit === "mm" || r.unit === "in") s.unit = r.unit;
  if (typeof r.machineId === "string") s.machineId = r.machineId;
  if (Array.isArray(r.customMats)) {
    s.customMats = r.customMats.filter(
      (c) => c && typeof c.id === "string" && c.w > 0 && c.h > 0,
    );
  }
  if (isAccent(r.accent)) s.accent = r.accent;
  if (r.scheme === "light" || r.scheme === "dark" || r.scheme === "system")
    s.scheme = r.scheme;
  if (r.lang === "en" || r.lang === "sk" || r.lang === "system")
    s.lang = r.lang;
  if (typeof r.lastProjectId === "string" || r.lastProjectId === null)
    s.lastProjectId = r.lastProjectId ?? null;
  return s;
}

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- sanitizers for data that comes from outside (backup, sync folder) ----------

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : d;

export function sanitizeFolder(raw: unknown): Folder | null {
  if (!isObj(raw) || typeof raw.id !== "string" || !raw.id) return null;
  return {
    id: raw.id,
    name: str(raw.name, "Folder"),
    order: num(raw.order, 0),
    createdAt: num(raw.createdAt, 0),
    updatedAt: num(raw.updatedAt, 0),
  };
}

export function sanitizeProject(raw: unknown): Project | null {
  if (
    !isObj(raw) ||
    typeof raw.id !== "string" ||
    !raw.id ||
    typeof raw.template !== "string"
  )
    return null;
  return {
    id: raw.id,
    name: str(raw.name, "Untitled"),
    folderId: typeof raw.folderId === "string" ? raw.folderId : null,
    template: raw.template,
    params: isObj(raw.params) ? (raw.params as Project["params"]) : {},
    materialId: str(raw.materialId, "builtin-kraft-350"),
    createdAt: num(raw.createdAt, 0),
    updatedAt: num(raw.updatedAt, 0),
  };
}

const texRef = (v: unknown): TextureRef | undefined => {
  if (!isObj(v) || typeof v.id !== "string" || !v.id) return undefined;
  const mime = v.mime === "image/png" ? "image/png" : "image/jpeg";
  return {
    id: v.id,
    name: str(v.name, "texture"),
    w: num(v.w, 0),
    h: num(v.h, 0),
    mime,
  };
};

export function sanitizeMaterial(raw: unknown): Material | null {
  if (!isObj(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const color =
    typeof raw.color === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.color)
      ? raw.color
      : "#c49a6c";
  const t = isObj(raw.textures) ? raw.textures : {};
  const out = texRef(t.out);
  const inn = texRef(t.in);
  return {
    id: raw.id,
    name: str(raw.name, "Material"),
    thickness: Math.min(5, Math.max(0.05, num(raw.thickness, 0.4))),
    gsm: typeof raw.gsm === "number" && raw.gsm > 0 ? raw.gsm : null,
    color,
    ...(out || inn
      ? { textures: { ...(out ? { out } : {}), ...(inn ? { in: inn } : {}) } }
      : {}),
    createdAt: num(raw.createdAt, 0),
    updatedAt: num(raw.updatedAt, 0),
  };
}

export function sanitizeTombstone(raw: unknown): Tombstone | null {
  if (!isObj(raw) || typeof raw.id !== "string") return null;
  if (
    raw.kind !== "folder" &&
    raw.kind !== "project" &&
    raw.kind !== "material"
  )
    return null;
  return {
    key: tombstoneKey(raw.kind, raw.id),
    kind: raw.kind,
    id: raw.id,
    deletedAt: num(raw.deletedAt, 0),
  };
}
