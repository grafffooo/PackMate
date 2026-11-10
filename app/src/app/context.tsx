import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStore, type StoreApi } from "zustand";
import {
  detectLang,
  makeT,
  type Lang,
  type TFn,
  type TPluralFn,
} from "../i18n";
import type { LibraryState } from "../state/library";
import { applyTheme, resolveScheme, type Scheme } from "../theme/palettes";

const Ctx = createContext<StoreApi<LibraryState> | null>(null);

export function LibraryProvider({
  store,
  children,
}: {
  store: StoreApi<LibraryState>;
  children: ReactNode;
}) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useLibraryStore(): StoreApi<LibraryState> {
  const s = useContext(Ctx);
  if (!s) throw new Error("LibraryProvider missing");
  return s;
}

export function useLib<T>(selector: (s: LibraryState) => T): T {
  return useStore(useLibraryStore(), selector);
}

/** Actions without subscribing to state changes. */
export function useActions(): LibraryState {
  return useLibraryStore().getState();
}

export function useSystemDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(
    () => typeof matchMedia === "function" && matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(query);
    const on = () => setDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

export function useScheme(): Scheme {
  const pref = useLib((s) => s.settings.scheme);
  const sys = useSystemDark();
  return resolveScheme(pref, sys);
}

/** Keep the document's CSS variables in sync with the chosen accent and colour scheme. */
export function useThemeEffect() {
  const accent = useLib((s) => s.settings.accent);
  const scheme = useScheme();
  useEffect(() => applyTheme(accent, scheme), [accent, scheme]);
}

export function useLang(): Lang {
  const pref = useLib((s) => s.settings.lang);
  return pref === "system"
    ? detectLang(
        typeof navigator !== "undefined" ? navigator.languages : undefined,
      )
    : pref;
}

export function useI18n(): { lang: Lang; t: TFn; tp: TPluralFn } {
  const lang = useLang();
  const fns = useMemo(() => makeT(lang), [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return { lang, ...fns };
}

// ---------- sync ----------
import type { SyncState } from "../sync/manager";

const SyncCtx = createContext<StoreApi<SyncState> | null>(null);

export function SyncProvider({
  store,
  children,
}: {
  store: StoreApi<SyncState>;
  children: ReactNode;
}) {
  return <SyncCtx.Provider value={store}>{children}</SyncCtx.Provider>;
}

export function useSync<T>(selector: (s: SyncState) => T): T {
  const s = useContext(SyncCtx);
  if (!s) throw new Error("SyncProvider missing");
  return useStore(s, selector);
}

/** Sync actions without subscribing to status changes. */
export function useSyncActions(): SyncState {
  const s = useContext(SyncCtx);
  if (!s) throw new Error("SyncProvider missing");
  return s.getState();
}
