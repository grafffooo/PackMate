import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { foldMatrices, to3 } from "./fold";
import type { Generated } from "./types";
import { initSync, generate, templates } from "../wasm/dieline.js";

initSync({
  module: readFileSync(new URL("../wasm/dieline_bg.wasm", import.meta.url)),
});

const gen = (id: string, p: object = {}) =>
  JSON.parse(generate(id, JSON.stringify(p))) as Generated;

function foldedBox(g: Generated) {
  const ms = foldMatrices(g.panels, 1);
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  g.panels.forEach((p, i) => {
    for (const q of p.outline) {
      const v = to3(q).applyMatrix4(ms[i]);
      min.min(v);
      max.max(v);
    }
  });
  return max.sub(min);
}

describe("part assembly", () => {
  it("rotates and moves a separate part with the slider", () => {
    const panels = [
      {
        name: "A",
        outline: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        parent: null,
        hinge: null,
        angle: 0,
        stage: 0,
        label: true,
        assembly: [
          { t: "rot", pivot: [0, 10, 0], axis: [1, 0, 0], angle: 90 },
          { t: "move", d: [5, 0, 0] },
        ],
      },
    ] as Generated["panels"];
    const at = (t: number) =>
      to3({ x: 0, y: 0 }).applyMatrix4(foldMatrices(panels, t)[0]);
    expect(at(0).toArray()).toEqual([0, 0, 0]);
    // standing up about its bottom edge (layout y = 10): the top-left corner rises 10 mm out of the sheet
    const v = at(1);
    expect([v.x, v.y, v.z].map((n) => Math.round(n * 1000) / 1000)).toEqual([
      5, -10, 10,
    ]);
  });
});

describe("fold model", () => {
  it("every template folds", () => {
    const list = JSON.parse(templates()) as { id: string }[];
    expect(list.length).toBe(8);
    for (const t of list) {
      const s = foldedBox(gen(t.id));
      expect(Number.isFinite(s.x + s.y + s.z)).toBe(true);
    }
  });

  it("tuck end box folds to its dimensions", () => {
    const g = gen("reverse-tuck-end", {
      length: 70,
      width: 40,
      height: 110,
      thickness: 0.05,
    });
    const s = foldedBox(g);
    const dims = [s.x, s.y, s.z].sort((a, b) => a - b);
    expect(dims[0]).toBeCloseTo(40.05, 0);
    expect(dims[1]).toBeCloseTo(70.05, 0);
    expect(dims[2]).toBeCloseTo(110.05, 0);
  });

  it("mailer folds closed", () => {
    const g = gen("mailer-box", {
      length: 200,
      width: 150,
      height: 50,
      thickness: 0.05,
    });
    const s = foldedBox(g);
    const dims = [s.x, s.y, s.z].sort((a, b) => a - b);
    expect(dims[0]).toBeLessThan(52);
    expect(dims[2]).toBeLessThan(205);
  });
});
