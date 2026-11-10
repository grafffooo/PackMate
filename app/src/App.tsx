import { useCallback, useEffect, useState } from "react";
import { loadCore, templates } from "./core";
import { Editor } from "./Editor";
import { Gallery } from "./Gallery";
import { Back, Logo } from "./icons";
import { decodeParams, designs, prefs } from "./store";
import type { Unit } from "./units";

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return hash;
}

function parseRoute(hash: string) {
  const m = hash.match(/^#\/edit\/([\w-]+)(?:\?(.*))?$/);
  if (!m) return { page: "gallery" as const };
  const q = new URLSearchParams(m[2] ?? "");
  const p = q.get("p");
  return { page: "edit" as const, id: m[1], params: p ? decodeParams(p) : null, design: q.get("d") ?? undefined };
}

export function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>(prefs.unit());
  const [toastMsg, setToast] = useState<string | null>(null);
  const hash = useHash();

  useEffect(() => {
    loadCore().then(
      () => setReady(true),
      (e) => setErr(String(e)),
    );
  }, []);

  const toast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? null : m)), 2600);
  }, []);

  const open = (h: string) => {
    location.hash = h;
    window.scrollTo(0, 0);
  };

  const route = parseRoute(hash);
  const template = ready && route.page === "edit" ? templates().find((t) => t.id === route.id) : undefined;
  const design = route.page === "edit" && route.design ? designs().find((d) => d.id === route.design) : undefined;

  return (
    <>
      <header className="topbar">
        {route.page === "edit" && (
          <button className="btn ghost icon-btn" onClick={() => open("#/")} aria-label="Back to gallery">
            <Back />
          </button>
        )}
        <button className="brand" onClick={() => open("#/")}>
          <Logo />
          <span className={route.page === "edit" ? "hide-sm" : ""}>PackMate</span>
        </button>
        {template && (
          <span className="crumb">
            / <b>{design?.name ?? template.name}</b>
          </span>
        )}
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Units">
          {(["mm", "in"] as Unit[]).map((u) => (
            <button
              key={u}
              aria-pressed={unit === u}
              onClick={() => {
                setUnit(u);
                prefs.setUnit(u);
              }}
            >
              {u}
            </button>
          ))}
        </div>
      </header>

      {err && <div className="loading">Failed to load the geometry engine: {err}</div>}
      {!ready && !err && <div className="loading">Loading…</div>}
      {ready && route.page === "gallery" && <Gallery unit={unit} open={open} />}
      {ready && route.page === "edit" && !template && <div className="loading">Unknown template “{route.id}”.</div>}
      {ready && template && route.page === "edit" && (
        <Editor
          key={template.id + (route.design ?? "")}
          template={template}
          initial={route.params}
          designId={design?.id}
          designName={design?.name}
          unit={unit}
          toast={toast}
        />
      )}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </>
  );
}
