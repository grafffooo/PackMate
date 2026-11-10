import { describe, expect, it } from "vitest";
import { effectiveParams, materialOf } from "./derive";
import type { Material, Project } from "../storage/model";
import type { TemplateDef } from "../types";

const tpl = {
  id: "x",
  name: "X",
  category: "Boxes",
  description: "",
  tags: [],
  params: [
    {
      id: "thickness",
      label: "T",
      group: "Material",
      type: "length",
      default: 0.4,
      min: 0.05,
      max: 5,
    },
  ],
} as TemplateDef;
const mats = [
  { id: "builtin-kraft-350", thickness: 0.5 },
  { id: "m2", thickness: 1.6 },
] as Material[];
const project = {
  materialId: "m2",
  params: { thickness: 0.4, length: 80 },
} as unknown as Project;

describe("derive", () => {
  it("material thickness overrides stored thickness", () => {
    expect(effectiveParams(tpl, project, materialOf(project, mats))).toEqual({
      thickness: 1.6,
      length: 80,
    });
  });
  it("falls back to the default material", () => {
    expect(materialOf({ ...project, materialId: "gone" }, mats)?.id).toBe(
      "builtin-kraft-350",
    );
  });
});
