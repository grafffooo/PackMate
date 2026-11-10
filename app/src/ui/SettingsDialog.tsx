import { useState } from "react";
import { useActions, useI18n, useLib } from "../app/context";
import { SETTINGS_SECTIONS, go, type SettingsSection } from "../app/route";
import { catalog } from "../core";
import { LANGS } from "../i18n";
import { newId } from "../storage/model";
import { ACCENT_IDS, PRESETS, type SchemePref } from "../theme/palettes";
import { format } from "../units";
import { Dialog, LengthInput, Seg } from "./kit";
import { machineOf } from "./machine";
import { Close } from "./icons";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="row">
      <div className="lab">
        <b>{label}</b>
        {hint && <span>{hint}</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function General() {
  const { t } = useI18n();
  const settings = useLib((s) => s.settings);
  const actions = useActions();
  const { machines } = catalog();
  const groups = [...new Set(machines.map((m) => m.group))];
  const machine = machineOf(settings);
  const [name, setName] = useState("");
  const [w, setW] = useState(300);
  const [h, setH] = useState(300);
  const [margin, setMargin] = useState(5);

  return (
    <>
      <h3>{t("settings.general")}</h3>
      <p className="lead">{t("settings.general.lead")}</p>
      <Row label={t("settings.units")} hint={t("settings.units.hint")}>
        <Seg
          label={t("settings.units")}
          value={settings.unit}
          onChange={(unit) => void actions.updateSettings({ unit })}
          options={[
            { value: "mm", label: t("common.mm") },
            { value: "in", label: t("common.in") },
          ]}
        />
      </Row>
      <Row label={t("settings.machine")} hint={t("settings.machine.hint")}>
        <div className="sel-w">
          <select
            className="sel"
            aria-label={t("settings.machine")}
            value={settings.machineId}
            onChange={(e) =>
              void actions.updateSettings({ machineId: e.target.value })
            }
          >
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {machines
                  .filter((m) => m.group === g)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </optgroup>
            ))}
            {settings.customMats.length > 0 && (
              <optgroup label={t("settings.custom")}>
                {settings.customMats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        {machine && (
          <div className="info">
            <div>
              <span>{t("settings.machine.tip")}</span>
            </div>
            <p style={{ marginTop: 6 }}>{machine.tip}</p>
          </div>
        )}
      </Row>
      <Row label={t("settings.custom")} hint={t("settings.custom.hint")}>
        {settings.customMats.length > 0 && (
          <div className="sizes" style={{ marginBottom: 12 }}>
            {settings.customMats.map((c) => (
              <div className="size-r" key={c.id}>
                <span>
                  {c.name}{" "}
                  <small>
                    {format(c.w, settings.unit, false)} ×{" "}
                    {format(c.h, settings.unit)}
                  </small>
                </span>
                <button
                  type="button"
                  className="iconbtn flat"
                  style={{ width: 30, height: 30 }}
                  aria-label={t("settings.custom.remove", { name: c.name })}
                  onClick={() =>
                    void actions.updateSettings({
                      customMats: settings.customMats.filter(
                        (x) => x.id !== c.id,
                      ),
                      machineId:
                        settings.machineId === c.id
                          ? "none"
                          : settings.machineId,
                    })
                  }
                >
                  <Close size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            maxWidth: 460,
          }}
        >
          <div className="fld" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="cm-name">{t("settings.custom.name")}</label>
            <input
              id="cm-name"
              className="txt"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="fld">
            <label htmlFor="cm-w">{t("settings.custom.w")}</label>
            <LengthInput
              id="cm-w"
              label={t("settings.custom.w")}
              value={w}
              unit={settings.unit}
              min={20}
              max={5000}
              onChange={setW}
            />
          </div>
          <div className="fld">
            <label htmlFor="cm-h">{t("settings.custom.h")}</label>
            <LengthInput
              id="cm-h"
              label={t("settings.custom.h")}
              value={h}
              unit={settings.unit}
              min={20}
              max={5000}
              onChange={setH}
            />
          </div>
          <div className="fld">
            <label htmlFor="cm-m">{t("settings.custom.margin")}</label>
            <LengthInput
              id="cm-m"
              label={t("settings.custom.margin")}
              value={margin}
              unit={settings.unit}
              min={0}
              max={100}
              onChange={setMargin}
            />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="btn pri"
              disabled={!name.trim()}
              onClick={() => {
                const c = { id: newId(), name: name.trim(), w, h, margin };
                void actions.updateSettings({
                  customMats: [...settings.customMats, c],
                  machineId: c.id,
                });
                setName("");
              }}
            >
              {t("settings.custom.add")}
            </button>
          </div>
        </div>
      </Row>
    </>
  );
}

function Appearance() {
  const { t } = useI18n();
  const settings = useLib((s) => s.settings);
  const actions = useActions();
  return (
    <>
      <h3>{t("settings.appearance")}</h3>
      <p className="lead">{t("settings.appearance.lead")}</p>
      <Row label={t("settings.theme")} hint={t("settings.theme.hint")}>
        <Seg
          label={t("settings.theme")}
          value={settings.scheme}
          onChange={(scheme: SchemePref) =>
            void actions.updateSettings({ scheme })
          }
          options={[
            { value: "system", label: t("settings.theme.system") },
            { value: "light", label: t("settings.theme.light") },
            { value: "dark", label: t("settings.theme.dark") },
          ]}
        />
      </Row>
      <Row label={t("settings.accent")} hint={t("settings.accent.hint")}>
        <div
          className="swatches"
          role="group"
          aria-label={t("settings.accent")}
        >
          {ACCENT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="swatch"
              aria-label={t(`accent.${id}`)}
              aria-pressed={settings.accent === id}
              title={t(`accent.${id}`)}
              style={{
                background: PRESETS[id].acc,
                boxShadow:
                  settings.accent === id
                    ? `0 0 0 3px var(--surface), 0 0 0 5px ${PRESETS[id].acc}`
                    : "none",
              }}
              onClick={() => void actions.updateSettings({ accent: id })}
            />
          ))}
        </div>
        <div className="preview-strip">
          <button type="button" className="btn pri sm" tabIndex={-1}>
            {t("cfg.export")}
          </button>
          <button type="button" className="btn flat sm" tabIndex={-1}>
            {t("common.cancel")}
          </button>
          <span className="tag">{t(`accent.${settings.accent}`)}</span>
        </div>
      </Row>
    </>
  );
}

function Language() {
  const { t } = useI18n();
  const settings = useLib((s) => s.settings);
  const actions = useActions();
  const opts: { id: "system" | "en" | "sk"; native: string; sub: string }[] = [
    {
      id: "system",
      native: t("settings.lang.system"),
      sub: t("settings.lang.system.hint"),
    },
    ...LANGS.map((l) => ({ id: l.id, native: l.native, sub: l.english })),
  ];
  return (
    <>
      <h3>{t("settings.language")}</h3>
      <p className="lead">{t("settings.language.lead")}</p>
      <div
        className="langs"
        role="radiogroup"
        aria-label={t("settings.language")}
      >
        {opts.map((o) => (
          <label
            key={o.id}
            className={`lang rad ${settings.lang === o.id ? "on" : ""}`}
          >
            <input
              type="radio"
              name="lang"
              checked={settings.lang === o.id}
              onChange={() => void actions.updateSettings({ lang: o.id })}
            />
            <span>
              <b>{o.native}</b>
              <small>{o.sub}</small>
            </span>
          </label>
        ))}
      </div>
    </>
  );
}

export function SettingsDialog({ section }: { section: SettingsSection }) {
  const { t } = useI18n();
  return (
    <Dialog
      title={t("settings.title")}
      onClose={() => go({ name: "home" })}
      closeLabel={t("common.close")}
      width={900}
      height={640}
    >
      <div className="st">
        <nav className="nav" aria-label={t("settings.title")}>
          {SETTINGS_SECTIONS.map((s) => (
            <a
              key={s}
              href={s === "general" ? "#/settings" : `#/settings/${s}`}
              aria-current={s === section ? "page" : undefined}
            >
              {t(`settings.${s}`)}
            </a>
          ))}
        </nav>
        <div className="st-pane">
          {section === "general" && <General />}
          {section === "appearance" && <Appearance />}
          {section === "language" && <Language />}
        </div>
      </div>
    </Dialog>
  );
}
