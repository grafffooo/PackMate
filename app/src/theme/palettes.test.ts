import { describe, expect, it } from "vitest";
import {
  ACCENT_IDS,
  buildTheme,
  contrast,
  mix,
  resolveScheme,
} from "./palettes";

describe("theme", () => {
  it("builds every variable for every accent and scheme", () => {
    for (const id of ACCENT_IDS) {
      for (const scheme of ["light", "dark"] as const) {
        const v = buildTheme(id, scheme);
        for (const k of [
          "--bg",
          "--surface",
          "--surface2",
          "--soft",
          "--ink",
          "--muted",
          "--line",
          "--acc",
          "--acc-ink",
          "--cut",
          "--crease",
          "--mat",
          "--mat2",
        ]) {
          expect(v[k], `${id}/${scheme} ${k}`).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });

  it("keeps body text readable (WCAG AA 4.5:1)", () => {
    for (const id of ACCENT_IDS) {
      for (const scheme of ["light", "dark"] as const) {
        const v = buildTheme(id, scheme);
        const name = `${id}/${scheme}`;
        expect(
          contrast(v["--ink"], v["--bg"]),
          `${name} ink on bg`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(v["--ink"], v["--surface"]),
          `${name} ink on surface`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(v["--muted"], v["--surface"]),
          `${name} muted on surface`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(v["--muted"], v["--surface2"]),
          `${name} muted on surface2`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(v["--ink"], v["--soft"]),
          `${name} ink on soft`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps text on accent buttons readable", () => {
    for (const id of ACCENT_IDS) {
      for (const scheme of ["light", "dark"] as const) {
        const v = buildTheme(id, scheme);
        expect(
          contrast(v["--acc-ink"], v["--acc"]),
          `${id}/${scheme} button text`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps the accent usable as text on tinted surfaces", () => {
    for (const id of ACCENT_IDS) {
      for (const scheme of ["light", "dark"] as const) {
        const v = buildTheme(id, scheme);
        expect(
          contrast(v["--acc"], v["--soft"]),
          `${id}/${scheme} accent on soft`,
        ).toBeGreaterThanOrEqual(3);
        expect(
          contrast("#ffffff", v["--mat2"]),
          `${id}/${scheme} ruler numbers`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("resolves the system preference", () => {
    expect(resolveScheme("system", true)).toBe("dark");
    expect(resolveScheme("system", false)).toBe("light");
    expect(resolveScheme("light", true)).toBe("light");
  });

  it("mixes colours", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
