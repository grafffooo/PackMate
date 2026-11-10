// Saving exported files. Chrome and Edge open the system "Save as" dialog (so the user picks the
// name and folder); other browsers download straight to the downloads folder.
import type { OutFile } from "./types";

type SaveFilePicker = (opts: {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<{
  createWritable(): Promise<{
    write(data: BlobPart): Promise<void>;
    close(): Promise<void>;
  }>;
}>;

function picker(): SaveFilePicker | null {
  const w = globalThis as unknown as { showSaveFilePicker?: SaveFilePicker };
  return typeof w.showSaveFilePicker === "function"
    ? w.showSaveFilePicker.bind(globalThis)
    : null;
}

export function hasNativeSaveDialog(): boolean {
  return picker() !== null;
}

export function fileBytes(f: OutFile): Uint8Array {
  if (f.base64 !== undefined) {
    const bin = atob(f.base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(f.text ?? "");
}

export type SaveOutcome = "saved" | "downloaded" | "cancelled";

export async function saveFile(f: OutFile): Promise<SaveOutcome> {
  const data = fileBytes(f);
  const ext = f.name.includes(".") ? "." + f.name.split(".").pop() : "";
  const show = picker();
  if (show) {
    try {
      const handle = await show({
        suggestedName: f.name,
        types: [
          {
            description: ext.slice(1).toUpperCase() || "File",
            accept: { [f.mime]: [ext || ".bin"] },
          },
        ],
      });
      const w = await handle.createWritable();
      await w.write(data as BlobPart);
      await w.close();
      return "saved";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
      // any other failure (permissions, sandbox): fall back to a normal download
    }
  }
  const blob = new Blob([data as BlobPart], { type: f.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

/** Share a file via the OS share sheet where supported (Android / iOS browsers). */
export async function shareFile(f: OutFile): Promise<boolean> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const file = new File([fileBytes(f) as BlobPart], f.name, { type: f.mime });
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  try {
    await nav.share({ files: [file], title: f.name });
    return true;
  } catch {
    return false;
  }
}
