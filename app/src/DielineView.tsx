import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Generated } from "./types";
import { format, type Unit } from "./units";
import { Fit } from "./icons";

type Box = { x: number; y: number; w: number; h: number };

export type Layers = { cut: boolean; crease: boolean; glue: boolean; labels: boolean; mat: boolean };

type Props = {
  gen: Generated;
  unit: Unit;
  layers: Layers;
  onLayers: (l: Layers) => void;
  /** Usable machine area to outline (mm), already oriented. */
  mat: { w: number; h: number } | null;
  /** Changes when a different template is opened; resets the view. */
  resetKey: string;
};

function fitBox(gen: Generated): Box {
  const pad = Math.max(gen.width, gen.height) * 0.12 + 10;
  return { x: -pad, y: -pad, w: gen.width + 2 * pad, h: gen.height + 2 * pad };
}

export function DielineView({ gen, unit, layers, onLayers, mat, resetKey }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<Box>(() => fitBox(gen));
  const userMoved = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // keep the drawing framed while dimensions change, unless the user zoomed/panned
  useEffect(() => {
    userMoved.current = false;
  }, [resetKey]);
  useEffect(() => {
    if (!userMoved.current) setView(fitBox(gen));
  }, [gen]);

  const toSvg = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : pt;
  }, []);

  const zoomAt = useCallback(
    (cx: number, cy: number, k: number) => {
      const p = toSvg(cx, cy);
      userMoved.current = true;
      setView((v) => {
        const nk = Math.min(Math.max(k, 5 / v.w), 20000 / v.w);
        return { x: p.x - (p.x - v.x) * nk, y: p.y - (p.y - v.y) * nk, w: v.w * nk, h: v.h * nk };
      });
    },
    [toSvg],
  );

  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    svgRef.current?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const ps = pointers.current;
    const prev = ps.get(e.pointerId);
    if (!prev) return;
    const svg = svgRef.current!;
    const scale = 1 / (svg.getScreenCTM()?.a || 1);
    if (ps.size === 1) {
      const dx = (e.clientX - prev.x) * scale;
      const dy = (e.clientY - prev.y) * scale;
      userMoved.current = true;
      setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
    } else if (ps.size === 2) {
      const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (d0 > 0 && d1 > 0) zoomAt((e.clientX + other.x) / 2, (e.clientY + other.y) / 2, d0 / d1);
    }
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  const size = Math.max(gen.width, gen.height);
  const fs = size * 0.022;

  const labels = useMemo(() => {
    if (!layers.labels) return [];
    return gen.panels
      .filter((p) => p.label)
      .map((p) => {
        let minx = Infinity,
          miny = Infinity,
          maxx = -Infinity,
          maxy = -Infinity,
          cx = 0,
          cy = 0;
        for (const q of p.outline) {
          minx = Math.min(minx, q.x);
          maxx = Math.max(maxx, q.x);
          miny = Math.min(miny, q.y);
          maxy = Math.max(maxy, q.y);
          cx += q.x;
          cy += q.y;
        }
        const n = p.outline.length;
        const s = Math.min(maxx - minx, maxy - miny);
        return { name: p.name, x: cx / n, y: cy / n, fs: Math.min(fs, s * 0.16) };
      })
      .filter((l) => l.fs > fs * 0.25);
  }, [gen, layers.labels, fs]);

  const cuts = gen.paths.filter((p) => p.kind !== "crease");
  const creases = gen.paths.filter((p) => p.kind === "crease");
  const dimGap = fs * 1.6;

  return (
    <>
      <svg
        ref={svgRef}
        className="dieline-svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          userMoved.current = false;
          setView(fitBox(gen));
        }}
        role="img"
        aria-label={`Dieline, ${format(gen.width, unit)} by ${format(gen.height, unit)}`}
      >
        {layers.mat && mat && <rect className="mat" x={0} y={0} width={mat.w} height={mat.h} vectorEffect="non-scaling-stroke" strokeWidth={1} />}
        <path className="sheet" d={gen.paths.filter((p) => p.kind === "cut").map((p) => p.d).join(" ")} fillRule="evenodd" />
        {layers.glue && gen.glue.map((g, i) => <polygon key={i} className="glue" points={g.map((q) => `${q.x},${q.y}`).join(" ")} />)}
        {layers.crease &&
          creases.map((p, i) => (
            <path key={`c${i}`} className="crease" d={p.d} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.3} />
          ))}
        {layers.cut &&
          cuts.map((p, i) => (
            <path key={`k${i}`} className={p.kind} d={p.d} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.6} />
          ))}
        {labels.map((l, i) => (
          <text key={i} className="lbl" x={l.x} y={l.y} fontSize={l.fs}>
            {l.name}
          </text>
        ))}
        {/* overall dimensions */}
        <g>
          <line className="dim" x1={0} x2={gen.width} y1={-dimGap} y2={-dimGap} vectorEffect="non-scaling-stroke" strokeWidth={1} />
          <line className="dim" x1={0} x2={0} y1={-dimGap * 1.4} y2={-dimGap * 0.6} vectorEffect="non-scaling-stroke" strokeWidth={1} />
          <line className="dim" x1={gen.width} x2={gen.width} y1={-dimGap * 1.4} y2={-dimGap * 0.6} vectorEffect="non-scaling-stroke" strokeWidth={1} />
          <text className="dimtxt" x={gen.width / 2} y={-dimGap - fs * 0.5} fontSize={fs}>
            {format(gen.width, unit)}
          </text>
          <line className="dim" x1={-dimGap} x2={-dimGap} y1={0} y2={gen.height} vectorEffect="non-scaling-stroke" strokeWidth={1} />
          <line className="dim" x1={-dimGap * 1.4} x2={-dimGap * 0.6} y1={0} y2={0} vectorEffect="non-scaling-stroke" strokeWidth={1} />
          <line className="dim" x1={-dimGap * 1.4} x2={-dimGap * 0.6} y1={gen.height} y2={gen.height} vectorEffect="non-scaling-stroke" strokeWidth={1} />
          <text
            className="dimtxt"
            x={-dimGap - fs * 0.5}
            y={gen.height / 2}
            fontSize={fs}
            transform={`rotate(-90 ${-dimGap - fs * 0.5} ${gen.height / 2})`}
          >
            {format(gen.height, unit)}
          </text>
        </g>
      </svg>
      <div className="view-tools">
        <div className="pill legend">
          <label>
            <input type="checkbox" checked={layers.cut} onChange={(e) => onLayers({ ...layers, cut: e.target.checked })} />
            <span className="swatch" style={{ color: "var(--cut)" }} /> Cut
          </label>
          <label>
            <input type="checkbox" checked={layers.crease} onChange={(e) => onLayers({ ...layers, crease: e.target.checked })} />
            <span className="swatch crease" style={{ color: "var(--crease)" }} /> Crease
          </label>
          <label>
            <input type="checkbox" checked={layers.glue} onChange={(e) => onLayers({ ...layers, glue: e.target.checked })} /> Glue
          </label>
          <label>
            <input type="checkbox" checked={layers.labels} onChange={(e) => onLayers({ ...layers, labels: e.target.checked })} /> Labels
          </label>
          {mat && (
            <label>
              <input type="checkbox" checked={layers.mat} onChange={(e) => onLayers({ ...layers, mat: e.target.checked })} /> Mat
            </label>
          )}
        </div>
        <button
          className="btn small icon-btn"
          title="Fit to view"
          onClick={() => {
            userMoved.current = false;
            setView(fitBox(gen));
          }}
        >
          <Fit />
        </button>
      </div>
    </>
  );
}
