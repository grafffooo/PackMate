import { useMemo, useState } from "react";
import { useActions, useI18n, useLib } from "../app/context";
import { go } from "../app/route";
import { generate, templates } from "../core";
import { effectiveParams, materialOf } from "../state/derive";
import type { Generated } from "../types";
import { ConfigPanel } from "./ConfigPanel";
import { FirstOpen } from "./FirstOpen";
import { Grid, Logo, Sliders } from "./icons";
import { matOf } from "./machine";
import { useMaterialImages } from "./useTexture";
import { Preview } from "./Preview";
import { ProjectTree } from "./ProjectTree";

export function Workspace() {
  const { t } = useI18n();
  const actions = useActions();
  const projects = useLib((s) => s.projects);
  const folders = useLib((s) => s.folders);
  const materials = useLib((s) => s.materials);
  const selectedId = useLib((s) => s.selectedId);
  const settings = useLib((s) => s.settings);
  const [sideOpen, setSideOpen] = useState(false);

  const project = projects.find((p) => p.id === selectedId) ?? null;
  const tpl = project
    ? templates().find((x) => x.id === project.template)
    : undefined;
  const material = project ? materialOf(project, materials) : undefined;

  const images = useMaterialImages(material);

  const { gen, error } = useMemo<{
    gen: Generated | null;
    error: string | null;
  }>(() => {
    if (!project || !tpl) return { gen: null, error: null };
    try {
      return {
        gen: generate(tpl.id, effectiveParams(tpl, project, material)),
        error: null,
      };
    } catch (e) {
      return { gen: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [project, tpl, material]);
  // keep the last good drawing on screen while a value is out of range
  const [lastGood, setLastGood] = useState<{
    id: string;
    gen: Generated;
  } | null>(null);
  if (gen && project && lastGood?.gen !== gen)
    setLastGood({ id: project.id, gen });
  const shown =
    gen ??
    (lastGood && project && lastGood.id === project.id ? lastGood.gen : null);

  const folder = project?.folderId
    ? folders.find((f) => f.id === project.folderId)
    : null;
  const welcome = projects.length === 0;

  return (
    <div className="app">
      <header className="top">
        <button
          type="button"
          className="iconbtn flat only-small"
          onClick={() => setSideOpen(true)}
          aria-label={t("tree.title")}
        >
          <Grid />
        </button>
        <div className="brand">
          <Logo size={30} /> {t("app.name")}
        </div>
        {project && (
          <div className="crumb">
            {folder && <>{folder.name} / </>}
            <b>{project.name}</b>
          </div>
        )}
        <div className="sp" />
        <a className="btn" href="#/materials">
          {t("materials.title")}
        </a>
        <a
          className="iconbtn"
          href="#/settings"
          aria-label={t("settings.title")}
          title={t("settings.title")}
        >
          <Sliders />
        </a>
      </header>

      <div
        className="cols"
        style={
          welcome ? { gridTemplateColumns: "300px minmax(0, 1fr)" } : undefined
        }
      >
        {sideOpen && (
          <div
            className="side-scrim only-small"
            onClick={() => setSideOpen(false)}
          />
        )}
        <aside
          className={`card side ${sideOpen ? "open" : ""}`}
          aria-label={t("tree.title")}
        >
          <ProjectTree onNavigate={() => setSideOpen(false)} />
        </aside>

        {welcome ? (
          <section className="pane">
            <div className="vig" />
            <div className="rul-t" />
            <div className="rul-l" />
            <FirstOpen />
          </section>
        ) : project && tpl ? (
          <>
            {shown ? (
              <Preview
                gen={shown}
                unit={settings.unit}
                color={material?.color ?? "#c49a6c"}
                images={images}
                mat={matOf(settings)}
                resetKey={project.id}
              />
            ) : (
              <section className="pane">
                <div className="vig" />
              </section>
            )}
            <ConfigPanel
              project={project}
              tpl={tpl}
              gen={gen}
              unit={settings.unit}
              materials={materials}
              material={material}
              error={error}
              onParams={(params) =>
                actions.updateProject(project.id, { params })
              }
              onMaterial={(id) =>
                actions.updateProject(project.id, { materialId: id })
              }
            />
          </>
        ) : (
          <section className="pane">
            <div className="vig" />
            <div className="welcome">
              <h1>{t("workspace.pick")}</h1>
              <p>{t("workspace.pickText")}</p>
              <div className="acts" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn pri"
                  onClick={() => go({ name: "new", folder: null })}
                >
                  {t("tree.new")}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
