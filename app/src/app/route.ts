import { useEffect, useState } from "react";

export type SettingsSection = "general" | "appearance" | "language";
export const SETTINGS_SECTIONS: SettingsSection[] = [
  "general",
  "appearance",
  "language",
];

export type Route =
  | { name: "home" }
  | { name: "new"; folder: string | null }
  | { name: "export" }
  | { name: "materials"; id: string | null }
  | { name: "settings"; section: SettingsSection };

/** Dialogs are hash routes, so the app works on GitHub Pages and behind any proxy without server rewrites. */
export function parseHash(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const q = new URLSearchParams(query);
  switch (parts[0]) {
    case "new":
      return { name: "new", folder: q.get("folder") };
    case "export":
      return { name: "export" };
    case "materials":
      return {
        name: "materials",
        id: parts[1] ? decodeURIComponent(parts[1]) : null,
      };
    case "settings": {
      const s = parts[1] as SettingsSection | undefined;
      return {
        name: "settings",
        section: s && SETTINGS_SECTIONS.includes(s) ? s : "general",
      };
    }
    default:
      return { name: "home" };
  }
}

export function hashOf(r: Route): string {
  switch (r.name) {
    case "new":
      return r.folder
        ? `#/new?folder=${encodeURIComponent(r.folder)}`
        : "#/new";
    case "export":
      return "#/export";
    case "materials":
      return r.id ? `#/materials/${encodeURIComponent(r.id)}` : "#/materials";
    case "settings":
      return r.section === "general" ? "#/settings" : `#/settings/${r.section}`;
    default:
      return "#/";
  }
}

export function go(r: Route) {
  const h = hashOf(r);
  if (location.hash !== h) location.hash = h;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
