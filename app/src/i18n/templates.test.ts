import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { initSync, templates } from "../../wasm/dieline.js";
import type { TemplateDef } from "../types";
import { catalog } from "./index";

initSync({
  module: readFileSync(new URL("../../wasm/dieline_bg.wasm", import.meta.url)),
});
const list = JSON.parse(templates()) as TemplateDef[];

describe("template texts", () => {
  for (const lang of ["en", "sk"] as const) {
    const c = catalog(lang);
    const look = (...keys: string[]) =>
      keys.map((k) => c[k]).find((v) => v !== undefined);

    it(`every template, category, group, parameter and option is translated (${lang})`, () => {
      const missing: string[] = [];
      for (const t of list) {
        if (!c[`tpl.${t.id}.name`]) missing.push(`tpl.${t.id}.name`);
        if (!c[`tpl.${t.id}.desc`]) missing.push(`tpl.${t.id}.desc`);
        if (!c[`cat.${t.category}`]) missing.push(`cat.${t.category}`);
        for (const p of t.params.filter((x) => x.id !== "thickness")) {
          if (!c[`group.${p.group}`]) missing.push(`group.${p.group}`);
          const label = look(`p.${t.id}.${p.id}`, `p.${p.id}`);
          if (!label) missing.push(`p.${t.id}.${p.id}`);
          if (p.help && !look(`h.${t.id}.${p.id}`, `h.${p.id}`))
            missing.push(`h.${p.id}`);
          if (p.type === "choice")
            for (const [v] of p.options)
              if (!c[`opt.${p.id}.${v}`]) missing.push(`opt.${p.id}.${v}`);
        }
      }
      expect([...new Set(missing)]).toEqual([]);
    });
  }

  it("English texts match what the engine says, so a wrong shared label shows up here", () => {
    const en = catalog("en");
    const wrong: string[] = [];
    for (const t of list) {
      if (en[`tpl.${t.id}.name`] !== t.name) wrong.push(`name ${t.id}`);
      for (const p of t.params.filter((x) => x.id !== "thickness")) {
        const label = en[`p.${t.id}.${p.id}`] ?? en[`p.${p.id}`];
        if (label !== p.label)
          wrong.push(`${t.id}.${p.id}: "${label}" vs "${p.label}"`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("every template says whether it needs glue", () => {
    for (const t of list)
      expect(
        t.tags.filter((x) => x === "no glue" || x === "needs glue"),
        t.id,
      ).toHaveLength(1);
  });
});
