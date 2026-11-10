import { useEffect, useRef, useState } from "react";
import type { Generated } from "../types";
import type { Unit } from "../units";
import { Check as ChkBox } from "./kit";
import { Pause, Play, Swap } from "./icons";
import { DielineView, type Layers } from "./DielineView";
import { FoldView } from "./FoldView";
import { useI18n } from "../app/context";

type Main = "dieline" | "fold";

/** The cutting mat: dieline and 3D fold view, one big and one as an inset you can swap. */
export function Preview({
  gen,
  unit,
  color,
  mat,
  resetKey,
}: {
  gen: Generated;
  unit: Unit;
  color: string;
  mat: { w: number; h: number } | null;
  resetKey: string;
}) {
  const { t } = useI18n();
  const [main, setMain] = useState<Main>("dieline");
  const [fold, setFold] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [layers, setLayers] = useState<Layers>({
    cut: true,
    crease: true,
    glue: true,
    labels: true,
    mat: true,
  });
  const raf = useRef(0);
  const foldRef = useRef(fold);
  foldRef.current = fold;

  useEffect(() => {
    if (!playing) return;
    // play toward the opposite end of where the slider sits
    const from = foldRef.current;
    const to = from >= 0.999 ? 0 : 1;
    const dur = 2600 * Math.abs(to - from);
    const start = performance.now();
    const tick = (now: number) => {
      const k = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
      setFold(from + (to - from) * k);
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const set = (k: keyof Layers) => (v: boolean) =>
    setLayers((l) => ({ ...l, [k]: v }));
  const foldIsMain = main === "fold";
  const pct = Math.round(fold * 100);
  const hasMat = mat !== null;

  return (
    <section className="pane" aria-label={t("preview.label")}>
      <div className="vig" />
      <div className="rul-t" />
      <div className="rul-l" />

      <div
        className={`preview-layer ${foldIsMain ? "inset" : "main"}`}
        style={{
          left: foldIsMain ? undefined : 22,
          top: foldIsMain ? undefined : 22,
        }}
      >
        <DielineView
          gen={gen}
          unit={unit}
          layers={layers}
          mat={mat}
          resetKey={resetKey}
          interactive={!foldIsMain}
          fitLabel={t("preview.fit")}
        />
      </div>
      <div
        className={`preview-layer ${foldIsMain ? "main" : "inset"}`}
        style={{
          left: foldIsMain ? 22 : undefined,
          top: foldIsMain ? 22 : undefined,
        }}
      >
        <FoldView
          gen={gen}
          t={fold}
          color={color}
          resetKey={resetKey}
          noWebglText={t("preview.noWebgl")}
        />
      </div>

      <div className="inset-chrome">
        <span className="tagw">
          {foldIsMain ? t("preview.dieline") : t("preview.fold3d")}
        </span>
        <button
          type="button"
          className="swap"
          onClick={() => setMain(foldIsMain ? "dieline" : "fold")}
          aria-label={t("preview.swap")}
          title={t("preview.swap")}
        >
          <Swap />
        </button>
      </div>

      {foldIsMain ? (
        <div className="fold">
          <button
            type="button"
            className="play"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t("fold.pause") : t("fold.play")}
            title={playing ? t("fold.pause") : t("fold.play")}
          >
            {playing ? <Pause /> : <Play />}
          </button>
          <button
            type="button"
            className="fl"
            onClick={() => (setPlaying(false), setFold(0))}
          >
            {t("fold.flat")}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={fold}
            aria-label={t("fold.amount")}
            style={{ ["--p" as string]: `${pct}%` }}
            onChange={(e) => {
              setPlaying(false);
              setFold(parseFloat(e.target.value));
            }}
          />
          <button
            type="button"
            className="fl"
            onClick={() => (setPlaying(false), setFold(1))}
          >
            {t("fold.folded")}
          </button>
          <span className="pct">{pct}%</span>
        </div>
      ) : (
        <div className="legend">
          <ChkBox checked={layers.cut} onChange={set("cut")}>
            {t("layer.cut")}
          </ChkBox>
          <ChkBox checked={layers.crease} onChange={set("crease")}>
            {t("layer.crease")}
          </ChkBox>
          <ChkBox checked={layers.glue} onChange={set("glue")}>
            {t("layer.glue")}
          </ChkBox>
          <ChkBox checked={layers.labels} onChange={set("labels")}>
            {t("layer.labels")}
          </ChkBox>
          {hasMat && (
            <ChkBox checked={layers.mat} onChange={set("mat")}>
              {t("layer.mat")}
            </ChkBox>
          )}
        </div>
      )}
    </section>
  );
}
