import { afterEach, describe, expect, it, vi } from "vitest";
import { saveFile } from "./save";

const file = { name: "box.svg", mime: "image/svg+xml", text: "<svg/>" };

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("saveFile in the desktop app", () => {
  it("asks for a path with the native dialog and writes the bytes there", async () => {
    const save = vi.fn().mockResolvedValue("/home/me/box.svg");
    const writeFile = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ save }));
    vi.doMock("@tauri-apps/plugin-fs", () => ({ writeFile }));
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const { saveFile: desktopSave } = await import("./save");
    expect(await desktopSave(file)).toBe("saved");
    expect(save).toHaveBeenCalledWith({
      defaultPath: "box.svg",
      filters: [{ name: "SVG", extensions: ["svg"] }],
    });
    expect(writeFile).toHaveBeenCalledWith(
      "/home/me/box.svg",
      new TextEncoder().encode("<svg/>"),
    );
  });

  it("does nothing when the dialog is cancelled", async () => {
    const writeFile = vi.fn();
    vi.doMock("@tauri-apps/plugin-dialog", () => ({
      save: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@tauri-apps/plugin-fs", () => ({ writeFile }));
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const { saveFile: desktopSave } = await import("./save");
    expect(await desktopSave(file)).toBe("cancelled");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("is not used on the web", () => {
    expect(typeof saveFile).toBe("function");
    expect("__TAURI_INTERNALS__" in globalThis).toBe(false);
  });
});
