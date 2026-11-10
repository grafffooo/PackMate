// Accent presets. Every colour in the UI is derived from these: tints for surfaces and
// text, plus the cutting-mat colours. Light values are hand-picked; dark values are generated.

export type AccentId =
  | "seafoam"
  | "terracotta"
  | "lavender"
  | "marigold"
  | "ocean"
  | "rose";
export type Scheme = "light" | "dark";
export type SchemePref = Scheme | "system";

export type Preset = {
  id: AccentId;
  label: string;
  acc: string;
  bg: string;
  surface: string;
  surface2: string;
  soft: string;
  ink: string;
  muted: string;
  cut: string;
  crease: string;
  mat: string;
  mat2: string;
};

export const PRESETS: Record<AccentId, Preset> = {
  seafoam: {
    id: "seafoam",
    label: "Seafoam",
    acc: "#1d7d73",
    bg: "#e7f3ef",
    surface: "#fafdfc",
    surface2: "#eaf5f2",
    soft: "#cfe9e2",
    ink: "#12302b",
    muted: "#4a6d66",
    cut: "#0f4a43",
    crease: "#2a9d8f",
    mat: "#2b7a6f",
    mat2: "#225f57",
  },
  terracotta: {
    id: "terracotta",
    label: "Terracotta",
    acc: "#a85f22",
    bg: "#f4efe6",
    surface: "#fffdf8",
    surface2: "#f9f5ee",
    soft: "#f1dfcb",
    ink: "#23201b",
    muted: "#6a6154",
    cut: "#7a2e0e",
    crease: "#c2793a",
    mat: "#9a5a2e",
    mat2: "#744526",
  },
  lavender: {
    id: "lavender",
    label: "Lavender",
    acc: "#6a4fc7",
    bg: "#efecf8",
    surface: "#fcfbff",
    surface2: "#f1eefb",
    soft: "#ddd5f4",
    ink: "#231c3a",
    muted: "#625a82",
    cut: "#2d1d6b",
    crease: "#8a6ee0",
    mat: "#5e4aa6",
    mat2: "#4a3a85",
  },
  marigold: {
    id: "marigold",
    label: "Marigold",
    acc: "#a85f00",
    bg: "#fbf3df",
    surface: "#fffdf6",
    surface2: "#fbf4e0",
    soft: "#f6e1a8",
    ink: "#2e2410",
    muted: "#74653f",
    cut: "#5c3a00",
    crease: "#c98200",
    mat: "#a8741a",
    mat2: "#855c14",
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    acc: "#2457c5",
    bg: "#e9f0fa",
    surface: "#fafcff",
    surface2: "#edf3fc",
    soft: "#d3e1f8",
    ink: "#12223d",
    muted: "#4f6489",
    cut: "#0f2f73",
    crease: "#4a86f0",
    mat: "#2f5ea8",
    mat2: "#254a85",
  },
  rose: {
    id: "rose",
    label: "Rose",
    acc: "#b02c55",
    bg: "#f9eaee",
    surface: "#fffafb",
    surface2: "#fbeff2",
    soft: "#f5d2dc",
    ink: "#3a1420",
    muted: "#82505f",
    cut: "#6e1530",
    crease: "#e0577f",
    mat: "#a53d5f",
    mat2: "#832f4a",
  },
};

export const ACCENT_IDS = Object.keys(PRESETS) as AccentId[];
export const DEFAULT_ACCENT: AccentId = "seafoam";

export function isAccent(v: unknown): v is AccentId {
  return typeof v === "string" && v in PRESETS;
}

// ---------- colour helpers ----------

export type Rgb = [number, number, number];

export function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(c: Rgb): string {
  return (
    "#" +
    c
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- theme -> CSS variables ----------

export type ThemeVars = Record<string, string>;

export function buildTheme(accent: AccentId, scheme: Scheme): ThemeVars {
  const p = PRESETS[accent];
  if (scheme === "light") {
    return {
      "--bg": p.bg,
      "--surface": p.surface,
      "--surface2": p.surface2,
      "--soft": p.soft,
      "--ink": p.ink,
      "--muted": p.muted,
      "--line": mix(p.bg, p.ink, 0.1),
      "--acc": p.acc,
      "--acc-ink": "#ffffff",
      "--cut": p.cut,
      "--crease": p.crease,
      "--mat": p.mat,
      "--mat2": p.mat2,
      "--shadow": rgba(p.ink, 0.1),
      "--glow": rgba(p.acc, 0.4),
      "--danger": "#b3261e",
    };
  }
  const bg = mix(p.ink, "#000000", 0.3);
  const accL = mix(p.acc, "#ffffff", 0.42);
  const ink = mix(p.bg, "#ffffff", 0.35);
  return {
    "--bg": bg,
    "--surface": mix(bg, "#ffffff", 0.07),
    "--surface2": mix(bg, "#ffffff", 0.12),
    "--soft": mix(bg, accL, 0.28),
    "--ink": ink,
    "--muted": mix(ink, bg, 0.28),
    "--line": mix(bg, "#ffffff", 0.16),
    "--acc": accL,
    "--acc-ink": bg,
    "--cut": mix(p.crease, "#ffffff", 0.6),
    "--crease": mix(p.crease, "#ffffff", 0.25),
    "--mat": mix(p.mat, "#000000", 0.25),
    "--mat2": mix(p.mat2, "#000000", 0.25),
    "--shadow": "rgba(0,0,0,.4)",
    "--glow": rgba(accL, 0.3),
    "--danger": "#ff8a80",
  };
}

export function resolveScheme(pref: SchemePref, systemDark: boolean): Scheme {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

/** Apply a theme to the document root (and keep the browser UI colour in sync). */
export function applyTheme(
  accent: AccentId,
  scheme: Scheme,
  root: HTMLElement = document.documentElement,
) {
  const vars = buildTheme(accent, scheme);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.scheme = scheme;
  root.style.colorScheme = scheme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", vars["--bg"]);
}
