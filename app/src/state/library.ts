import { createStore, type StoreApi } from "zustand/vanilla";
import type { Params } from "../types";
import { DEFAULT_MATERIAL_ID, builtinMaterials } from "../storage/seed";
import {
  migrateSettings,
  newId,
  tombstoneKey,
  type Folder,
  type Material,
  type Project,
  type RecordKind,
  type Settings,
  type TextureData,
  type TextureRef,
} from "../storage/model";
import { pruneTextures } from "../storage/libraryIo";
import type { Repo } from "../storage/repo";

export type NewProject = {
  template: string;
  name: string;
  folderId?: string | null;
  params: Params;
  materialId?: string;
};

export type LibraryState = {
  ready: boolean;
  persistence: "indexeddb" | "memory" | null;
  folders: Folder[];
  projects: Project[];
  materials: Material[];
  settings: Settings;
  selectedId: string | null;

  init(): Promise<void>;
  loadTexture(id: string): Promise<TextureData | undefined>;
  /** re-read everything from the database (after a restore or a sync) */
  reload(): Promise<void>;
  createMaterial(
    input?: Partial<Pick<Material, "name" | "thickness" | "gsm" | "color">>,
  ): Promise<Material>;
  updateMaterial(
    id: string,
    patch: Partial<Pick<Material, "name" | "thickness" | "gsm" | "color">>,
  ): void;
  duplicateMaterial(id: string): Promise<Material | null>;
  deleteMaterial(id: string): Promise<void>;
  setTexture(
    materialId: string,
    face: "out" | "in",
    tex: TextureData,
    meta: Pick<TextureRef, "name" | "w" | "h">,
  ): Promise<void>;
  clearTexture(materialId: string, face: "out" | "in"): Promise<void>;
  createFolder(name: string): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  createProject(input: NewProject): Promise<Project>;
  updateProject(
    id: string,
    patch: Partial<
      Pick<Project, "name" | "params" | "materialId" | "folderId">
    >,
  ): void;
  duplicateProject(id: string): Promise<Project | null>;
  deleteProject(id: string): Promise<void>;
  select(id: string | null): void;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  /** write any pending (debounced) edits now */
  flush(): Promise<void>;
};

/** "Mailer Box", then "Mailer Box 2", "Mailer Box 3"… */
export function uniqueName(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const n = `${base} ${i}`;
    if (!taken.has(n)) return n;
  }
}

const SAVE_DELAY_MS = 250;

