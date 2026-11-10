import { Fragment } from "react";
import type {
  Generated,
  ParamDef,
  Params,
  ParamValue,
  TemplateDef,
} from "../types";
import { format, type Unit } from "../units";
import type { Material, Project } from "../storage/model";
import { Check, LengthInput, Seg } from "./kit";
import { groupName, optionLabel, paramHelp, paramLabel, tplName } from "./text";
import { Download } from "./icons";
import { useI18n } from "../app/context";
import { go } from "../app/route";

export function ConfigPanel({
  project,
  tpl,
  gen,
  unit,
  materials,
  material,
  error,
  onParams,
  onMaterial,
}: {
  project: Project;
  tpl: TemplateDef;
  gen: Generated | null;
  unit: Unit;
  materials: Material[];
  material: Material | undefined;
  error: string | null;
  onParams: (p: Params) => void;
  onMaterial: (id: string) => void;
}) {
  const { t } = useI18n();
  const set = (id: string, v: ParamValue) =>
    onParams({ ...project.params, [id]: v });

  // the material drives thickness, so that field isn't shown separately
  const defs = tpl.params.filter((d) => d.id !== "thickness");
  const groups = [...new Set(defs.map((d) => d.group))];

  const field = (d: ParamDef) => {
    const id = `p-${d.id}`;
    const label = paramLabel(t, tpl, d);
    const help = paramHelp(t, tpl, d);
    const v = project.params[d.id] ?? d.default;
    switch (d.type) {
      case "length":
        return (
          <div className="fld" key={d.id}>
            <label htmlFor={id}>{label}</label>
            <LengthInput
              id={id}
              label={label}
              value={Number(v)}
              unit={unit}
              min={d.min}
              max={d.max}
              onChange={(mm) => set(d.id, mm)}
            />
          </div>
        );
      case "number":
        return (
          <div className="fld" key={d.id}>
            <label htmlFor={id}>{label}</label>
            <div className="inp">
              <input
                id={id}
                type="number"
                min={d.min}
                max={d.max}
                step={d.step}
                value={Number(v)}
                onChange={(e) =>
                  set(
                    d.id,
                    Math.min(
                      d.max,
                      Math.max(d.min, parseFloat(e.target.value) || d.default),
                    ),
                  )
                }
              />
            </div>
          </div>
        );
      case "bool":
        return (
          <div key={d.id}>
            <Check checked={Boolean(v)} onChange={(b) => set(d.id, b)}>
              {label}
            </Check>
          </div>
        );
      case "choice":
        if (d.options.length === 2) {
          return (
            <div className="fld" key={d.id}>
              <span className="hint" style={{ paddingLeft: 14 }}>
                {label}
              </span>
              <Seg
                label={label}
                value={String(v)}
                onChange={(x) => set(d.id, x)}
                options={d.options.map(([val, text]) => ({
                  value: val,
                  label: optionLabel(t, d, val, text),
                }))}
              />
              {help && (
                <span className="hint" style={{ paddingLeft: 14 }}>
                  {help}
                </span>
              )}
            </div>
          );
        }
        return (
          <div className="fld" key={d.id}>
            <label htmlFor={id}>{label}</label>
            <select
              id={id}
              className="sel"
              value={String(v)}
              onChange={(e) => set(d.id, e.target.value)}
            >
              {d.options.map(([val, text]) => (
                <option key={val} value={val}>
                  {optionLabel(t, d, val, text)}
                </option>
              ))}
            </select>
          </div>
        );
    }
  };

  const lengths = (g: string) =>
    defs.filter((d) => d.group === g && d.type === "length");
  const others = (g: string) =>
    defs.filter((d) => d.group === g && d.type !== "length");

  return (
    <aside className="card cfg" aria-label={t("cfg.label")}>
      <div className="cfg-scroll">
        <h3>{project.name}</h3>
        <div className="type">{tplName(t, tpl)}</div>

        {groups.map((g) => (
          <Fragment key={g}>
            <section className="sec">
              <h3>{groupName(t, g)}</h3>
              {lengths(g).length > 0 && (
                <div
                  className="dims3"
                  style={{
                    gridTemplateColumns:
                      lengths(g).length === 2 || lengths(g).length === 4
                        ? "repeat(2, minmax(0, 1fr))"
                        : undefined,
                  }}
                >
                  {lengths(g).map(field)}
                </div>
              )}
              {others(g).length > 0 && (
                <div
                  className="checks"
                  style={{ marginTop: lengths(g).length ? 14 : 4 }}
                >
                  {others(g).map(field)}
                </div>
              )}
            </section>
          </Fragment>
        ))}

        <section className="sec">
          <h3>{t("cfg.material")}</h3>
          <select
            className="sel"
            aria-label={t("cfg.material")}
            value={material?.id ?? ""}
            onChange={(e) => onMaterial(e.target.value)}
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {material && (
            <div className="matline">
              <span className="dot" style={{ background: material.color }} />
              {t("cfg.thickness", { v: format(material.thickness, unit) })}
            </div>
          )}
        </section>

        {gen && (
          <div className="statrow">
            <div className="stat">
              <span>{t("cfg.size")}</span>
              <b>
                {format(gen.width, unit, false)} × {format(gen.height, unit)}
              </b>
            </div>
            <div className="stat">
              <span>{t("cfg.cutLength")}</span>
              <b>{format(gen.cut_length, unit)}</b>
            </div>
          </div>
        )}
        {error && (
          <p className="warn" role="alert">
            {error}
          </p>
        )}
        {gen?.warnings.map((w, i) => (
          <p className="warn" key={i}>
            {w}
          </p>
        ))}
      </div>
      <button
        type="button"
        className="export"
        aria-disabled={!gen}
        onClick={() => gen && go({ name: "export" })}
      >
        <Download /> {t("cfg.export")}
      </button>
    </aside>
  );
}
