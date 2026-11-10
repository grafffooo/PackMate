import { useMemo } from "react";
import { defaults, generate } from "../core";
import type { Generated, TemplateDef } from "../types";

const cache = new Map<string, Generated | null>();

export function sample(tpl: TemplateDef): Generated | null {
  if (!cache.has(tpl.id)) {
    try {
      cache.set(tpl.id, generate(tpl.id, defaults(tpl)));
    } catch {
      cache.set(tpl.id, null);
    }
  }
  return cache.get(tpl.id)!;
}

/** Small line drawing of a template's default dieline. */
export function ThumbSvg({ tpl, size }: { tpl: TemplateDef; size?: number }) {
  const g = useMemo(() => sample(tpl), [tpl]);
  if (!g) return null;
  const pad = Math.max(g.width, g.height) * 0.04;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${g.width + 2 * pad} ${g.height + 2 * pad}`}
      width={size}
      height={size}
      style={size ? undefined : { width: "100%", height: "100%" }}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {g.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke={p.kind === "cut" ? "currentColor" : "var(--acc)"}
          strokeWidth={p.kind === "cut" ? 1.6 : 1.2}
          strokeDasharray={p.kind === "crease" ? "5 3" : undefined}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
