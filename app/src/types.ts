export type Pt = { x: number; y: number };

export type ParamDef = {
  id: string;
  label: string;
  group: string;
  help?: string;
} & (
  | { type: "length"; default: number; min: number; max: number }
  | { type: "number"; default: number; min: number; max: number; step: number }
  | { type: "bool"; default: boolean }
  | { type: "choice"; default: string; options: [string, string][] }
);

export type TemplateDef = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  params: ParamDef[];
};

export type LineKind = "cut" | "crease" | "perforation";

/** Moves a separate part (a lid, a divider) into place; layout coordinates plus z out of the sheet. */
export type AsmStep =
  | {
      t: "rot";
      pivot: [number, number, number];
      axis: [number, number, number];
      angle: number;
    }
  | { t: "move"; d: [number, number, number] };

export type Panel = {
  name: string;
  outline: Pt[];
  parent: number | null;
  hinge: [Pt, Pt] | null;
  angle: number;
  stage: number;
  label: boolean;
  /** root panels of extra parts only */
  assembly?: AsmStep[];
};

export type Generated = {
  width: number;
  height: number;
  paths: { kind: LineKind; d: string; closed: boolean }[];
  panels: Panel[];
  glue: Pt[][];
  warnings: string[];
  /** the folded package stands along the layout's y axis */
  upright?: boolean;
  params: Record<string, ParamValue>;
  cut_length: number;
  crease_length: number;
};

export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

export type Material = {
  id: string;
  name: string;
  thickness: number;
  note: string;
};

export type Machine = {
  id: string;
  name: string;
  group: string;
  w: number | null;
  h: number | null;
  margin: number;
  crease: "layer" | "dashed";
  tip: string;
};

export type OutFile = {
  name: string;
  mime: string;
  text?: string;
  base64?: string;
  bytes?: Uint8Array;
};

export type CreaseMode = "layer" | "dashed" | "omit";
export type Format = "svg" | "pdf" | "dxf";

export type ExportOptions = {
  format: Format;
  name: string;
  crease_mode: CreaseMode;
  dash: number;
  gap: number;
  sheet: { w: number; h: number; margin: number } | null;
  copies: number;
  spacing: number;
  tile_overlap: number;
};

export type FitInfo = {
  fits: boolean;
  rotated: boolean;
  per_sheet: number;
  tiles: number;
};
