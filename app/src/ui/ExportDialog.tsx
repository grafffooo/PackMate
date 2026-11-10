import { useState } from "react";
import { useI18n, useLib } from "../app/context";
import { useToast } from "../app/toast";
import { go } from "../app/route";
import { catalog, exportFiles, templates } from "../core";
import { effectiveParams, materialOf } from "../state/derive";
import type { CreaseMode, Format } from "../types";
import { Download } from "./icons";
import { Dialog, LengthInput, Seg } from "./kit";
import { machineOf } from "./machine";
import { shareFile, saveFile } from "../save";
import { useActions } from "../app/context";

const FORMATS: { id: Format; key: string }[] = [
  { id: "svg", key: "svg" },
  { id: "pdf", key: "pdf" },
  { id: "dxf", key: "dxf" },
];

export function ExportDialog() {
  const { t } = useI18n();
  const toast = useToast();
  const actions = useActions();
  const settings = useLib((s) => s.settings);
  const projects = useLib((s) => s.projects);
  const materials = useLib((s) => s.materials);
  const selectedId = useLib((s) => s.selectedId);
  const project = projects.find((p) => p.id === selectedId);
  const tpl = project && templates().find((x) => x.id === project.template);
  const { machines } = catalog();
  const machine = machineOf(settings) ?? machines[0];
  const [fmt, setFmt] = useState<Format>("svg");
  const [crease, setCrease] = useState<CreaseMode>(machine.crease);
  const [dash, setDash] = useState(2);
  const [gap, setGap] = useState(2);
  const [busy, setBusy] = useState(false);
  const close = () => go({ name: "home" });

  if (!project || !tpl) {
    return (
      <Dialog
        title={t("export.title")}
        onClose={close}
        closeLabel={t("common.close")}
        width={520}
      >
        <p className="lead" style={{ padding: "0 24px 24px" }}>
          {t("export.nothing")}
        </p>
      </Dialog>
    );
  }

  const groups = [...new Set(machines.map((m) => m.group))];
  const canShare =
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator;

  const run = async (share: boolean) => {
    setBusy(true);
    try {
      const params = effectiveParams(
        tpl,
        project,
        materialOf(project, materials),
      );
      const files = exportFiles(tpl.id, params, {
        format: fmt,
        name: project.name,
        crease_mode: crease,
        dash,
        gap,
        sheet: null,
        copies: 1,
        spacing: 4,
        tile_overlap: 10,
      });
      const file = files[0];
      if (share && (await shareFile(file))) {
        toast(t("export.shared"));
      } else {
        const out = await saveFile(file);
        if (out === "cancelled") return;
        toast(
          t(out === "saved" ? "export.saved" : "export.downloaded", {
            name: file.name,
          }),
        );
      }
      close();
    } catch (e) {
      toast(
        t("export.failed", { msg: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={t("export.title")}
      subtitle={project.name}
      onClose={close}
      closeLabel={t("common.close")}
      width={620}
      footer={
        <>
          <span />
          <div className="btns">
            <button type="button" className="btn flat" onClick={close}>
              {t("common.cancel")}
            </button>
            {canShare && (
              <button
                type="button"
                className="btn flat"
                disabled={busy}
                onClick={() => void run(true)}
              >
                {t("export.share")}
              </button>
            )}
            <button
              type="button"
              className="btn pri"
              disabled={busy}
              onClick={() => void run(false)}
              data-autofocus
            >
              <Download /> {t("export.button", { fmt: fmt.toUpperCase() })}
            </button>
          </div>
        </>
      }
    >
      <div className="xpad">
        <div className="fmts" role="group" aria-label={t("export.format")}>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="fmt"
              aria-pressed={fmt === f.id}
              onClick={() => setFmt(f.id)}
            >
              <b>{f.id.toUpperCase()}</b>
              <span>{t(`export.fmt.${f.key}`)}</span>
            </button>
          ))}
        </div>

        <div className="xrow">
          <label htmlFor="ex-machine">{t("settings.machine")}</label>
          <select
            id="ex-machine"
            className="sel"
            value={machine.id}
            onChange={(e) => {
              void actions.updateSettings({ machineId: e.target.value });
              const m = machines.find((x) => x.id === e.target.value);
              if (m) setCrease(m.crease);
            }}
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
        <p className="hint" style={{ margin: "-6px 0 0 152px" }}>
          {machine.tip}
        </p>

        <div className="xrow">
          <span>{t("export.crease")}</span>
          <Seg
            label={t("export.crease")}
            value={crease}
            onChange={setCrease}
            options={[
              { value: "layer", label: t("export.crease.layer") },
              { value: "dashed", label: t("export.crease.dashed") },
              { value: "omit", label: t("export.crease.omit") },
            ]}
          />
        </div>
        {crease === "dashed" && (
          <div className="xrow">
            <span>{t("export.dash")}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <LengthInput
                id="ex-dash"
                label={t("export.dashLen")}
                value={dash}
                unit={settings.unit}
                min={0.3}
                max={20}
                onChange={setDash}
              />
              <LengthInput
                id="ex-gap"
                label={t("export.gapLen")}
                value={gap}
                unit={settings.unit}
                min={0.3}
                max={20}
                onChange={setGap}
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
