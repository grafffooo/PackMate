import { unzipSync, zipSync, type Zippable } from "fflate";
import type { OutFile } from "../types";
import {
  fromFiles,
  toFiles,
  type Files,
  type LibraryData,
  type ParseResult,
} from "./bundle";
import { readLibrary, replaceLibrary, writeSide } from "./libraryIo";
import { planMerge } from "./merge";
import type { Repo } from "./repo";

export function backupName(now = new Date()): string {
  return `packmate-backup-${now.toISOString().slice(0, 10)}.packmate.zip`;
}

/** Pack a library into one zip. Images are already compressed, so they are stored as they are. */
export function zipLibrary(d: LibraryData, now = Date.now()): Uint8Array {
  const z: Zippable = {};
  for (const [path, bytes] of toFiles(d, now))
    z[path] = [bytes, { level: path.startsWith("textures/") ? 0 : 6 }];
  return zipSync(z);
}

export function unzipLibrary(bytes: Uint8Array): ParseResult {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("This file isn't a zip archive.");
  }
  const files: Files = new Map(
    Object.entries(entries).filter(([k]) => !k.endsWith("/")),
  );
  return fromFiles(files);
}

export async function createBackup(
  repo: Repo,
  now = new Date(),
): Promise<OutFile> {
  const bytes = zipLibrary(await readLibrary(repo), now.getTime());
  return { name: backupName(now), mime: "application/zip", bytes };
}

export type Summary = {
  projects: number;
  folders: number;
  materials: number;
  textures: number;
};
export const summarize = (d: LibraryData): Summary => ({
  projects: d.projects.length,
  folders: d.folders.length,
  materials: d.materials.length,
  textures: d.textures.length,
});

/** Restore by adding: newer records win, nothing is deleted except what the backup knows was deleted later. */
export async function restoreAdd(repo: Repo, data: LibraryData): Promise<void> {
  const plan = planMerge(await readLibrary(repo), data);
  await writeSide(repo, plan.a);
}

export async function restoreReplace(
  repo: Repo,
  data: LibraryData,
): Promise<void> {
  await replaceLibrary(repo, data);
}
