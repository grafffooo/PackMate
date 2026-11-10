import { useRef, useState } from "react";
import { useActions, useI18n, useLib } from "../app/context";
import { useToast } from "../app/toast";
import type { Material, TextureRef } from "../storage/model";
import { format } from "../units";
import { Back, Close, Logo, Plus } from "./icons";
import { ImageError, importImage } from "./image";
import { Dialog, LengthInput } from "./kit";
import { useTextureUrl } from "./useTexture";

const SWATCHES = [
  "#c49a6c",
  "#e3d5b8",
  "#f7f5f0",
  "#3a3836",
  "#b98b57",
  "#8aa28f",
  "#b4573f",
  "#4a6a8a",
];
const PRESETS: { key: string; mm: number }[] = [
  { key: "paper", mm: 0.1 },
  { key: "card", mm: 0.3 },
  { key: "board", mm: 0.5 },
  { key: "chip", mm: 1 },
  { key: "eflute", mm: 1.6 },
];
const HEX = /^#[0-9a-fA-F]{6}$/;

function chip(
  m: Pick<Material, "color">,
  url?: string | null,
): React.CSSProperties {
  return url
    ? { background: `center / cover url(${url})` }
    : { background: m.color };
}

function ListChip({ m, size = 40 }: { m: Material; size?: number }) {
  const url = useTextureUrl(m.textures?.out);
  return (
    <span
      className="chip"
      style={{ width: size, height: size, ...chip(m, url) }}
    />
  );
}

