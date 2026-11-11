import type { ParamDef, TemplateDef } from "../types";
import type { TFn } from "../i18n";

/** Translated text if the catalog has the key, otherwise the engine's own English text. */
export function tr(t: TFn, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

export const tplName = (t: TFn, tpl: TemplateDef) =>
  tr(t, `tpl.${tpl.id}.name`, tpl.name);
export const tplDesc = (t: TFn, tpl: TemplateDef) =>
  tr(t, `tpl.${tpl.id}.desc`, tpl.description);
export const catName = (t: TFn, c: string) => tr(t, `cat.${c}`, c);
export const groupName = (t: TFn, g: string) => tr(t, `group.${g}`, g);
export const paramLabel = (t: TFn, tpl: TemplateDef, p: ParamDef) =>
  tr(t, `p.${tpl.id}.${p.id}`, tr(t, `p.${p.id}`, p.label));
export const paramHelp = (t: TFn, tpl: TemplateDef, p: ParamDef) =>
  p.help ? tr(t, `h.${tpl.id}.${p.id}`, tr(t, `h.${p.id}`, p.help)) : undefined;
export const optionLabel = (
  t: TFn,
  p: ParamDef,
  value: string,
  fallback: string,
) => tr(t, `opt.${p.id}.${value}`, fallback);

/** "No glue" / "Needs glue", from the template's tags. */
export const glueTag = (t: TFn, tpl: TemplateDef) =>
  tpl.tags.includes("no glue")
    ? t("tag.noGlue")
    : tpl.tags.includes("needs glue")
      ? t("tag.needsGlue")
      : "";
