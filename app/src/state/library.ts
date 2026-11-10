import { createStore, type StoreApi } from "zustand/vanilla";
import type { Params } from "../types";
import { DEFAULT_MATERIAL_ID, builtinMaterials } from "../storage/seed";
import {
  migrateSettings,
  newId,
  type Folder,
  type Material,
  type Project,
  type Settings,
} from "../storage/model";
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
    const persistProject = async (id: string) => {
      const p = get().projects.find((x) => x.id === id);
      if (p) await repo.putProject(p);
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
          projects: snap.projects,
          materials,
          settings: snap.settings,
          selectedId,
        });
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
