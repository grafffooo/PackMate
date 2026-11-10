import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IdbRepo, MemoryRepo, type Repo } from "../storage/repo";
import {
  createLibrary,
  projectsIn,
  sortedFolders,
  uniqueName,
} from "./library";

let n = 0;
const fresh = () => new IdbRepo(`test-${++n}-${Math.random()}`);

async function lib(repo: Repo = fresh()) {
  const s = createLibrary(repo, { saveDelay: 5 });
  await s.getState().init();
  return { s, repo };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("library", () => {
  beforeEach(() => {
    n++;
  });

  it("seeds built-in materials once", async () => {
    const { s, repo } = await lib();
    expect(s.getState().materials.map((m) => m.name)).toContain(
      "Kraft board 350 gsm",
    );
    expect(s.getState().materials).toHaveLength(4);
    // a second start does not seed again
    const again = createLibrary(repo);
    await again.getState().init();
    expect(again.getState().materials).toHaveLength(4);
  });

  it("creates projects with unique names and selects them", async () => {
    const { s } = await lib();
    const a = await s.getState().createProject({
      template: "mailer-box",
      name: "Mailer Box",
      params: { length: 200 },
    });
    const b = await s.getState().createProject({
      template: "mailer-box",
      name: "Mailer Box",
      params: { length: 100 },
    });
    expect(a.name).toBe("Mailer Box");
    expect(b.name).toBe("Mailer Box 2");
    expect(s.getState().selectedId).toBe(b.id);
  });

  it("keeps folders and moves projects out when a folder is deleted", async () => {
    const { s } = await lib();
    const f = await s.getState().createFolder("Soap shop");
    const p = await s.getState().createProject({
      template: "pillow-box",
      name: "Favour",
      folderId: f.id,
      params: {},
    });
    expect(projectsIn(s.getState().projects, f.id)).toHaveLength(1);
    await s.getState().deleteFolder(f.id);
    expect(s.getState().folders).toHaveLength(0);
    const after = s.getState().projects.find((x) => x.id === p.id)!;
    expect(after.folderId).toBeNull();
    expect(projectsIn(s.getState().projects, null)).toHaveLength(1);
  });

  it("renames folders but ignores empty names", async () => {
    const { s } = await lib();
    const f = await s.getState().createFolder("A");
    await s.getState().renameFolder(f.id, "  Kit  ");
    expect(s.getState().folders[0].name).toBe("Kit");
    await s.getState().renameFolder(f.id, "   ");
    expect(s.getState().folders[0].name).toBe("Kit");
  });

  it("orders folders by creation", async () => {
    const { s } = await lib();
    await s.getState().createFolder("Zed");
    await s.getState().createFolder("Alpha");
    expect(sortedFolders(s.getState().folders).map((f) => f.name)).toEqual([
      "Zed",
      "Alpha",
    ]);
  });

  it("persists edits (debounced) and survives a restart", async () => {
    const repo = fresh();
    const { s } = await lib(repo);
    const f = await s.getState().createFolder("Kit");
    const p = await s.getState().createProject({
      template: "mailer-box",
      name: "Mailer",
      folderId: f.id,
      params: { length: 200 },
    });
    s.getState().updateProject(p.id, { params: { length: 250 } });
    s.getState().updateProject(p.id, { params: { length: 260 } });
    await wait(40);
    await s.getState().updateSettings({ unit: "in", accent: "rose" });

    const reopened = createLibrary(repo);
    await reopened.getState().init();
    const got = reopened.getState().projects[0];
    expect(got.params).toEqual({ length: 260 });
    expect(got.folderId).toBe(f.id);
    expect(reopened.getState().settings.unit).toBe("in");
    expect(reopened.getState().settings.accent).toBe("rose");
    expect(reopened.getState().selectedId).toBe(p.id);
  });

  it("flush writes pending edits immediately", async () => {
    const repo = fresh();
    const { s } = await lib(repo);
    const p = await s
      .getState()
      .createProject({ template: "tray", name: "Tray", params: { a: 1 } });
    s.getState().updateProject(p.id, { name: "Insert tray" });
    await s.getState().flush();
    const snap = await repo.load();
    expect(snap.projects[0].name).toBe("Insert tray");
  });

  it("duplicates and deletes projects", async () => {
    const { s } = await lib();
    const p = await s
      .getState()
      .createProject({ template: "tray", name: "Tray", params: { a: 1 } });
    const copy = await s.getState().duplicateProject(p.id);
    expect(copy?.name).toBe("Tray 2");
    expect(copy?.params).toEqual({ a: 1 });
    expect(copy?.params).not.toBe(p.params);
    await s.getState().deleteProject(copy!.id);
    expect(s.getState().projects).toHaveLength(1);
    expect(s.getState().selectedId).toBe(p.id);
  });

  it("falls back to memory storage with the same behaviour", async () => {
    const { s } = await lib(new MemoryRepo());
    await s
      .getState()
      .createProject({ template: "tray", name: "Tray", params: {} });
    expect(s.getState().persistence).toBe("memory");
    expect(s.getState().projects).toHaveLength(1);
  });

  it("repairs partial or junk settings", async () => {
    const repo = fresh();
    await repo.putSettings({
      unit: "furlong",
      accent: "nope",
      lang: "sk",
      customMats: [{ id: "x", name: "bad", w: -1, h: 5, margin: 0 }],
    } as never);
    const { s } = await lib(repo);
    const st = s.getState().settings;
    expect(st.unit).toBe("mm");
    expect(st.accent).toBe("seafoam");
    expect(st.lang).toBe("sk");
    expect(st.customMats).toEqual([]);
  });

  it("makes unique names", () => {
    expect(uniqueName("A", ["A", "A 2"])).toBe("A 3");
    expect(uniqueName("B", ["A"])).toBe("B");
  });
});

describe("materials", () => {
  it("creates, edits, duplicates and deletes with fallbacks", async () => {
    const { s, repo } = await lib();
    const m = await s
      .getState()
      .createMaterial({ name: "Kraft board 350 gsm", thickness: 0.9 });
    expect(m.name).toBe("Kraft board 350 gsm 2");
    s.getState().updateMaterial(m.id, { thickness: 1.2, name: "Craft" });
    await wait(30);
    expect(
      (await repo.load()).materials.find((x) => x.id === m.id)?.thickness,
    ).toBe(1.2);

    const p = await s.getState().createProject({
      template: "tray",
      name: "T",
      params: {},
      materialId: m.id,
    });
    const copy = await s.getState().duplicateMaterial(m.id);
    expect(copy?.thickness).toBe(1.2);
    expect(copy?.id).not.toBe(m.id);

    await s.getState().deleteMaterial(m.id);
    expect(s.getState().projects.find((x) => x.id === p.id)?.materialId).toBe(
      "builtin-kraft-350",
    );
    expect((await repo.listTombstones()).map((t) => t.key)).toContain(
      `material:${m.id}`,
    );
  });

  it("stores textures and prunes unused ones", async () => {
    const { s, repo } = await lib();
    const m = await s.getState().createMaterial({});
    const tex = (id: string) => ({
      id,
      mime: "image/png" as const,
      data: new Uint8Array([1]),
    });
    await s
      .getState()
      .setTexture(m.id, "out", tex("a"), { name: "a.png", w: 4, h: 4 });
    await s
      .getState()
      .setTexture(m.id, "out", tex("b"), { name: "b.png", w: 4, h: 4 });
    expect((await repo.allTextures()).map((t) => t.id)).toEqual(["b"]);
    await s.getState().clearTexture(m.id, "out");
    expect(await repo.allTextures()).toEqual([]);
    expect(s.getState().materials.find((x) => x.id === m.id)?.textures).toEqual(
      {},
    );
  });

  it("records tombstones for deleted projects and folders", async () => {
    const { s, repo } = await lib();
    const f = await s.getState().createFolder("F");
    const p = await s
      .getState()
      .createProject({ template: "tray", name: "P", params: {} });
    await s.getState().deleteProject(p.id);
    await s.getState().deleteFolder(f.id);
    expect((await repo.listTombstones()).map((t) => t.key).sort()).toEqual([
      `folder:${f.id}`,
      `project:${p.id}`,
    ]);
  });
});
