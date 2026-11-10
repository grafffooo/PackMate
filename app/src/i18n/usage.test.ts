import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "./index";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("i18n usage", () => {
  it("every literal key used with t() / tp() exists in English", () => {
    const en = catalog("en");
    const missing: string[] = [];
    for (const f of files("src")) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([\w.-]+)"/g))
        if (!(m[1] in en)) missing.push(`${f}: ${m[1]}`);
      for (const m of src.matchAll(/\btp\(\s*"([\w.-]+)"/g))
        if (!(`${m[1]}.other` in en)) missing.push(`${f}: ${m[1]}.other`);
    }
    expect(missing).toEqual([]);
  });

  it("dynamic key families are complete", () => {
    const en = catalog("en");
    for (const id of [
      "seafoam",
      "terracotta",
      "lavender",
      "ocean",
      "rose",
      "marigold",
    ])
      expect(en[`accent.${id}`]).toBeTruthy();
    for (const f of ["svg", "pdf", "dxf"])
      expect(en[`export.fmt.${f}`]).toBeTruthy();
    for (const s of ["general", "appearance", "language"])
      expect(en[`settings.${s}`]).toBeTruthy();
  });
});
