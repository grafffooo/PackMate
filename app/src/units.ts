export type Unit = "mm" | "in";

export const MM_PER_IN = 25.4;

export function toDisplay(mm: number, unit: Unit): number {
  return unit === "in" ? mm / MM_PER_IN : mm;
}

export function fromDisplay(v: number, unit: Unit): number {
  return unit === "in" ? v * MM_PER_IN : v;
}

/** Round for display: 0.1 mm or 0.01 in. */
export function round(v: number, unit: Unit): number {
  const f = unit === "in" ? 1000 : 10;
  return Math.round(v * f) / f;
}

export function format(mm: number, unit: Unit, withUnit = true): string {
  const v = round(toDisplay(mm, unit), unit);
  const s = unit === "in" ? v.toFixed(v < 10 ? 3 : 2).replace(/\.?0+$/, "") : String(v);
  return withUnit ? `${s}${unit === "in" ? "″" : " mm"}` : s;
}

export function formatLength(mm: number, unit: Unit): string {
  if (unit === "in") return format(mm, "in");
  return mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`;
}

export function step(unit: Unit): number {
  return unit === "in" ? 0.0625 : 0.5;
}

/** Parse user input that may contain a unit suffix or a fraction like "3 1/2". */
export function parseLength(input: string, unit: Unit): number | null {
  let s = input.trim().toLowerCase();
  let u: Unit = unit;
  if (/(mm)$/.test(s)) {
    u = "mm";
    s = s.replace(/mm$/, "");
  } else if (/(in|"|″)$/.test(s)) {
    u = "in";
    s = s.replace(/(in|"|″)$/, "");
  } else if (/cm$/.test(s)) {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v * 10 : null;
  }
  s = s.trim().replace(",", ".");
  const frac = s.match(/^(\d+)?\s*(\d+)\/(\d+)$/);
  let v: number;
  if (frac) {
    v = (frac[1] ? parseInt(frac[1]) : 0) + parseInt(frac[2]) / parseInt(frac[3]);
  } else {
    v = Number(s);
  }
  if (!Number.isFinite(v) || s === "") return null;
  return fromDisplay(v, u);
}
