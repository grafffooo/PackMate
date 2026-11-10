import { describe, expect, it } from "vitest";
import { format, parseLength, round, toDisplay } from "./units";

describe("units", () => {
  it("converts", () => {
    expect(toDisplay(25.4, "in")).toBeCloseTo(1);
    expect(round(12.345, "mm")).toBe(12.3);
  });
  it("formats", () => {
    expect(format(100, "mm")).toBe("100 mm");
    expect(format(25.4, "in")).toBe("1″");
    expect(format(31.75, "in")).toBe("1.25″");
  });
  it("parses suffixes and fractions", () => {
    expect(parseLength("50", "mm")).toBe(50);
    expect(parseLength("2in", "mm")).toBeCloseTo(50.8);
    expect(parseLength("3 1/2", "in")).toBeCloseTo(88.9);
    expect(parseLength("1/4\"", "mm")).toBeCloseTo(6.35);
    expect(parseLength("12,5", "mm")).toBe(12.5);
    expect(parseLength("4cm", "in")).toBe(40);
    expect(parseLength("abc", "mm")).toBeNull();
    expect(parseLength("", "mm")).toBeNull();
  });
});
