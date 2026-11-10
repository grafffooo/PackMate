import { describe, expect, it } from "vitest";
import { catalog, detectLang, translate, translatePlural } from "./index";

describe("i18n", () => {
  it("has the same keys and placeholders in every language", () => {
    const en = catalog("en");
    const sk = catalog("sk");
    expect(Object.keys(sk).sort()).toEqual(Object.keys(en).sort());
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const k of Object.keys(en)) {
      expect(ph(sk[k]), `placeholders of ${k}`).toBe(ph(en[k]));
      expect(sk[k].trim().length, `empty ${k}`).toBeGreaterThan(0);
    }
  });

  it("detects the browser language", () => {
    expect(detectLang(["sk-SK", "en"])).toBe("sk");
    expect(detectLang(["de-DE", "en-US"])).toBe("en");
    expect(detectLang(["cs", "sk"])).toBe("sk");
    expect(detectLang([])).toBe("en");
    expect(detectLang(undefined)).toBe("en");
  });

  it("falls back to the key for unknown messages", () => {
    expect(translate("sk", "does.not.exist")).toBe("does.not.exist");
  });

  it("fills placeholders", () => {
    expect(translate("en", "x {a} y {b}", { a: 1, b: "two" })).toBe(
      "x 1 y two",
    );
    expect(translate("en", "x {a} {missing}", { a: 1 })).toBe("x 1 {missing}");
  });

  it("uses Slovak plural categories", () => {
    // These rules come from Intl, so the test documents the expectation.
    const rules = new Intl.PluralRules("sk");
    expect(rules.select(1)).toBe("one");
    expect(rules.select(3)).toBe("few");
    expect(rules.select(5)).toBe("other");
    expect(rules.select(0)).toBe("other");
    expect(translatePlural("en", "nothing", 2)).toBe("nothing.other");
  });
});
