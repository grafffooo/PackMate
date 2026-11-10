import { memo } from "react";
import type { Generated } from "./types";

/** Static mini dieline used on gallery cards. */
export const Thumb = memo(function Thumb({ gen }: { gen: Generated }) {
  const pad = Math.max(gen.width, gen.height) * 0.04;
  const cuts = gen.paths.filter((p) => p.kind === "cut");
  const sw = Math.max(gen.width, gen.height) / 220;
  return (
    <svg viewBox={`${-pad} ${-pad} ${gen.width + 2 * pad} ${gen.height + 2 * pad}`} aria-hidden="true">
      <path d={cuts.map((c) => c.d).join(" ")} fill="var(--accent-soft)" fillRule="evenodd" stroke="none" />
      {gen.paths
        .filter((p) => p.kind !== "cut")
        .map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke="var(--crease)" strokeWidth={sw} strokeDasharray={`${sw * 4} ${sw * 3}`} opacity={0.7} />
        ))}
      {cuts.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke="var(--cut)" strokeWidth={sw * 1.2} />
      ))}
    </svg>
  );
});
