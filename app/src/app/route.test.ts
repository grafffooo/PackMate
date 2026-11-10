import { describe, expect, it } from "vitest";
import { hashOf, parseHash } from "./route";

describe("route", () => {
  it("parses and prints routes", () => {
    expect(parseHash("")).toEqual({ name: "home" });
    expect(parseHash("#/")).toEqual({ name: "home" });
    expect(parseHash("#/new")).toEqual({ name: "new", folder: null });
    expect(parseHash("#/new?folder=abc")).toEqual({
      name: "new",
      folder: "abc",
    });
    expect(parseHash("#/export")).toEqual({ name: "export" });
    expect(parseHash("#/materials")).toEqual({ name: "materials", id: null });
    expect(parseHash("#/materials/a%20b")).toEqual({
      name: "materials",
      id: "a b",
    });
    expect(parseHash("#/settings")).toEqual({
      name: "settings",
      section: "general",
    });
    expect(parseHash("#/settings/appearance")).toEqual({
      name: "settings",
      section: "appearance",
    });
    expect(parseHash("#/settings/nope")).toEqual({
      name: "settings",
      section: "general",
    });
    expect(parseHash("#/whatever")).toEqual({ name: "home" });
  });

  it("round-trips", () => {
    for (const h of [
      "#/",
      "#/new",
      "#/new?folder=a%20b",
      "#/export",
      "#/settings",
      "#/settings/language",
    ]) {
      expect(hashOf(parseHash(h))).toBe(h);
    }
  });
});
