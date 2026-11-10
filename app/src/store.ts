// Small persistent preferences + saved designs (per device, in localStorage).
import type { Params } from "./types";
import type { Unit } from "./units";

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export function load<T>(key: string, fallback: T): T {
  return safe(() => {
    const v = localStorage.getItem(`packmate.${key}`);
    return v === null ? fallback : (JSON.parse(v) as T);
  }, fallback);
}

export function save(key: string, value: unknown) {
  safe(() => localStorage.setItem(`packmate.${key}`, JSON.stringify(value)), undefined);
}

export type SavedDesign = { id: string; name: string; template: string; params: Params; updated: number };

export const prefs = {
  unit: () => load<Unit>("unit", "mm"),
  setUnit: (u: Unit) => save("unit", u),
  machine: () => load<string>("machine", "cricut-12x12"),
  setMachine: (m: string) => save("machine", m),
  material: () => load<string>("material", "card-300"),
  setMaterial: (m: string) => save("material", m),
};

export function designs(): SavedDesign[] {
  return load<SavedDesign[]>("designs", []).sort((a, b) => b.updated - a.updated);
}

export function saveDesign(d: Omit<SavedDesign, "id" | "updated"> & { id?: string }): SavedDesign {
  const all = load<SavedDesign[]>("designs", []);
  const rec: SavedDesign = { ...d, id: d.id ?? crypto.randomUUID?.() ?? String(Date.now()), updated: Date.now() };
  const i = all.findIndex((x) => x.id === rec.id);
  if (i >= 0) all[i] = rec;
  else all.push(rec);
  save("designs", all);
  return rec;
}

export function deleteDesign(id: string) {
  save(
    "designs",
    load<SavedDesign[]>("designs", []).filter((d) => d.id !== id),
  );
}

// ---- share links: #/edit/<template>?p=<base64url(json)> ----
export function encodeParams(p: Params): string {
  const json = JSON.stringify(p);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeParams(s: string): Params | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64)))) as Params;
  } catch {
    return null;
  }
}