export function createLibrary(
  repo: Repo,
  opts: { saveDelay?: number; now?: () => number } = {},
): StoreApi<LibraryState> {
  const delay = opts.saveDelay ?? SAVE_DELAY_MS;
  const now = opts.now ?? (() => Date.now());
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  const store = createStore<LibraryState>((set, get) => {
    const persist = async (key: string) => {
      if (key.startsWith("m:")) {
        const m = get().materials.find((x) => x.id === key.slice(2));
        if (m) await repo.putMaterial(m);
      } else {
        const p = get().projects.find((x) => x.id === key);
        if (p) await repo.putProject(p);
      }
    };
    const persistProject = persist;
    const bury = async (kind: RecordKind, id: string) => {
      await repo.putTombstone({
        key: tombstoneKey(kind, id),
        kind,
        id,
        deletedAt: now(),
      });
    };
    const putMaterial = async (m: Material) => {
      set((s) => ({
        materials: s.materials.map((x) => (x.id === m.id ? m : x)),
      }));
      await repo.putMaterial(m);
    };

    return {
      ready: false,
      persistence: null,
      folders: [],
      projects: [],
      materials: [],
      settings: migrateSettings(undefined),
      selectedId: null,

      async init() {
        const snap = await repo.load();
        let materials = snap.materials;
        if (!snap.seeded && materials.length === 0) {
          materials = builtinMaterials(now());
          for (const m of materials) await repo.putMaterial(m);
          await repo.markSeeded();
        }
        const last = snap.settings.lastProjectId;
        const selectedId = snap.projects.some((p) => p.id === last)
          ? last
          : (snap.projects[0]?.id ?? null);
        set({
          ready: true,
          persistence: repo.kind,
          folders: snap.folders,
          projects: withoutOrphans(snap.folders, snap.projects),
          materials,
          settings: snap.settings,
          selectedId,
        });
      },

      loadTexture: (id) => repo.getTexture(id),

      async reload() {
        await get().flush();
        const snap = await repo.load();
        const sel = snap.projects.some((p) => p.id === get().selectedId)
          ? get().selectedId
          : (snap.projects[0]?.id ?? null);
        set({
          folders: snap.folders,
          projects: withoutOrphans(snap.folders, snap.projects),
          materials: snap.materials,
          settings: snap.settings,
          selectedId: sel,
        });
      },

      async createMaterial(input = {}) {
        const t = now();
        const m: Material = {
          id: newId(),
          name: uniqueName(
            input.name?.trim() || "New material",
            get().materials.map((x) => x.name),
          ),
          thickness: input.thickness ?? 0.4,
          gsm: input.gsm ?? null,
          color: input.color ?? "#d8c8ad",
          createdAt: t,
          updatedAt: t,
        };
        set((s) => ({ materials: [...s.materials, m] }));
        await repo.putMaterial(m);
        return m;
      },

      updateMaterial(id, patch) {
        const m = get().materials.find((x) => x.id === id);
        if (!m) return;
        const next: Material = { ...m, ...patch, updatedAt: now() };
        set((s) => ({
          materials: s.materials.map((x) => (x.id === id ? next : x)),
        }));
        const key = "m:" + id;
        const old = pending.get(key);
        if (old) clearTimeout(old);
        pending.set(
          key,
          setTimeout(() => {
            pending.delete(key);
            void persist(key);
          }, delay),
        );
      },

      async duplicateMaterial(id) {
        const m = get().materials.find((x) => x.id === id);
        if (!m) return null;
        await get().flush();
        const copy = await get().createMaterial({
          name: m.name,
          thickness: m.thickness,
          gsm: m.gsm,
          color: m.color,
        });
        // textures are immutable, so the copy can share them until one side replaces its image
        if (m.textures)
          await putMaterial({ ...copy, textures: { ...m.textures } });
        return get().materials.find((x) => x.id === copy.id) ?? copy;
      },

      async deleteMaterial(id) {
        const timer = pending.get("m:" + id);
        if (timer) {
          clearTimeout(timer);
          pending.delete("m:" + id);
        }
        const rest = get().materials.filter((m) => m.id !== id);
        const fallback =
          rest.find((m) => m.id === DEFAULT_MATERIAL_ID) ?? rest[0];
        const moved = get()
          .projects.filter((p) => p.materialId === id)
          .map((p) => ({
            ...p,
            materialId: fallback?.id ?? DEFAULT_MATERIAL_ID,
            updatedAt: now(),
          }));
        set((s) => ({
          materials: rest,
          projects: s.projects.map(
            (p) => moved.find((x) => x.id === p.id) ?? p,
          ),
        }));
        if (moved.length) await repo.putProjects(moved);
        await repo.deleteMaterial(id);
        await bury("material", id);
        await pruneTextures(repo);
      },

      async setTexture(materialId, face, tex, meta) {
        const m = get().materials.find((x) => x.id === materialId);
        if (!m) return;
        await repo.putTexture(tex);
        await putMaterial({
          ...m,
          updatedAt: now(),
          textures: {
            ...m.textures,
            [face]: { id: tex.id, mime: tex.mime, ...meta },
          },
        });
        await pruneTextures(repo);
      },

      async clearTexture(materialId, face) {
        const m = get().materials.find((x) => x.id === materialId);
        if (!m?.textures?.[face]) return;
        const textures = { ...m.textures };
        delete textures[face];
        await putMaterial({ ...m, updatedAt: now(), textures });
        await pruneTextures(repo);
      },

      async createFolder(name) {
        const t = now();
        const order =
          get().folders.reduce((m, f) => Math.max(m, f.order), -1) + 1;
        const f: Folder = {
          id: newId(),
          name: name.trim() || "Untitled folder",
          order,
          createdAt: t,
          updatedAt: t,
        };
        set((s) => ({ folders: [...s.folders, f] }));
        await repo.putFolder(f);
        return f;
      },

      async renameFolder(id, name) {
        const clean = name.trim();
        if (!clean) return;
        const f = get().folders.find((x) => x.id === id);
        if (!f) return;
        const next = { ...f, name: clean, updatedAt: now() };
        set((s) => ({
          folders: s.folders.map((x) => (x.id === id ? next : x)),
        }));
        await repo.putFolder(next);
      },

      async deleteFolder(id) {
        // dielines are never deleted with their folder: they move out of it
        const moved = get()
          .projects.filter((p) => p.folderId === id)
          .map((p) => ({ ...p, folderId: null, updatedAt: now() }));
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          projects: s.projects.map((p) =>
            p.folderId === id ? { ...p, folderId: null } : p,
          ),
        }));
        if (moved.length) await repo.putProjects(moved);
        await repo.deleteFolder(id);
        await bury("folder", id);
      },

      async createProject(input) {
        const t = now();
        const name = uniqueName(
          input.name,
          get().projects.map((p) => p.name),
        );
        const p: Project = {
          id: newId(),
          name,
          folderId: input.folderId ?? null,
          template: input.template,
          params: input.params,
          materialId: input.materialId ?? DEFAULT_MATERIAL_ID,
          createdAt: t,
          updatedAt: t,
        };
        set((s) => ({ projects: [...s.projects, p], selectedId: p.id }));
        await repo.putProject(p);
        await get().updateSettings({ lastProjectId: p.id });
        return p;
      },

      updateProject(id, patch) {
        const p = get().projects.find((x) => x.id === id);
        if (!p) return;
        const next: Project = { ...p, ...patch, updatedAt: now() };
        set((s) => ({
          projects: s.projects.map((x) => (x.id === id ? next : x)),
        }));
        // typing in a field produces many updates: write once things go quiet
        const old = pending.get(id);
        if (old) clearTimeout(old);
        pending.set(
          id,
          setTimeout(() => {
            pending.delete(id);
            void persistProject(id);
          }, delay),
        );
      },

      async duplicateProject(id) {
        const p = get().projects.find((x) => x.id === id);
        if (!p) return null;
        await get().flush();
        const copy = await get().createProject({
          template: p.template,
          name: p.name,
          folderId: p.folderId,
          params: { ...p.params },
          materialId: p.materialId,
        });
        return copy;
      },

      async deleteProject(id) {
        const timer = pending.get(id);
        if (timer) {
          clearTimeout(timer);
          pending.delete(id);
        }
        const rest = get().projects.filter((p) => p.id !== id);
        const wasSelected = get().selectedId === id;
        set({
          projects: rest,
          selectedId: wasSelected ? (rest[0]?.id ?? null) : get().selectedId,
        });
        await repo.deleteProject(id);
        await bury("project", id);
        if (wasSelected)
          await get().updateSettings({ lastProjectId: get().selectedId });
      },

      select(id) {
        set({ selectedId: id });
        void get().updateSettings({ lastProjectId: id });
      },

      async updateSettings(patch) {
        const next = migrateSettings({ ...get().settings, ...patch });
        set({ settings: next });
        await repo.putSettings(next);
      },

      async flush() {
        const ids = [...pending.keys()];
        for (const id of ids) {
          clearTimeout(pending.get(id));
          pending.delete(id);
        }
        await Promise.all(ids.map((id) => persistProject(id)));
      },
    };
  });
  return store;
}

// ---------- selectors ----------

/** A project whose folder was deleted elsewhere (another device) shows up unfiled instead of vanishing. */
export function withoutOrphans(
  folders: Folder[],
  projects: Project[],
): Project[] {
  const ids = new Set(folders.map((f) => f.id));
  return projects.map((p) =>
    p.folderId && !ids.has(p.folderId) ? { ...p, folderId: null } : p,
  );
}

export function sortedFolders(folders: Folder[]): Folder[] {
  return [...folders].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
}

export function projectsIn(
  projects: Project[],
  folderId: string | null,
): Project[] {
  return projects
    .filter((p) => p.folderId === folderId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
