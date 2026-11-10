import { useEffect, useRef, useState } from "react";
import { useActions, useI18n, useLib } from "../app/context";
import { go } from "../app/route";
import { projectsIn, sortedFolders } from "../state/library";
import type { Folder as FolderT, Project } from "../storage/model";
import { templates } from "../core";
import {
  ChevronDown,
  Chevron,
  FolderPlus,
  Folder as FolderIcon,
  FolderBig,
  More,
  Plus,
} from "./icons";
import { Dialog, Menu, useDismiss } from "./kit";
import { tplName } from "./text";
import { ThumbSvg } from "./Thumb";

type Target = { kind: "folder"; id: string } | { kind: "project"; id: string };

function RowMenu({
  label,
  items,
}: {
  label: string;
  items: Parameters<typeof Menu>[0]["items"];
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ display: "contents" }}>
      <button
        type="button"
        className="row-more"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => (e.stopPropagation(), setOpen((o) => !o))}
      >
        <More />
      </button>
      {open && <Menu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}

function RenameInput({
  value,
  onDone,
  label,
}: {
  value: string;
  onDone: (v: string | null) => void;
  label: string;
}) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className="rename"
      aria-label={label}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onDone(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onDone(v);
        if (e.key === "Escape") onDone(null);
      }}
    />
  );
}