function TextureField({
  material,
  face,
}: {
  material: Material;
  face: "out" | "in";
}) {
  const { t } = useI18n();
  const actions = useActions();
  const toast = useToast();
  const ref: TextureRef | undefined = material.textures?.[face];
  const url = useTextureUrl(ref);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { tex, meta } = await importImage(file);
      await actions.setTexture(material.id, face, tex, meta);
    } catch (e) {
      toast(
        t(
          e instanceof ImageError
            ? `materials.err.${e.code}`
            : "materials.err.decode",
        ),
      );
    }
  };

  return (
    <div>
      <div className="facelab">
        {t(face === "out" ? "materials.outside" : "materials.inside")}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => (
          void take(e.target.files?.[0]),
          (e.target.value = "")
        )}
      />
      {ref ? (
        <>
          <div
            className="tex-prev"
            style={url ? { backgroundImage: `url(${url})` } : undefined}
            role="img"
            aria-label={ref.name}
          />
          <div className="file">
            <span title={ref.name}>
              {ref.name} · {ref.w}×{ref.h}
            </span>
            <button
              type="button"
              className="mini"
              onClick={() => input.current?.click()}
            >
              {t("materials.replace")}
            </button>
            <button
              type="button"
              className="mini"
              onClick={() => void actions.clearTexture(material.id, face)}
            >
              {t("materials.remove")}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className={`drop ${over ? "over" : ""}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => (
            e.preventDefault(),
            setOver(false),
            void take(e.dataTransfer.files[0])
          )}
        >
          {t(face === "out" ? "materials.upload" : "materials.upload.in")}
        </button>
      )}
    </div>
  );
}

type Draft = {
  name: string;
  thickness: number | null;
  gsm: string;
  color: string;
};

function Fields({
  name,
  thickness,
  gsm,
  color,
  onName,
  onThickness,
  onGsm,
  onColor,
  showPresets,
}: {
  name: string;
  thickness: number | null;
  gsm: string;
  color: string;
  onName: (v: string) => void;
  onThickness: (mm: number) => void;
  onGsm: (v: string) => void;
  onColor: (v: string) => void;
  showPresets?: boolean;
}) {
  const { t } = useI18n();
  const unit = useLib((s) => s.settings.unit);
  const [hex, setHex] = useState(color);
  const hexOk = HEX.test(hex);
  return (
    <section className="sec">
      <h2>{t("materials.basics")}</h2>
      <div className="fld">
        <label htmlFor="mn">{t("materials.name")}</label>
        <div className="inp left">
          <input
            id="mn"
            type="text"
            value={name}
            placeholder={t("materials.name.ph")}
            onChange={(e) => onName(e.target.value)}
          />
        </div>
      </div>
      {showPresets && (
        <div
          className="presets"
          role="group"
          aria-label={t("materials.presets")}
        >
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="mini"
              aria-pressed={thickness === p.mm}
              onClick={() => onThickness(p.mm)}
            >
              {t(`materials.preset.${p.key}`)} · {format(p.mm, unit)}
            </button>
          ))}
        </div>
      )}
      <div className="two">
        <div className="fld">
          <label htmlFor="mt">{t("materials.thickness")}</label>
          <LengthInput
            id="mt"
            label={t("materials.thickness")}
            value={thickness ?? 0}
            unit={unit}
            min={0.05}
            max={5}
            onChange={onThickness}
          />
        </div>
        <div className="fld">
          <label htmlFor="mg">{t("materials.gsm")}</label>
          <div className="inp">
            <input
              id="mg"
              type="text"
              inputMode="decimal"
              value={gsm}
              placeholder={t("materials.optional")}
              onChange={(e) => onGsm(e.target.value.replace(/[^\d]/g, ""))}
            />
            <span>gsm</span>
          </div>
        </div>
      </div>
      <div className="hint">{t("materials.thickness.hint")}</div>
      <div className="fld" style={{ marginTop: 16 }}>
        <label htmlFor="mc">{t("materials.color")}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="chip"
            style={{ width: 34, height: 34, background: hexOk ? hex : color }}
          />
          <div className="inp left mono" style={{ flex: 1 }}>
            <input
              id="mc"
              type="text"
              value={hex}
              aria-invalid={!hexOk}
              className={hexOk ? "" : "bad"}
              onChange={(e) => {
                setHex(e.target.value);
                if (HEX.test(e.target.value))
                  onColor(e.target.value.toLowerCase());
              }}
              onBlur={() => !hexOk && setHex(color)}
            />
          </div>
        </div>
        <div className="swatches" style={{ marginTop: 10, gap: 8 }}>
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              className="swatch"
              style={{
                width: 28,
                height: 28,
                background: c,
                boxShadow:
                  color.toLowerCase() === c
                    ? `0 0 0 3px var(--surface), 0 0 0 5px var(--acc)`
                    : "inset 0 0 0 1px rgba(0,0,0,.14)",
              }}
              aria-label={c}
              aria-pressed={color.toLowerCase() === c}
              onClick={() => (setHex(c), onColor(c))}
            />
          ))}
        </div>
      </div>
      <div className="hint">{t("materials.color.hint")}</div>
    </section>
  );
}

function Detail({ m, onDeleted }: { m: Material; onDeleted: () => void }) {
  const { t } = useI18n();
  const actions = useActions();
  const [asking, setAsking] = useState(false);
  const [gsm, setGsm] = useState(m.gsm ? String(m.gsm) : "");
  const url = useTextureUrl(m.textures?.out);
  const used = useLib(
    (s) => s.projects.filter((p) => p.materialId === m.id).length,
  );

  return (
    <main className="card detail" key={m.id}>
      <div className="d-h">
        <span
          className="chip"
          style={{ width: 52, height: 52, ...chip(m, url) }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{m.name || t("materials.untitled")}</h1>
          <p>{t("materials.lead")}</p>
        </div>
        <button
          type="button"
          className="btn flat"
          onClick={() =>
            void actions
              .duplicateMaterial(m.id)
              .then((c) => c && (location.hash = `#/materials/${c.id}`))
          }
        >
          {t("common.duplicate")}
        </button>
        <button
          type="button"
          className="btn flat"
          onClick={() => setAsking(true)}
        >
          {t("common.delete")}
        </button>
      </div>
      <div className="grid2">
        <Fields
          name={m.name}
          thickness={m.thickness}
          gsm={gsm}
          color={m.color}
          onName={(name) => actions.updateMaterial(m.id, { name })}
          onThickness={(thickness) =>
            actions.updateMaterial(m.id, { thickness })
          }
          onGsm={(v) => (
            setGsm(v),
            actions.updateMaterial(m.id, { gsm: v ? Number(v) : null })
          )}
          onColor={(color) => actions.updateMaterial(m.id, { color })}
        />
        <section className="sec">
          <h2>{t("materials.texture")}</h2>
          <TextureField material={m} face="out" />
          <div style={{ height: 16 }} />
          <TextureField material={m} face="in" />
          <div className="hint">{t("materials.texture.hint")}</div>
        </section>
      </div>
      {asking && (
        <Dialog
          title={t("materials.delete.title", { name: m.name })}
          onClose={() => setAsking(false)}
          closeLabel={t("common.close")}
          width={440}
          footer={
            <div className="btns">
              <button
                type="button"
                className="btn flat"
                onClick={() => setAsking(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn pri"
                data-autofocus
                onClick={() => {
                  setAsking(false);
                  void actions.deleteMaterial(m.id);
                  onDeleted();
                }}
              >
                {t("common.delete")}
              </button>
            </div>
          }
        >
          <p className="lead" style={{ padding: "0 24px" }}>
            {used > 0
              ? t("materials.delete.used", { n: used })
              : t("materials.delete.text")}
          </p>
        </Dialog>
      )}
    </main>
  );
}

function NewMaterial({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const actions = useActions();
  const [d, setD] = useState<Draft>({
    name: "",
    thickness: null,
    gsm: "",
    color: "#d8c8ad",
  });
  const valid =
    d.name.trim().length > 0 && d.thickness !== null && d.thickness >= 0.05;
  return (
    <main className="card detail">
      <div className="d-h">
        <span
          className="chip"
          style={{ width: 52, height: 52, background: d.color }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{d.name.trim() || t("materials.new.title")}</h1>
          <p>{t("materials.new.lead")}</p>
        </div>
        <button type="button" className="btn flat" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className="btn pri"
          disabled={!valid}
          title={valid ? undefined : t("materials.new.invalid")}
          onClick={() =>
            void actions
              .createMaterial({
                name: d.name.trim(),
                thickness: d.thickness!,
                gsm: d.gsm ? Number(d.gsm) : null,
                color: d.color,
              })
              .then((m) => onCreated(m.id))
          }
        >
          {t("materials.new.save")}
        </button>
      </div>
      <div className="grid2">
        <Fields
          name={d.name}
          thickness={d.thickness}
          gsm={d.gsm}
          color={d.color}
          showPresets
          onName={(name) => setD((x) => ({ ...x, name }))}
          onThickness={(thickness) => setD((x) => ({ ...x, thickness }))}
          onGsm={(gsm) => setD((x) => ({ ...x, gsm }))}
          onColor={(color) => setD((x) => ({ ...x, color }))}
        />
        <section className="sec">
          <h2>{t("materials.texture")}</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            {t("materials.new.textureLater")}
          </p>
        </section>
      </div>
    </main>
  );
}

export function MaterialsView({ selectedId }: { selectedId: string | null }) {
  const { t } = useI18n();
  const materials = useLib((s) => s.materials);
  const unit = useLib((s) => s.settings.unit);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const q = query.trim().toLowerCase();
  const list = materials
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const current = !creating
    ? (materials.find((m) => m.id === selectedId) ?? list[0])
    : undefined;
  const pick = (id: string) => (
    setCreating(false),
    (location.hash = `#/materials/${id}`)
  );
  const empty = materials.length === 0;

  return (
    <div className="app">
      <header className="top">
        <a className="iconbtn" href="#/" aria-label={t("materials.back")}>
          <Back />
        </a>
        <div className="brand">
          <Logo size={30} /> {t("app.name")}
        </div>
        <span className="crumb">
          / <b>{t("materials.title")}</b>
        </span>
        <div className="sp" />
        <a
          className="iconbtn"
          href="#/"
          aria-label={t("common.close")}
          title={t("common.close")}
        >
          <Close />
        </a>
      </header>
      <div className="cols mats">
        <nav className="card list" aria-label={t("materials.title")}>
          <div className="list-h">
            <input
              type="search"
              className="search"
              style={{ flex: 1, minWidth: 0 }}
              placeholder={t("materials.search")}
              aria-label={t("materials.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={empty}
            />
            <button
              type="button"
              className="btn pri"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} /> {t("materials.new")}
            </button>
          </div>
          <div className="cap">
            {t("materials.mine", { n: materials.length })}
          </div>
          <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
            {list.map((m) => (
              <button
                key={m.id}
                type="button"
                className="item"
                aria-pressed={!creating && m.id === current?.id}
                onClick={() => pick(m.id)}
              >
                <ListChip m={m} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="i-name">{m.name}</span>
                  <span className="i-type">
                    {format(m.thickness, unit)} ·{" "}
                    {m.textures?.out
                      ? t("materials.textured")
                      : t("materials.plain")}
                  </span>
                </span>
              </button>
            ))}
            {empty && (
              <div className="hint" style={{ padding: "8px" }}>
                {t("materials.emptyList")}
              </div>
            )}
          </div>
          <div className="hint" style={{ padding: "8px 8px 0" }}>
            {t("materials.autosave")}
          </div>
        </nav>

        {creating ? (
          <NewMaterial
            onCancel={() => setCreating(false)}
            onCreated={(id) => pick(id)}
          />
        ) : current ? (
          <Detail
            m={current}
            onDeleted={() => (location.hash = "#/materials")}
          />
        ) : (
          <main className="card detail empty-detail">
            <h1>{t("materials.empty.title")}</h1>
            <p>{t("materials.empty.text")}</p>
            <div className="steps">
              <div className="step">
                <b>{t("materials.empty.s1")}</b>
                <span>{t("materials.empty.s1t")}</span>
              </div>
              <div className="step">
                <b>{t("materials.empty.s2")}</b>
                <span>{t("materials.empty.s2t")}</span>
              </div>
            </div>
            <button
              type="button"
              className="btn pri lg"
              onClick={() => setCreating(true)}
            >
              <Plus /> {t("materials.new")}
            </button>
          </main>
        )}
      </div>
    </div>
  );
}
