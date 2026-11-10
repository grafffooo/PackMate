import { useMemo, useState } from "react";
import { useActions, useI18n, useLib } from "../app/context";
import { go } from "../app/route";
import { defaults, templates } from "../core";
import { sortedFolders } from "../state/library";
import { DEFAULT_MATERIAL_ID } from "../storage/seed";
import { Dialog } from "./kit";
import { Check } from "./icons";
import { catName, tplDesc, tplName } from "./text";
import { ThumbSvg } from "./Thumb";

export function NewDialog({ folder }: { folder: string | null }) {
  const { t } = useI18n();
  const actions = useActions();
  const folders = useLib((s) => s.folders);
  const materials = useLib((s) => s.materials);
  const all = templates();
  const cats = useMemo(() => [...new Set(all.map((x) => x.category))], [all]);
  const [cat, setCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(all[0]?.id ?? "");
  const [name, setName] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string>(
    folder && folders.some((f) => f.id === folder) ? folder : "",
  );

  const q = query.trim().toLowerCase();
  const list = all.filter(
    (x) =>
      (!cat || x.category === cat) &&
      (!q ||
        `${tplName(t, x)} ${tplDesc(t, x)} ${x.tags.join(" ")}`
          .toLowerCase()
          .includes(q)),
  );
  const tpl = all.find((x) => x.id === sel);
  const close = () => go({ name: "home" });

  const create = async () => {
    if (!tpl) return;
    const mat =
      materials.find((m) => m.id === DEFAULT_MATERIAL_ID) ?? materials[0];
    const params = defaults(tpl);
    if (mat && "thickness" in params) params.thickness = mat.thickness;
    await actions.createProject({
      template: tpl.id,
      name: (name ?? tplName(t, tpl)).trim() || tplName(t, tpl),
      folderId: folderId || null,
      params,
      materialId: mat?.id,
    });
    go({ name: "home" });
  };

  return (
    <Dialog
      title={t("new.title")}
      subtitle={t("new.subtitle")}
      onClose={close}
      closeLabel={t("common.close")}
      width={1020}
      height={680}
    >
      <div className="nd-wrap">
        <div className="nd">
          <div className="cats" role="group" aria-label={t("new.categories")}>
            <button
              type="button"
              aria-pressed={cat === null}
              onClick={() => setCat(null)}
            >
              {t("new.all")} <span className="n">{all.length}</span>
            </button>
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cat === c}
                onClick={() => setCat(c)}
              >
                {catName(t, c)}{" "}
                <span className="n">
                  {all.filter((x) => x.category === c).length}
                </span>
              </button>
            ))}
          </div>
          <div className="nd-main">
            <input
              className="search"
              style={{ width: "100%", maxWidth: 420 }}
              type="search"
              placeholder={t("new.search")}
              aria-label={t("new.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-autofocus
            />
            <div className="gens">
              {list.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className="gen"
                  aria-pressed={sel === x.id}
                  onClick={() => setSel(x.id)}
                  onDoubleClick={() => void create()}
                >
                  <span className="gen-t" style={{ color: "var(--ink)" }}>
                    <ThumbSvg tpl={x} />
                    {sel === x.id && (
                      <span className="tick">
                        <Check size={14} />
                      </span>
                    )}
                  </span>
                  <span className="gen-b">
                    <b>{tplName(t, x)}</b>
                    <span>{catName(t, x.category)}</span>
                  </span>
                </button>
              ))}
            </div>
            {list.length === 0 && (
              <p className="lead" style={{ marginTop: 24 }}>
                {t("new.none")}
              </p>
            )}
          </div>
        </div>
        <div className="nd-foot">
          <div>
            {tpl && (
              <p className="desc">
                <b>{tplName(t, tpl)}.</b> {tplDesc(t, tpl)}
              </p>
            )}
            <div className="f2">
              <div className="fld">
                <label htmlFor="nd-name">{t("new.name")}</label>
                <input
                  id="nd-name"
                  className="txt"
                  value={name ?? (tpl ? tplName(t, tpl) : "")}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="nd-folder">{t("new.folder")}</label>
                <select
                  id="nd-folder"
                  className="sel"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                >
                  <option value="">{t("new.noFolder")}</option>
                  {sortedFolders(folders).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="btns" style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn flat" onClick={close}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn pri"
              disabled={!tpl}
              onClick={() => void create()}
            >
              {t("common.create")}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
