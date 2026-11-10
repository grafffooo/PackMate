import { useI18n, useActions, useLib } from "../app/context";
import { ACCENT_IDS, PRESETS } from "../theme/palettes";
import { catalog } from "../core";
import { Seg } from "./kit";
import { Box3, Plus, Ruler, Sliders } from "./icons";

export function FirstOpen() {
  const { t } = useI18n();
  const settings = useLib((s) => s.settings);
  const actions = useActions();
  const { machines } = catalog();
  const groups = [...new Set(machines.map((m) => m.group))];

  return (
    <div className="welcome" role="region" aria-labelledby="welcome-h">
      <span className="tagw">{t("welcome.tag")}</span>
      <h1 id="welcome-h">{t("welcome.title")}</h1>
      <p>{t("welcome.text")}</p>
      <div className="steps">
        <div className="step">
          <div className="ic">
            <Box3 size={22} />
          </div>
          <b>{t("welcome.s1.title")}</b>
          <span>{t("welcome.s1.text")}</span>
        </div>
        <div className="step">
          <div className="ic">
            <Sliders size={22} />
          </div>
          <b>{t("welcome.s2.title")}</b>
          <span>{t("welcome.s2.text")}</span>
        </div>
        <div className="step">
          <div className="ic">
            <Ruler size={22} />
          </div>
          <b>{t("welcome.s3.title")}</b>
          <span>{t("welcome.s3.text")}</span>
        </div>
      </div>

      <div
        style={{
          textAlign: "left",
          display: "grid",
          gap: 14,
          margin: "0 auto 26px",
          maxWidth: 440,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span className="hint">{t("settings.units")}</span>
          <Seg
            label={t("settings.units")}
            value={settings.unit}
            onChange={(unit) => void actions.updateSettings({ unit })}
            options={[
              { value: "mm", label: t("common.mm") },
              { value: "in", label: t("common.in") },
            ]}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <label className="hint" htmlFor="fo-machine">
            {t("settings.machine")}
          </label>
          <select
            id="fo-machine"
            className="sel"
            style={{ width: 260 }}
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
          </select>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span className="hint">{t("settings.accent")}</span>
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
        </div>
      </div>

      <div className="acts">
        <a className="btn pri lg" href="#/new">
          <Plus /> {t("welcome.cta")}
        </a>
      </div>
    </div>
  );
}
