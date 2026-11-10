import type { Params } from "../types";
import { isAccent, type AccentId, type SchemePref } from "../theme/palettes";
import type { Lang } from "../i18n";
import type { Unit } from "../units";

/** Bump when the shape of stored records changes, and add a step to `migrateSettings` / the repo upgrade. */
export const SCHEMA_VERSION = 1;

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

export type Material = {
  id: string;
  name: string;
  /** mm */
  thickness: number;
  gsm: number | null;
  /** #rrggbb */
  color: string;
  createdAt: number;
  updatedAt: number;
};

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
