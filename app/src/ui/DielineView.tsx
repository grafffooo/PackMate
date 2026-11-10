import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Generated } from "../types";
import { format, type Unit } from "../units";

type Box = { x: number; y: number; w: number; h: number };
export type Layers = {
  cut: boolean;
  crease: boolean;
  glue: boolean;
  labels: boolean;
  mat: boolean;
};

function matRect(gen: Generated, mat: { w: number; h: number }): Box {
  // orient the mat so the dieline fits if at all possible
  const fitsPortrait =
    gen.width <= Math.min(mat.w, mat.h) && gen.height <= Math.max(mat.w, mat.h);
  const [w, h] = fitsPortrait
    ? [Math.min(mat.w, mat.h), Math.max(mat.w, mat.h)]
    : [Math.max(mat.w, mat.h), Math.min(mat.w, mat.h)];
  return { x: (gen.width - w) / 2, y: (gen.height - h) / 2, w, h };
}

function fitBox(gen: Generated, mat: Box | null): Box {
  const pad = Math.max(gen.width, gen.height) * 0.14 + 8;
  const base: Box = {
    x: -pad,
    y: -pad,
    w: gen.width + 2 * pad,
    h: gen.height + 2 * pad,
  };
  if (!mat) return base;
  const x0 = Math.min(base.x, mat.x - 6);
  const y0 = Math.min(base.y, mat.y - 6);
  return {
    x: x0,
    y: y0,
    w: Math.max(base.x + base.w, mat.x + mat.w + 6) - x0,
    h: Math.max(base.y + base.h, mat.y + mat.h + 6) - y0,
  };
}

export function DielineView({
  gen,
  unit,
  layers,
  mat,
  resetKey,
  interactive = true,
  fitLabel,
}: {
  gen: Generated;
  unit: Unit;
  layers: Layers;
  mat: { w: number; h: number } | null;
  resetKey: string;
  interactive?: boolean;
  fitLabel?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const matBox = useMemo(
    () => (mat && layers.mat ? matRect(gen, mat) : null),
    [gen, mat, layers.mat],
  );
  const [view, setView] = useState<Box>(() => fitBox(gen, matBox));
  const moved = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);

  useEffect(() => {
    moved.current = false;
  }, [resetKey]);
  useEffect(() => {
    if (!moved.current) setView(fitBox(gen, matBox));
  }, [gen, matBox]);

  const scaleOf = () => {
    const svg = svgRef.current!;
    return svg.getScreenCTM()?.a || 1;
  };

  const zoomAt = useCallback((cx: number, cy: number, k: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = pt.matrixTransform(m.inverse());
    moved.current = true;
    setView((v) => {
      const nk = Math.min(Math.max(k, 20 / v.w), 20000 / v.w);
      return {
        x: p.x - (p.x - v.x) * nk,
        y: p.y - (p.y - v.y) * nk,
        w: v.w * nk,
        h: v.h * nk,
      };
    });
  }, []);

  useEffect(() => {
    const svg = svgRef.current!;
    if (!interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(
        e.clientX,
        e.clientY,
        Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)),
      );
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt, interactive]);

  const onDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    const ps = pointers.current;
    const prev = ps.get(e.pointerId);
    if (!prev) return;
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ps.size === 1) {
      const s = scaleOf();
      moved.current = true;
      setView((v) => ({
        ...v,
        x: v.x - (e.clientX - prev.x) / s,
        y: v.y - (e.clientY - prev.y) / s,
      }));
    } else if (ps.size === 2) {
      const [a, b] = [...ps.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current > 0 && d > 0)
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.current / d);
      pinch.current = d;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = 0;
  };

  const sheetD = gen.paths
    .filter((p) => p.kind === "cut" && p.closed)
    .map((p) => p.d)
    .join(" ");
  const fs = Math.max(4, Math.min(gen.width, gen.height) / 28);
  const dimOff = Math.max(8, Math.max(gen.width, gen.height) * 0.05);

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="img"
        aria-label={`${format(gen.width, unit)} × ${format(gen.height, unit)}`}
        style={{
          touchAction: "none",
          cursor: interactive ? "grab" : "default",
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => {
          moved.current = false;
          setView(fitBox(gen, matBox));
        }}
      >
        {matBox && (
          <rect
            className="dl-mat"
            x={matBox.x}
            y={matBox.y}
            width={matBox.w}
            height={matBox.h}
          />
        )}
        <path className="dl-sheet" d={sheetD} />
        {layers.glue &&
          gen.glue.map((poly, i) => (
            <polygon
              key={i}
              className="dl-glue"
              points={poly.map((q) => `${q.x},${q.y}`).join(" ")}
            />
          ))}
        {layers.crease &&
          gen.paths
            .filter((p) => p.kind !== "cut")
            .map((p, i) => (
              <path
                key={i}
                className={p.kind === "crease" ? "dl-crease" : "dl-perf"}
                d={p.d}
              />
            ))}
        {layers.cut &&
          gen.paths
            .filter((p) => p.kind === "cut")
            .map((p, i) => <path key={i} className="dl-cut" d={p.d} />)}
        {layers.labels &&
          gen.panels
            .filter((p) => p.label && p.outline.length)
            .map((p, i) => {
              const c = p.outline.reduce(
                (a, q) => ({
                  x: a.x + q.x / p.outline.length,
                  y: a.y + q.y / p.outline.length,
                }),
                { x: 0, y: 0 },
              );
              return (
                <text key={i} className="dl-lbl" x={c.x} y={c.y} fontSize={fs}>
                  {p.name}
                </text>
              );
            })}
        {interactive && (
          <g>
            <line
              className="dl-dim"
              x1={0}
              x2={gen.width}
              y1={gen.height + dimOff}
              y2={gen.height + dimOff}
            />
            <text
              className="dl-dimt"
              x={gen.width / 2}
              y={gen.height + dimOff + fs * 1.6}
              fontSize={fs * 1.2}
            >
              {format(gen.width, unit)}
            </text>
            <line
              className="dl-dim"
              x1={-dimOff}
              x2={-dimOff}
              y1={0}
              y2={gen.height}
            />
            <text
              className="dl-dimt"
              fontSize={fs * 1.2}
              transform={`translate(${-dimOff - fs * 0.6} ${gen.height / 2}) rotate(-90)`}
            >
              {format(gen.height, unit)}
            </text>
          </g>
        )}
      </svg>
      {interactive && fitLabel && (
        <button
          type="button"
          className="sr"
          onClick={() => {
            moved.current = false;
            setView(fitBox(gen, matBox));
          }}
        >
          {fitLabel}
        </button>
      )}
    </>
  );
}
