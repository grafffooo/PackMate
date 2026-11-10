import { useEffect, useMemo, useState } from "react";
import { catalog, exportFiles, fit } from "./core";
import { saveFiles, shareFiles, isTauri } from "./save";
import type { CreaseMode, Format, Params, TemplateDef } from "./types";
import { Close, Download } from "./icons";
import { format as fmtLen, type Unit } from "./units";

type Props = {
  template: TemplateDef;
  params: Params;
  unit: Unit;
  machineId: string;
  onMachine: (id: string) => void;
  onClose: () => void;
  toast: (msg: string) => void;
};

const FORMATS: { id: Format; name: string; note: string }[] = [
  { id: "svg", name: "SVG", note: "Cricut, ScanNCut, Silhouette, Inkscape" },
  { id: "pdf", name: "PDF", note: "Print shops, Illustrator — layered" },
  { id: "dxf", name: "DXF", note: "Plotters, laser cutters, CAD" },
];

export function ExportDialog({ template, params, unit, machineId, onMachine, onClose, toast }: Props) {
  const { machines } = catalog();
  const machine = machines.find((m) => m.id === machineId) ?? machines[0];
  const [fmt, setFmt] = useState<Format>("svg");
  const [crease, setCrease] = useState<CreaseMode>(machine.crease);
  const [dash, setDash] = useState(2);
  const [gap, setGap] = useState(2);
  const [copies, setCopies] = useState(1);
  const [name, setName] = useState(template.id);
  const [busy, setBusy] = useState(false);

  useEffect(() => setCrease(machine.crease), [machine.id, machine.crease]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sheet = machine.w && machine.h ? { w: machine.w, h: machine.h, margin: machine.margin } : null;
  const info = useMemo(() => (sheet ? fit(template.id, params, sheet) : null), [template.id, params, sheet?.w, sheet?.h, sheet?.margin]);
  const groups = [...new Set(machines.map((m) => m.group))];

  const opts = () => ({
    format: fmt,
    name,
    crease_mode: crease,
    dash,
    gap,
    sheet,
    copies,
    spacing: 4,
    tile_overlap: 10,
  });

  const run = async (share: boolean) => {
    setBusy(true);
    try {
      const files = exportFiles(template.id, params, opts());
      if (share && (await shareFiles(files))) {
        toast("Shared");
      } else {
        const n = await saveFiles(files);
        if (n) toast(n === 1 ? `Saved ${files[0].name}` : `Saved ${n} files`);
      }
      onClose();
    } catch (e) {
      toast(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const canShare = !isTauri() && typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator;

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="exp-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="exp-title">Export cut file</h2>
          <button className="btn ghost icon-btn" onClick={onClose} aria-label="Close">
            <Close />
          </button>
        </header>

        <div className="formats" role="group" aria-label="Format">
          {FORMATS.map((f) => (
            <button key={f.id} className="format" aria-pressed={fmt === f.id} onClick={() => setFmt(f.id)}>
              <b>{f.name}</b>
              <small>{f.note}</small>
            </button>
          ))}
        </div>

        <label className="row">
          <span>Machine / sheet</span>
          <select value={machine.id} onChange={(e) => onMachine(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {machines
                  .filter((m) => m.group === g)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>

        {info && sheet && (
          <div className="row">
            <span>Fit</span>
            <div>
              {info.fits ? (
                <span className="tag ok">
                  Fits{info.rotated ? " (rotated 90°)" : ""} · up to {info.per_sheet} per sheet
                </span>
              ) : (
                <span className="tag warn">
                  Too big for {fmtLen(sheet.w, unit)} × {fmtLen(sheet.h, unit)} — split into {info.tiles} tiles with 10 mm overlap
                </span>
              )}
            </div>
          </div>
        )}

        {(!sheet || info?.fits) && (
          <label className="row">
            <span>Copies</span>
            <input type="number" min={1} max={500} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))} />
          </label>
        )}

        <label className="row">
          <span>Crease lines</span>
          <select value={crease} onChange={(e) => setCrease(e.target.value as CreaseMode)}>
            <option value="layer">Separate layer (score / draw tool)</option>
            <option value="dashed">Perforated cut (no scoring tool)</option>
            <option value="omit">Leave out</option>
          </select>
        </label>
        {crease === "dashed" && (
          <div className="row">
            <span>Cut / gap (mm)</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" min={0.3} max={20} step={0.5} value={dash} onChange={(e) => setDash(parseFloat(e.target.value) || 2)} aria-label="Cut length" />
              <input type="number" min={0.3} max={20} step={0.5} value={gap} onChange={(e) => setGap(parseFloat(e.target.value) || 2)} aria-label="Gap length" />
            </div>
          </div>
        )}
        <label className="row">
          <span>File name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <p className="tip">{machine.tip}</p>

        <footer>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          {canShare && (
            <button className="btn mobile-only" disabled={busy} onClick={() => run(true)}>
              Share…
            </button>
          )}
          <button className="btn primary" disabled={busy} onClick={() => run(false)}>
            <Download /> Download {fmt.toUpperCase()}
          </button>
        </footer>
      </div>
    </div>
  );
}
