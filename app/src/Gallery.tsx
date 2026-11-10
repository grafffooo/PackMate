import { useMemo, useState } from "react";
import { catalog, defaults, generate, templates } from "./core";
import { Thumb } from "./Thumb";
import { deleteDesign, designs, encodeParams, prefs, type SavedDesign } from "./store";
import { Trash } from "./icons";
import { format, type Unit } from "./units";

export function Gallery({ unit, open }: { unit: Unit; open: (hash: string) => void }) {
  const list = templates();
  const { machines } = catalog();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [machineId, setMachineId] = useState(prefs.machine());
  const [saved, setSaved] = useState<SavedDesign[]>(() => designs());
  const machine = machines.find((m) => m.id === machineId) ?? machines[0];

  const cats = ["All", ...new Set(list.map((t) => t.category))];
  const thumbs = useMemo(() => Object.fromEntries(list.map((t) => [t.id, generate(t.id, defaults(t))])), [list]);

  const shown = list.filter((t) => {
    if (cat !== "All" && t.category !== cat) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [t.name, t.description, t.category, ...t.tags].some((x) => x.toLowerCase().includes(s));
  });

  const fits = (w: number, h: number) => {
    if (!machine.w || !machine.h) return null;
    const uw = machine.w - 2 * machine.margin;
    const uh = machine.h - 2 * machine.margin;
    return (w <= uw && h <= uh) || (h <= uw && w <= uh);
  };

  return (
    <main className="gallery">
      <div className="hero">
        <div>
          <h1>What are you making today?</h1>
          <p>
            Pick a style, type your dimensions and get a cut-ready dieline for your Cricut, Brother ScanNCut, Silhouette or cutting plotter —
            with a live 3D preview.
          </p>
        </div>
        <label className="fitline" style={{ margin: 0 }}>
          <span style={{ color: "var(--muted)" }}>My machine</span>
          <select
            value={machine.id}
            onChange={(e) => {
              setMachineId(e.target.value);
              prefs.setMachine(e.target.value);
            }}
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filters">
        <input type="search" placeholder="Search boxes, bags, envelopes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search templates" />
        {cats.map((c) => (
          <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid">
        {shown.map((t) => {
          const g = thumbs[t.id];
          const f = fits(g.width, g.height);
          return (
            <button key={t.id} className="card" onClick={() => open(`#/edit/${t.id}`)}>
              <div className="thumb">
                <Thumb gen={g} />
              </div>
              <div className="body">
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <div className="meta">
                  <span className="tag">{t.category}</span>
                  {f !== null && (
                    <span className={`tag ${f ? "ok" : "warn"}`} title={`Default size: ${format(g.width, unit)} × ${format(g.height, unit)}`}>
                      {f ? "Fits your mat" : "Large — tiles"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {shown.length === 0 && <p style={{ color: "var(--muted)" }}>No templates match “{q}”.</p>}
      </div>

      {saved.length > 0 && (
        <>
          <h2 className="section-title">My designs</h2>
          <div className="saved">
            {saved.map((d) => {
              const t = list.find((x) => x.id === d.template);
              if (!t) return null;
              return (
                <div className="saved-item" key={d.id}>
                  <div className="grow" role="button" tabIndex={0} onClick={() => open(`#/edit/${d.template}?p=${encodeParams(d.params)}&d=${d.id}`)}>
                    <b>{d.name}</b>
                    <div>
                      {t.name} · {new Date(d.updated).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="btn ghost icon-btn"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => {
                      if (confirm(`Delete “${d.name}”?`)) {
                        deleteDesign(d.id);
                        setSaved(designs());
                      }
                    }}
                  >
                    <Trash />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
