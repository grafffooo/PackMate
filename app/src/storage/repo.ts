import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  DEFAULT_SETTINGS,
  migrateSettings,
  SCHEMA_VERSION,
  type Folder,
  type Material,
  type Project,
  type Settings,
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
  markSeeded(): Promise<void>;
  /** remove everything (used by "replace everything" restore later, and by tests) */
  clear(): Promise<void>;
}

interface PackDB extends DBSchema {
  folders: { key: string; value: Folder };
  projects: { key: string; value: Project; indexes: { byFolder: string } };
  materials: { key: string; value: Material };
  kv: { key: string; value: unknown };
}

const DB_NAME = "packmate";

export class IdbRepo implements Repo {
  readonly kind = "indexeddb" as const;
  private db: Promise<IDBPDatabase<PackDB>>;

  constructor(name = DB_NAME) {
    this.db = openDB<PackDB>(name, SCHEMA_VERSION, {
      upgrade(db, oldVersion) {
        // version 1: initial layout. Future versions add `if (oldVersion < 2) { … }` steps here.
        if (oldVersion < 1) {
          db.createObjectStore("folders", { keyPath: "id" });
          const projects = db.createObjectStore("projects", { keyPath: "id" });
          projects.createIndex("byFolder", "folderId");
          db.createObjectStore("materials", { keyPath: "id" });
          db.createObjectStore("kv");
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
  async clear() {
    const db = await this.db;
    const tx = db.transaction(
      ["folders", "projects", "materials", "kv"],
      "readwrite",
    );
    await Promise.all([
      tx.objectStore("folders").clear(),
      tx.objectStore("projects").clear(),
      tx.objectStore("materials").clear(),
      tx.objectStore("kv").clear(),
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
  async clear() {
    this.folders.clear();
    this.projects.clear();
    this.materials.clear();
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
