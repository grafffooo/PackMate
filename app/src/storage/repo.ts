import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  DEFAULT_SETTINGS,
  migrateSettings,
  SCHEMA_VERSION,
  type Folder,
  type Material,
  type Project,
  type Settings,
  type TextureData,
  type Tombstone,
} from "./model";

export type Snapshot = {
  folders: Folder[];
  projects: Project[];
  materials: Material[];
  settings: Settings;
  seeded: boolean;
};

/** Persistence boundary. Everything the app stores goes through this. */
export interface Repo {
  readonly kind: "indexeddb" | "memory";
  load(): Promise<Snapshot>;
  putFolder(f: Folder): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  putProject(p: Project): Promise<void>;
  putProjects(ps: Project[]): Promise<void>;
  deleteProject(id: string): Promise<void>;
  putMaterial(m: Material): Promise<void>;
  deleteMaterial(id: string): Promise<void>;
  putSettings(s: Settings): Promise<void>;
  putTexture(t: TextureData): Promise<void>;
  getTexture(id: string): Promise<TextureData | undefined>;
  allTextures(): Promise<TextureData[]>;
  deleteTexture(id: string): Promise<void>;
  putTombstone(t: Tombstone): Promise<void>;
  listTombstones(): Promise<Tombstone[]>;
  /** remove folders, projects, materials, textures and tombstones (settings stay) */
  clearLibrary(): Promise<void>;
  markSeeded(): Promise<void>;
  /** remove everything (used by "replace everything" restore later, and by tests) */
  clear(): Promise<void>;
}

interface PackDB extends DBSchema {
  folders: { key: string; value: Folder };
  projects: { key: string; value: Project; indexes: { byFolder: string } };
  materials: { key: string; value: Material };
  kv: { key: string; value: unknown };
  textures: { key: string; value: TextureData };
  tombstones: { key: string; value: Tombstone };
}

const DB_NAME = "packmate";

export class IdbRepo implements Repo {
  readonly kind = "indexeddb" as const;
  private db: Promise<IDBPDatabase<PackDB>>;

  constructor(name = DB_NAME) {
    this.db = openDB<PackDB>(name, SCHEMA_VERSION, {
      upgrade(db, oldVersion) {
        // Each version adds a step; existing records are never touched by an upgrade.
        if (oldVersion < 1) {
          db.createObjectStore("folders", { keyPath: "id" });
          const projects = db.createObjectStore("projects", { keyPath: "id" });
          projects.createIndex("byFolder", "folderId");
          db.createObjectStore("materials", { keyPath: "id" });
          db.createObjectStore("kv");
        }
        if (oldVersion < 2) {
          db.createObjectStore("textures", { keyPath: "id" });
          db.createObjectStore("tombstones", { keyPath: "key" });
        }
      },
    });
  }

