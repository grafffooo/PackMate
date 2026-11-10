// Thin typed wrapper around the Rust/WASM dieline engine.
import init, * as wasm from "../wasm/dieline.js";
import type {
  ExportOptions,
  FitInfo,
  Generated,
  Machine,
  Material,
  OutFile,
  Params,
  TemplateDef,
} from "./types";

let ready: Promise<void> | null = null;

export function loadCore(): Promise<void> {
  ready ??= init().then(() => undefined);
  return ready;
}

let cachedTemplates: TemplateDef[] | null = null;
export function templates(): TemplateDef[] {
  cachedTemplates ??= JSON.parse(wasm.templates()) as TemplateDef[];
  return cachedTemplates;
}

let cachedCatalog: { materials: Material[]; machines: Machine[] } | null = null;
export function catalog() {
  cachedCatalog ??= JSON.parse(wasm.catalog());
  return cachedCatalog!;
}

export function generate(id: string, params: Params): Generated {
  return JSON.parse(wasm.generate(id, JSON.stringify(params))) as Generated;
}

export function exportFiles(id: string, params: Params, opts: ExportOptions): OutFile[] {
  return JSON.parse(wasm.exportFiles(id, JSON.stringify(params), JSON.stringify(opts))).files as OutFile[];
}

export function fit(id: string, params: Params, sheet: { w: number; h: number; margin: number }, spacing = 4): FitInfo {
  return JSON.parse(wasm.fit(id, JSON.stringify(params), JSON.stringify(sheet), spacing)) as FitInfo;
}

export function defaults(t: TemplateDef): Params {
  const p: Params = {};
  for (const d of t.params) p[d.id] = d.default;
  return p;
}
