import { createStore, type StoreApi } from "zustand/vanilla";
import type { LibraryState } from "../state/library";
import type { Repo } from "../storage/repo";
import { syncOnce } from "./engine";
import { FsFolder, folderSyncSupported, type SyncFolder } from "./folder";

export type SyncStatus =
  | { kind: "off" }
  | { kind: "needs-permission"; name: string }
  | { kind: "syncing"; name: string }
  | { kind: "ok"; name: string; at: number }
  | { kind: "error"; name: string; message: string };

export type SyncState = {
  supported: boolean;
  status: SyncStatus;
  /** open the system folder picker and start syncing with the chosen folder */
  choose(): Promise<void>;
  /** ask the browser again for access to the remembered folder (needs a click) */
  reconnect(): Promise<void>;
  stop(): Promise<void>;
  syncNow(): Promise<void>;
  start(): Promise<void>;
};

const KEY = "syncHandle";
const DEBOUNCE_MS = 3000;
const FOCUS_MIN_GAP_MS = 15000;

type PermHandle = FileSystemDirectoryHandle & {
  queryPermission(d: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(d: { mode: "readwrite" }): Promise<PermissionState>;
};

export function createSyncManager(
  repo: Repo,
  library: StoreApi<LibraryState>,
  opts: { open?: (h: FileSystemDirectoryHandle) => SyncFolder } = {},
): StoreApi<SyncState> {
  const open = opts.open ?? ((h) => new FsFolder(h));
  let handle: PermHandle | null = null;
  let running = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastRun = 0;
  let wired = false;

  const store = createStore<SyncState>((set, get) => {
    const name = () => handle?.name ?? "";

    const run = async () => {
      if (!handle) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        do {
          again = false;
          set({ status: { kind: "syncing", name: name() } });
          await library.getState().flush();
          const r = await syncOnce(repo, open(handle));
          if (r.pulled > 0) await library.getState().reload();
          set({ status: { kind: "ok", name: name(), at: Date.now() } });
        } while (again);
      } catch (e) {
        const err = e as DOMException;
        const denied =
          err?.name === "NotAllowedError" || err?.name === "SecurityError";
        set({
          status: denied
            ? { kind: "needs-permission", name: name() }
            : {
                kind: "error",
                name: name(),
                message: err?.message || String(e),
              },
        });
      } finally {
        running = false;
        lastRun = Date.now();
      }
    };

    const wire = () => {
      if (wired) return;
      wired = true;
      // after local edits: wait for things to go quiet, then sync
      let last = library.getState();
      library.subscribe((s) => {
        if (!handle || get().status.kind === "needs-permission") return;
        if (
          s.folders !== last.folders ||
          s.projects !== last.projects ||
          s.materials !== last.materials
        ) {
          clearTimeout(timer);
          timer = setTimeout(() => void run(), DEBOUNCE_MS);
        }
        last = s;
      });
      document.addEventListener("visibilitychange", () => {
        if (
          document.visibilityState === "visible" &&
          handle &&
          Date.now() - lastRun > FOCUS_MIN_GAP_MS &&
          get().status.kind !== "needs-permission"
        )
          void run();
      });
    };

    return {
      supported: folderSyncSupported(),
      status: { kind: "off" },

      async start() {
        if (!get().supported) return;
        const saved = await repo.getKv<PermHandle>(KEY);
        if (!saved) return;
        handle = saved;
        wire();
        const perm = await saved
          .queryPermission({ mode: "readwrite" })
          .catch(() => "denied" as const);
        if (perm === "granted") await run();
        else set({ status: { kind: "needs-permission", name: name() } });
      },

      async choose() {
        const picker = (
          globalThis as unknown as {
            showDirectoryPicker: (o: object) => Promise<PermHandle>;
          }
        ).showDirectoryPicker;
        let picked: PermHandle;
        try {
          picked = await picker({ id: "packmate-sync", mode: "readwrite" });
        } catch (e) {
          if ((e as DOMException).name === "AbortError") return;
          throw e;
        }
        handle = picked;
        await repo.putKv(KEY, picked);
        wire();
        await run();
      },

      async reconnect() {
        if (!handle) return;
        const perm = await handle
          .requestPermission({ mode: "readwrite" })
          .catch(() => "denied" as const);
        if (perm === "granted") await run();
      },

      async stop() {
        clearTimeout(timer);
        handle = null;
        await repo.deleteKv(KEY);
        set({ status: { kind: "off" } });
      },

      syncNow: run,
    };
  });
  return store;
}