export function ProjectTree({ onNavigate }: { onNavigate?: () => void }) {
  const { t, tp } = useI18n();
  const actions = useActions();
  const folders = useLib((s) => s.folders);
  const projects = useLib((s) => s.projects);
  const selectedId = useLib((s) => s.selectedId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<Target | null>(null);
  const [asking, setAsking] = useState<Target | null>(null);
  const [query, setQuery] = useState("");
  const tpls = templates();

  const q = query.trim().toLowerCase();
  const match = (p: Project) => !q || p.name.toLowerCase().includes(q);
  const sorted = sortedFolders(folders);
  const unfiled = projectsIn(projects, null).filter(match);

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  const item = (p: Project) => {
    const tpl = tpls.find((x) => x.id === p.template);
    const moves = [
      ...sorted
        .filter((f) => f.id !== p.folderId)
        .map((f) => ({
          key: `m-${f.id}`,
          label: t("tree.moveTo", { name: f.name }),
          icon: <FolderIcon />,
          onSelect: () => actions.updateProject(p.id, { folderId: f.id }),
        })),
      ...(p.folderId
        ? [
            {
              key: "m-out",
              label: t("tree.moveOut"),
              icon: undefined,
              onSelect: () => actions.updateProject(p.id, { folderId: null }),
            },
          ]
        : []),
    ];
    return (
      <div className="item-row" key={p.id}>
        {renaming?.kind === "project" && renaming.id === p.id ? (
          <div style={{ padding: "4px 6px" }}>
            <RenameInput
              label={t("common.rename")}
              value={p.name}
              onDone={(v) => {
                setRenaming(null);
                if (v && v.trim())
                  actions.updateProject(p.id, { name: v.trim() });
              }}
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              className="item"
              aria-current={p.id === selectedId}
              onClick={() => {
                actions.select(p.id);
                go({ name: "home" });
                onNavigate?.();
              }}
              onDoubleClick={() => setRenaming({ kind: "project", id: p.id })}
            >
              <span className="thumb">
                {tpl && <ThumbSvg tpl={tpl} size={26} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="i-name">{p.name}</span>
                <span className="i-type">
                  {tpl ? tplName(t, tpl) : p.template}
                </span>
              </span>
            </button>
            <RowMenu
              label={t("tree.actions", { name: p.name })}
              items={[
                {
                  key: "rename",
                  label: t("common.rename"),
                  onSelect: () => setRenaming({ kind: "project", id: p.id }),
                },
                {
                  key: "dup",
                  label: t("common.duplicate"),
                  onSelect: () => void actions.duplicateProject(p.id),
                },
                ...moves,
                {
                  key: "del",
                  label: t("common.delete"),
                  danger: true,
                  onSelect: () => setAsking({ kind: "project", id: p.id }),
                },
              ]}
            />
          </>
        )}
      </div>
    );
  };

  const folderRow = (f: FolderT) => {
    const mine = projectsIn(projects, f.id);
    const shown = mine.filter(match);
    if (q && shown.length === 0) return null;
    const open = q ? true : !collapsed.has(f.id);
    return (
      <div key={f.id}>
        <div className="fold-row">
          {renaming?.kind === "folder" && renaming.id === f.id ? (
            <div style={{ padding: "3px 4px", flex: 1 }}>
              <RenameInput
                label={t("common.rename")}
                value={f.name}
                onDone={(v) => {
                  setRenaming(null);
                  if (v) void actions.renameFolder(f.id, v);
                }}
              />
            </div>
          ) : (
            <>
              <button
                type="button"
                className="fold-b"
                aria-expanded={open}
                onClick={() => toggle(f.id)}
                onDoubleClick={() => setRenaming({ kind: "folder", id: f.id })}
              >
                <span className="chev">
                  <Chevron size={14} />
                </span>
                <span className="fname">{f.name}</span>
                <span className="fcount">{mine.length}</span>
              </button>
              <RowMenu
                label={t("tree.actions", { name: f.name })}
                items={[
                  {
                    key: "rename",
                    label: t("common.rename"),
                    onSelect: () => setRenaming({ kind: "folder", id: f.id }),
                  },
                  {
                    key: "new",
                    label: t("tree.newHere"),
                    icon: <Plus />,
                    onSelect: () => go({ name: "new", folder: f.id }),
                  },
                  {
                    key: "del",
                    label: t("common.delete"),
                    danger: true,
                    onSelect: () => setAsking({ kind: "folder", id: f.id }),
                  },
                ]}
              />
            </>
          )}
        </div>
        {open && (
          <div className="items">
            {shown.length ? (
              shown.map(item)
            ) : (
              <div className="i-type" style={{ padding: "4px 14px 8px" }}>
                {t("tree.emptyFolder")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const newFolder = async () => {
    const f = await actions.createFolder(t("tree.newFolderName"));
    setRenaming({ kind: "folder", id: f.id });
  };

  const [menu, setMenu] = useState(false);
  const menuRef = useDismiss(menu, () => setMenu(false));

  const askedProject =
    asking?.kind === "project"
      ? projects.find((p) => p.id === asking.id)
      : undefined;
  const askedFolder =
    asking?.kind === "folder"
      ? folders.find((f) => f.id === asking.id)
      : undefined;
  const empty = projects.length === 0 && folders.length === 0;

  return (
    <>
      <div className="side-h">
        <h2>{t("tree.title")}</h2>
        <div className="split" ref={menuRef}>
          <a className="split-main" href="#/new">
            <Plus size={16} /> {t("tree.new")}
          </a>
          <button
            type="button"
            className="split-arrow"
            aria-label={t("tree.moreNew")}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <ChevronDown size={16} />
          </button>
          {menu && (
            <Menu
              align="right"
              onClose={() => setMenu(false)}
              items={[
                {
                  key: "folder",
                  label: t("tree.newFolder"),
                  icon: <FolderPlus />,
                  onSelect: () => void newFolder(),
                },
              ]}
            />
          )}
        </div>
      </div>

      {empty ? (
        <div className="empty-side">
          <div className="ring">
            <FolderBig />
          </div>
          <b>{t("tree.emptyTitle")}</b>
          <p>{t("tree.emptyText")}</p>
          <a className="btn pri" href="#/new">
            <Plus size={16} /> {t("tree.new")}
          </a>
        </div>
      ) : (
        <>
          <input
            className="search"
            type="search"
            placeholder={t("tree.search")}
            aria-label={t("tree.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <nav className="tree" aria-label={t("tree.title")}>
            {sorted.map(folderRow)}
            {unfiled.length > 0 && (
              <div>
                {sorted.length > 0 && (
                  <div className="i-type" style={{ padding: "10px 14px 4px" }}>
                    {t("tree.unfiled")}
                  </div>
                )}
                <div
                  className={sorted.length ? "items" : ""}
                  style={sorted.length ? undefined : { paddingLeft: 0 }}
                >
                  {unfiled.map(item)}
                </div>
              </div>
            )}
          </nav>
          <div className="side-f">{tp("tree.count", projects.length)}</div>
        </>
      )}

      {(askedProject || askedFolder) && (
        <Dialog
          title={
            askedProject
              ? t("confirm.deleteProject.title", { name: askedProject.name })
              : t("confirm.deleteFolder.title", { name: askedFolder!.name })
          }
          onClose={() => setAsking(null)}
          closeLabel={t("common.close")}
          width={440}
          footer={
            <div className="btns">
              <button
                type="button"
                className="btn flat"
                onClick={() => setAsking(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn pri"
                data-autofocus
                onClick={() => {
                  if (askedProject) void actions.deleteProject(askedProject.id);
                  else if (askedFolder)
                    void actions.deleteFolder(askedFolder.id);
                  setAsking(null);
                }}
              >
                {t("common.delete")}
              </button>
            </div>
          }
        >
          <p className="lead" style={{ padding: "0 24px" }}>
            {askedProject
              ? t("confirm.deleteProject.text")
              : t("confirm.deleteFolder.text")}
          </p>
        </Dialog>
      )}
    </>
  );
}
