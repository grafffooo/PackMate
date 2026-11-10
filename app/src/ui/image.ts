import type { TextureData, TextureRef } from "../storage/model";
import { newId } from "../storage/model";

export const MAX_TEXTURE_PX = 2048;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export class ImageError extends Error {
  constructor(public code: "type" | "size" | "decode") {
    super(code);
  }
}

/** Scale (w, h) down so neither side exceeds `max`; never scales up. */
export function fitWithin(
  w: number,
  h: number,
  max = MAX_TEXTURE_PX,
): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return {
    w: Math.max(1, Math.round(w * k)),
    h: Math.max(1, Math.round(h * k)),
  };
}

/** Decode an uploaded image, downscale it, and re-encode as PNG (if it was PNG) or JPEG. */
export async function importImage(
  file: File,
): Promise<{ tex: TextureData; meta: Pick<TextureRef, "name" | "w" | "h"> }> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new ImageError("type");
  if (file.size > MAX_FILE_BYTES) throw new ImageError("size");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new ImageError("decode");
  }
  const { w, h } = fitWithin(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("decode");
  const mime: TextureRef["mime"] =
    file.type === "image/png" ? "image/png" : "image/jpeg";
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, mime, 0.88),
  );
  if (!blob) throw new ImageError("decode");
  const data = new Uint8Array(await blob.arrayBuffer());
  return { tex: { id: newId(), mime, data }, meta: { name: file.name, w, h } };
}
