import { useEffect, useRef, useState } from "react";
import type { Material, ParamDef, Params } from "./types";
import { format, parseLength, round, toDisplay, type Unit } from "./units";

type Props = {
  defs: ParamDef[];
  params: Params;
  unit: Unit;
  materials: Material[];
  material: string;
  onMaterial: (id: string) => void;
  onChange: (p: Params) => void;
};

export function LengthInput({
  value,
  unit,
  min,
  max,
  onChange,
  id,
  label,
}: {
  value: number;
  unit: Unit;
  min: number;
  max: number;
  onChange: (mm: number) => void;
  id: string;
  label?: string;
}) {
  const shown = () => String(round(toDisplay(value, unit), unit));
  const [text, setText] = useState(shown);
  const [bad, setBad] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(shown());
  }, [value, unit]);

  const commit = (s: string, final: boolean) => {
    const mm = parseLength(s, unit);
    const ok = mm !== null && mm >= min - 1e-9 && mm <= max + 1e-9;
    setBad(!ok && s.trim() !== "");
    if (ok) onChange(mm!);
    if (final) {
      if (mm !== null && !ok) onChange(Math.min(max, Math.max(min, mm)));
      setBad(false);
      focused.current = false;
      setText(String(round(toDisplay(ok ? mm! : Math.min(max, Math.max(min, mm ?? value)), unit), unit)));
    }
  };

  return (
    <div className="unit-input">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={label}
        className={bad ? "invalid" : ""}
        value={text}
        title={`${format(min, unit)} – ${format(max, unit)}`}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value, false);
        }}
        onBlur={(e) => commit(e.target.value, true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const stepMm = (unit === "in" ? 0.0625 * 25.4 : 1) * (e.shiftKey ? 10 : 1);
            const next = Math.min(max, Math.max(min, value + (e.key === "ArrowUp" ? stepMm : -stepMm)));
            onChange(next);
            setText(String(round(toDisplay(next, unit), unit)));
          }
        }}
      />
      <span>{unit === "in" ? "in" : "mm"}</span>
    </div>
  );
}

export function ParamForm({ defs, params, unit, materials, material, onMaterial, onChange }: Props) {
  const set = (id: string, v: Params[string]) => onChange({ ...params, [id]: v });
  const groups: string[] = [];
  for (const d of defs) if (!groups.includes(d.group)) groups.push(d.group);

  const dims = defs.filter((d) => d.group === "Dimensions" && d.type === "length");
  const hero = dims.slice(0, 3);
  const heroIds = new Set(hero.map((h) => h.id));

  const field = (d: ParamDef) => {
    const fid = `p-${d.id}`;
    switch (d.type) {
      case "length":
        return (
          <div className="field" key={d.id}>
            <label htmlFor={fid}>{d.label}</label>
            <LengthInput id={fid} value={Number(params[d.id])} unit={unit} min={d.min} max={d.max} onChange={(v) => set(d.id, v)} />
            {d.help && <div className="help">{d.help}</div>}
          </div>
        );
      case "number":
        return (
          <div className="field" key={d.id}>
            <label htmlFor={fid}>{d.label}</label>
            <input
              id={fid}
              type="number"
              min={d.min}
              max={d.max}
              step={d.step}
              value={Number(params[d.id])}
              onChange={(e) => set(d.id, parseFloat(e.target.value))}
            />
          </div>
        );
      case "bool":
        return (
          <div className="field wide" key={d.id}>
            <label className="toggle">
              <input type="checkbox" checked={Boolean(params[d.id])} onChange={(e) => set(d.id, e.target.checked)} />
              {d.label}
            </label>
            {d.help && <div className="help">{d.help}</div>}
          </div>
        );
      case "choice":
        return (
          <div className="field" key={d.id}>
            <label htmlFor={fid}>{d.label}</label>
            <select id={fid} value={String(params[d.id])} onChange={(e) => set(d.id, e.target.value)}>
              {d.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {d.help && <div className="help">{d.help}</div>}
          </div>
        );
    }
  };

  return (
    <>
      {groups.map((g) => (
        <section className="group" key={g}>
          <h4>{g}</h4>
          {g === "Dimensions" && hero.length > 0 && (
            <div className="dims-hero">
              {hero.map((d) => (
                <div className="dim" key={d.id}>
                  <label htmlFor={`p-${d.id}`}>{d.label}</label>
                  {d.type === "length" && (
                    <LengthInput id={`p-${d.id}`} value={Number(params[d.id])} unit={unit} min={d.min} max={d.max} onChange={(v) => set(d.id, v)} />
                  )}
                </div>
              ))}
            </div>
          )}
          {g === "Material" && (
            <div className="field">
              <label htmlFor="material">Material</label>
              <select
                id="material"
                value={material}
                onChange={(e) => {
                  const m = materials.find((x) => x.id === e.target.value);
                  onMaterial(e.target.value);
                  if (m) set("thickness", m.thickness);
                }}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </div>
          )}
          {defs
            .filter((d) => d.group === g && !heroIds.has(d.id))
            .map((d) =>
              d.id === "thickness" ? (
                <div className="field" key={d.id}>
                  <label htmlFor="p-thickness">{d.label}</label>
                  <LengthInput
                    id="p-thickness"
                    value={Number(params.thickness)}
                    unit="mm"
                    min={d.type === "length" ? d.min : 0}
                    max={d.type === "length" ? d.max : 10}
                    onChange={(v) => {
                      onChange({ ...params, thickness: v });
                      const m = materials.find((x) => Math.abs(x.thickness - v) < 1e-6);
                      onMaterial(m ? m.id : "custom");
                    }}
                  />
                  {d.help && <div className="help">{d.help}</div>}
                </div>
              ) : (
                field(d)
              ),
            )}
        </section>
      ))}
    </>
  );
}
