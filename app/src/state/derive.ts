import type { Params, TemplateDef } from "../types";
import type { Material, Project } from "../storage/model";
import { DEFAULT_MATERIAL_ID } from "../storage/seed";

export function materialOf(
  project: Project,
  materials: Material[],
): Material | undefined {
  return (
    materials.find((m) => m.id === project.materialId) ??
    materials.find((m) => m.id === DEFAULT_MATERIAL_ID) ??
    materials[0]
  );
}

/** Parameters sent to the engine: the material's thickness always wins over any stored value. */
export function effectiveParams(
  tpl: TemplateDef,
  project: Project,
  material: Material | undefined,
): Params {
  const p: Params = { ...project.params };
  if (material && tpl.params.some((d) => d.id === "thickness"))
    p.thickness = material.thickness;
  return p;
}
