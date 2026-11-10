import { useEffect, useMemo, useState } from "react";
import { catalog, defaults, generate } from "./core";
import { DielineView, type Layers } from "./DielineView";
import { ExportDialog } from "./ExportDialog";
import { FoldView } from "./FoldView";
import { ParamForm } from "./ParamForm";
import { encodeParams, prefs, saveDesign } from "./store";
import type { Generated, Params, TemplateDef } from "./types";
import { formatLength, format, type Unit } from "./units";
import { Download, LinkIcon, Reset, Save } from "./icons";

type Props = {
  template: TemplateDef;
  initial: Params | null;
  designId?: string;
  designName?: string;
  unit: Unit;
  toast: (msg: string) => void;
};

type ViewMode = "both" | "3d" | "2d";

export function Editor({ template, initial, designId, designName, unit, toast }: Props) {
  const { materials, machines } = catalog();
  const [material, setMaterial] = useState(prefs.material());
  const [params, setParams] = useState<Params>(() => {
    const p = { ...defaults(template), ...(initial ?? {}) };
    if (!initial || initial.thickness === undefined) {
      const m = materials.find((x) => x.id === material);
      if (m && template.params.some((d) => d.id === "thickness")) p.thickness = m.thickness;
    }
    return p;
  });
  const [machineId, setMachineId] = useState(prefs.machine());
  const [mode, setMode] = useState<ViewMode>(() => (window.matchMedia("(max-width: 860px)").matches ? "3d" : "both"));
  const [layers, setLayers] = useState<Layers>({ cut: true, crease: true, glue: true, labels: true, mat: false });
  const [exporting, setExporting] = useState(false);
  const [savedId, setSavedId] = useState(designId);

  const gen: Generated | null = useMemo(() => {
    try {
      return generate(template.id, params);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [template.id, params]);

  // keep a shareable URL in the address bar
  useEffect(() => {
    const t = setTimeout(() => {
      history.replaceState(null, "", `#/edit/${template.id}?p=${encodeParams(params)}`);
    }, 300);
    return () => clearTimeout(t);
  }, [template.id, params]);

  const machine = machines.find((m) => m.id === machineId) ?? machines[0];
  const mat = useMemo(() => {
    if (!gen || !machine.w || !machine.h) return null;
    const uw = machine.w - 2 * machine.margin;
    const uh = machine.h - 2 * machine.margin;
    const normal = gen.width <= uw && gen.height <= uh;
    const rotated = gen.height <= uw && gen.width <= uh;
    return { w: uw, h: uh, fits: normal || rotated, rotated: !normal && rotated };
  }, [gen, machine]);

  const onMachine = (id: string) => {
    setMachineId(id);
    prefs.setMachine(id);
  };
  const onMaterial = (id: string) => {
    setMaterial(id);
    if (id !== "custom") prefs.setMaterial(id);
  };

  const share = async () => {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied — it opens this exact design");
    } catch {
      prompt("Copy this link", url);
    }
  };

  const doSave = () => {
    const suggestion = designName ?? `${template.name} ${format(Number(params.length ?? params.width ?? 0), unit, false)}`;
    const name = prompt("Name this design", suggestion);
    if (!name) return;
    const rec = saveDesign({ id: savedId, name, template: template.id, params });
    setSavedId(rec.id);
    toast("Saved to My designs");
  };

  const views = mode === "both" ? ["3d", "2d"] : [mode];

  return (
    <div className="editor">
      <aside className="sidebar">
        <h2>{template.name}</h2>
        <p className="desc">{template.description}</p>
        <ParamForm
          defs={template.params}
          params={params}
          unit={unit}
          materials={materials}
          material={material}
          onMaterial={onMaterial}
          onChange={setParams}
        />

        {gen && (
          <>
            <div className="stats">
              <div className="stat">
                <div>Flat size</div>
                <b>
                  {format(gen.width, unit, false)} × {format(gen.height, unit)}
                </b>
              </div>
              <div className="stat">
                <div>Cut / crease</div>
                <b>
                  {formatLength(gen.cut_length, unit)} / {formatLength(gen.crease_length, unit)}
                </b>
              </div>
            </div>
            <div className="fitline">
              <select value={machine.id} onChange={(e) => onMachine(e.target.value)} aria-label="Your machine" style={{ flex: 1 }}>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {mat &&
                (mat.fits ? (
                  <span className="tag ok">Fits{mat.rotated ? " rotated" : ""}</span>
                ) : (
                  <span className="tag warn">Needs tiling</span>
                ))}
            </div>
            {gen.warnings.map((w, i) => (
              <div className="notice" key={i}>
                {w}
              </div>
            ))}
          </>
        )}
        <div className="side-actions">
          <button className="btn primary" onClick={() => setExporting(true)} disabled={!gen}>
            <Download /> Export
          </button>
          <button className="btn" onClick={doSave}>
            <Save /> Save
          </button>
          <button className="btn" onClick={share} title="Copy share link">
            <LinkIcon /> Link
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              const p = defaults(template);
              const m = materials.find((x) => x.id === material);
              if (m) p.thickness = m.thickness;
              setParams(p);
            }}
            title="Reset to defaults"
          >
            <Reset /> Reset
          </button>
        </div>
      </aside>

      <section className="stage">
        <div className="stage-bar">
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={mode === "both"} onClick={() => setMode("both")} className="desktop-only">
              Split
            </button>
            <button aria-pressed={mode === "3d"} onClick={() => setMode("3d")}>
              3D preview
            </button>
            <button aria-pressed={mode === "2d"} onClick={() => setMode("2d")}>
              Dieline
            </button>
          </div>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn small primary mobile-only" onClick={() => setExporting(true)} disabled={!gen}>
            <Download /> Export
          </button>
        </div>
        <div className={`views ${views.length === 1 ? "single" : ""}`}>
          {!gen && <div className="loading">Could not generate this design.</div>}
          {gen &&
            views.map((v) =>
              v === "3d" ? (
                <div className="view" key="3d">
                  <FoldView gen={gen} resetKey={template.id} />
                </div>
              ) : (
                <div className="view" key="2d">
                  <DielineView
                    gen={gen}
                    unit={unit}
                    layers={layers}
                    onLayers={setLayers}
                    mat={mat ? (mat.rotated ? { w: mat.h, h: mat.w } : { w: mat.w, h: mat.h }) : null}
                    resetKey={template.id}
                  />
                </div>
              ),
            )}
        </div>
      </section>

      {exporting && (
        <ExportDialog
          template={template}
          params={params}
          unit={unit}
          machineId={machineId}
          onMachine={onMachine}
          onClose={() => setExporting(false)}
          toast={toast}
        />
      )}
    </div>
  );
}
