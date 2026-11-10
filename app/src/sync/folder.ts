// A folder PackMate syncs through. Only the files PackMate owns are ever listed, read, written or removed.
export interface SyncFolder {
  readonly name: string;
  /** relative paths of recognised files (records, textures, tombstones) */
  list(): Promise<string[]>;
  read(path: string): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
}

export const SYNC_DIRS = [
  "folders",
  "projects",
  "materials",
  "textures",
  "deleted",
] as const;
const OWNED =
  /^(folders|projects|materials|deleted)\/[\w.-]+\.json$|^textures\/[\w.-]+\.(png|jpg)$/;
export const isOwned = (path: string) => OWNED.test(path);

/** In-memory folder, used by tests (and handy for trying the engine without a browser). */
export class MemoryFolder implements SyncFolder {
  files = new Map<string, Uint8Array>();
  constructor(public name = "memory") {}
  async list() {
    return [...this.files.keys()].filter(isOwned);
  }
  async read(path: string) {
    const b = this.files.get(path);
    if (!b) throw new Error("missing " + path);
    return b;
  }
  async write(path: string, bytes: Uint8Array) {
    if (!isOwned(path)) throw new Error("refusing to write " + path);
    this.files.set(path, bytes);
  }
  async remove(path: string) {
    if (isOwned(path)) this.files.delete(path);
  }
}

type DirHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>;
};

/** A folder chosen with the File System Access API (Chrome, Edge, and other Chromium browsers). */
export class FsFolder implements SyncFolder {
  constructor(public handle: FileSystemDirectoryHandle) {}
  get name() {
    return this.handle.name;
  }
  private async dir(name: string, create: boolean) {
    return this.handle.getDirectoryHandle(name, { create });
  }
  async list() {
    const out: string[] = [];
    for (const d of SYNC_DIRS) {
      let dir: DirHandle;
      try {
        dir = (await this.dir(d, false)) as DirHandle;
      } catch (e) {
        if ((e as DOMException).name === "NotFoundError") continue;
        throw e;
      }
      for await (const h of dir.values())
        if (h.kind === "file" && isOwned(`${d}/${h.name}`))
          out.push(`${d}/${h.name}`);
    }
    return out;
  }
  private split(path: string) {
    const i = path.indexOf("/");
    return [path.slice(0, i), path.slice(i + 1)] as const;
  }
  async read(path: string) {
    const [d, f] = this.split(path);
    const fh = await (await this.dir(d, false)).getFileHandle(f);
    return new Uint8Array(await (await fh.getFile()).arrayBuffer());
  }
  async write(path: string, bytes: Uint8Array) {
    if (!isOwned(path)) throw new Error("refusing to write " + path);
    const [d, f] = this.split(path);
    const fh = await (
      await this.dir(d, true)
    ).getFileHandle(f, { create: true });
    const w = await fh.createWritable();
    await w.write(bytes as BlobPart);
    await w.close();
  }
  async remove(path: string) {
    if (!isOwned(path)) return;
    const [d, f] = this.split(path);
    try {
      await (await this.dir(d, false)).removeEntry(f);
    } catch (e) {
      if ((e as DOMException).name !== "NotFoundError") throw e;
    }
  }
}

export function folderSyncSupported(): boolean {
  return (
    typeof (globalThis as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}
