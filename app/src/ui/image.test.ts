import { describe, expect, it } from "vitest";
import { fitWithin } from "./image";

describe("fitWithin", () => {
  it("scales the long side down to the limit and keeps the ratio", () => {
    expect(fitWithin(4096, 2048)).toEqual({ w: 2048, h: 1024 });
    expect(fitWithin(1000, 3000)).toEqual({ w: 683, h: 2048 });
  });
  it("never scales up", () => {
    expect(fitWithin(300, 200)).toEqual({ w: 300, h: 200 });
  });
});