  async load(): Promise<Snapshot> {
    const db = await this.db;
    const [folders, projects, materials, settings, seeded] = await Promise.all([
      db.getAll("folders"),
      db.getAll("projects"),
      db.getAll("materials"),
      db.get("kv", "settings"),
      db.get("kv", "seeded"),
    ]);
    return {
      folders,
      projects,
      materials,
      settings: migrateSettings(settings),
      seeded: seeded === true,
    };
  }
  async putFolder(f: Folder) {
    await (await this.db).put("folders", f);
  }
  async deleteFolder(id: string) {
    await (await this.db).delete("folders", id);
  }
  async putProject(p: Project) {
    await (await this.db).put("projects", p);
  }
  async putProjects(ps: Project[]) {
    const tx = (await this.db).transaction("projects", "readwrite");
    await Promise.all([...ps.map((p) => tx.store.put(p)), tx.done]);
  }
  async deleteProject(id: string) {
    await (await this.db).delete("projects", id);
  }
  async putMaterial(m: Material) {
    await (await this.db).put("materials", m);
  }
  async deleteMaterial(id: string) {
    await (await this.db).delete("materials", id);
  }
  async putSettings(s: Settings) {
    await (await this.db).put("kv", s, "settings");
  }
  async markSeeded() {
    await (await this.db).put("kv", true, "seeded");
  }
  async putTexture(t: TextureData) {
    await (await this.db).put("textures", t);
  }
  async getTexture(id: string) {
    return (await this.db).get("textures", id);
  }
  async allTextures() {
    return (await this.db).getAll("textures");
  }
  async deleteTexture(id: string) {
    await (await this.db).delete("textures", id);
  }
  async putTombstone(t: Tombstone) {
    await (await this.db).put("tombstones", t);
  }
  async listTombstones() {
    return (await this.db).getAll("tombstones");
  }
  async clearLibrary() {
    const db = await this.db;
    const names = [
      "folders",
      "projects",
      "materials",
      "textures",
      "tombstones",
    ] as const;
    const tx = db.transaction([...names], "readwrite");
    await Promise.all([
      ...names.map((n) => tx.objectStore(n).clear()),
      tx.done,
    ]);
  }
  async clear() {
    const db = await this.db;
    const tx = db.transaction(
      ["folders", "projects", "materials", "kv", "textures", "tombstones"],
      "readwrite",
    );
    await Promise.all([
      tx.objectStore("folders").clear(),
      tx.objectStore("projects").clear(),
      tx.objectStore("materials").clear(),
      tx.objectStore("kv").clear(),
      tx.objectStore("textures").clear(),
      tx.objectStore("tombstones").clear(),
      tx.done,
    ]);
  }
}

/** Used when IndexedDB is unavailable (some private modes). Data lasts until the tab closes. */
export class MemoryRepo implements Repo {
  readonly kind = "memory" as const;
  private folders = new Map<string, Folder>();
  private projects = new Map<string, Project>();
  private materials = new Map<string, Material>();
  private textures = new Map<string, TextureData>();
  private tombstones = new Map<string, Tombstone>();
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private seeded = false;

  async load(): Promise<Snapshot> {
    return {
      folders: [...this.folders.values()],
      projects: [...this.projects.values()],
      materials: [...this.materials.values()],
      settings: this.settings,
      seeded: this.seeded,
    };
  }
  async putFolder(f: Folder) {
    this.folders.set(f.id, f);
  }
  async deleteFolder(id: string) {
    this.folders.delete(id);
  }
  async putProject(p: Project) {
    this.projects.set(p.id, p);
  }
  async putProjects(ps: Project[]) {
    ps.forEach((p) => this.projects.set(p.id, p));
  }
  async deleteProject(id: string) {
    this.projects.delete(id);
  }
  async putMaterial(m: Material) {
    this.materials.set(m.id, m);
  }
  async deleteMaterial(id: string) {
    this.materials.delete(id);
  }
  async putSettings(s: Settings) {
    this.settings = s;
  }
  async markSeeded() {
    this.seeded = true;
  }
  async putTexture(t: TextureData) {
    this.textures.set(t.id, t);
  }
  async getTexture(id: string) {
    return this.textures.get(id);
  }
  async allTextures() {
    return [...this.textures.values()];
  }
  async deleteTexture(id: string) {
    this.textures.delete(id);
  }
  async putTombstone(t: Tombstone) {
    this.tombstones.set(t.key, t);
  }
  async listTombstones() {
    return [...this.tombstones.values()];
  }
  async clearLibrary() {
    this.folders.clear();
    this.projects.clear();
    this.materials.clear();
    this.textures.clear();
    this.tombstones.clear();
  }
  async clear() {
    await this.clearLibrary();
    this.projects.clear();
    this.settings = { ...DEFAULT_SETTINGS };
    this.seeded = false;
  }
}

/** Open IndexedDB; fall back to memory if it is blocked or missing. */
export async function openRepo(): Promise<Repo> {
  try {
    if (typeof indexedDB === "undefined") return new MemoryRepo();
    const repo = new IdbRepo();
    await repo.load(); // fails here (not later) if storage is blocked
    return repo;
  } catch {
    return new MemoryRepo();
  }
}
