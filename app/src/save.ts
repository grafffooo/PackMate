// Save exported files: native dialogs inside the Tauri app, downloads in the browser.
import type { OutFile } from "./types";

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function bytes(f: OutFile): Uint8Array {
  if (f.base64 !== undefined) {
    const bin = atob(f.base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(f.text ?? "");
}

export async function saveFiles(files: OutFile[]): Promise<number> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    let n = 0;
    for (const f of files) {
      const ext = f.name.split(".").pop() ?? "";
      const path = await save({ defaultPath: f.name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
      if (!path) break;
      await writeFile(path, bytes(f));
      n++;
    }
    return n;
  }
  for (const f of files) {
    const blob = new Blob([bytes(f)], { type: f.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    // browsers throttle bursts of downloads
    if (files.length > 1) await new Promise((r) => setTimeout(r, 350));
  }
  return files.length;
}

/** Share a file via the OS share sheet where supported (Android / iOS browsers). */
export async function shareFiles(files: OutFile[]): Promise<boolean> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const fs = files.map((f) => new File([bytes(f)], f.name, { type: f.mime }));
  if (!nav.share || !nav.canShare?.({ files: fs })) return false;
  await nav.share({ files: fs, title: files[0]?.name });
  return true;
}
