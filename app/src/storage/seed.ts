import type { Material } from "./model";

/** Materials every library starts with. Thickness is what the engine uses to compensate folds. */
export function builtinMaterials(now: number): Material[] {
  const m = (
    id: string,
    name: string,
    thickness: number,
    gsm: number | null,
    color: string,
  ): Material => ({
    id,
    name,
    thickness,
    gsm,
    color,
    createdAt: now,
    updatedAt: now,
  });
  return [
    m("builtin-kraft-350", "Kraft board 350 gsm", 0.5, 350, "#c49a6c"),
    m("builtin-white-300", "White cardstock 300 gsm", 0.4, 300, "#f7f5f0"),
    m("builtin-black-300", "Black cardstock 300 gsm", 0.4, 300, "#3a3836"),
    m("builtin-eflute", "Corrugated E-flute", 1.6, null, "#b98b57"),
  ];
}

export const DEFAULT_MATERIAL_ID = "builtin-kraft-350";
