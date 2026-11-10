import { catalog } from "../core";
import type { Machine } from "../types";
import type { Settings } from "../storage/model";

export type MatSize = { w: number; h: number; margin: number };

/** The cutting-mat / sheet size picked in Settings, if it has a fixed size. */
export function matOf(settings: Settings): MatSize | null {
  const custom = settings.customMats.find((c) => c.id === settings.machineId);
  if (custom) return { w: custom.w, h: custom.h, margin: custom.margin };
  const m = catalog().machines.find((x) => x.id === settings.machineId);
  return m && m.w && m.h ? { w: m.w, h: m.h, margin: m.margin } : null;
}

export function machineOf(settings: Settings): Machine | undefined {
  return catalog().machines.find((x) => x.id === settings.machineId);
}
