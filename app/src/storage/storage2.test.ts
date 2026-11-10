import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { fromFiles, toFiles, type LibraryData, emptyLibrary } from "./bundle";
import { readLibrary, replaceLibrary, writeSide } from "./libraryIo";
import { applyToData, planMerge } from "./merge";
import type { Folder, Material, Project, Tombstone } from "./model";
import { IdbRepo, MemoryRepo } from "./repo";

const folder = (id: string, t: number): Folder => ({
  id,
  name: id,
  order: 0,
  createdAt: 1,
  updatedAt: t,
});
const project = (id: string, t: number, name = id): Project => ({
  id,
  name,
  folderId: null,
  template: "tray",
  params: { length: 100 },
  materialId: "m",
  createdAt: 1,
  updatedAt: t,
});
const material = (id: string, t: number, tex?: string): Material => ({
  id,
  name: id,
  thickness: 0.5,
  gsm: null,
  color: "#aabbcc",
  ...(tex
    ? {
        textures: {
          out: {
            id: tex,
            name: "a.png",
            w: 2,
            h: 2,
            mime: "image/png" as const,
          },
        },
      }
    : {}),
  createdAt: 1,
  updatedAt: t,
});
const tomb = (kind: Tombstone["kind"], id: string, t: number): Tombstone => ({
  key: `${kind}:${id}`,
  kind,
  id,
  deletedAt: t,
});
const lib = (p: Partial<LibraryData>): LibraryData => ({
  ...emptyLibrary(),
  ...p,
});

describe("bundle", () => {
  it("round-trips records, textures and tombstones", () => {
    const d = lib({
      folders: [folder("f", 5)],
      projects: [project("p", 6)],
      materials: [material("m", 7, "tex1")],
      textures: [
        { id: "tex1", mime: "image/png", data: new Uint8Array([1, 2, 3]) },
      ],
      tombstones: [tomb("project", "gone", 9)],
    });
    const { data, skipped } = fromFiles(toFiles(d));
    expect(skipped).toBe(0);
    expect(data.folders).toEqual(d.folders);
    expect(data.projects).toEqual(d.projects);
    expect(data.materials).toEqual(d.materials);
    expect(data.tombstones).toEqual(d.tombstones);
    expect([...data.textures[0].data]).toEqual([1, 2, 3]);
  });

  it("skips malformed records and rejects foreign or newer archives", () => {
    const files = toFiles(lib({ projects: [project("p", 1)] }));
    files.set("projects/bad.json", new TextEncoder().encode("{nope"));
    files.set(
      "materials/x.json",
      new TextEncoder().encode(JSON.stringify({ name: "no id" })),
    );
    const r = fromFiles(files);
    expect(r.data.projects).toHaveLength(1);
    expect(r.skipped).toBe(2);
    expect(() => fromFiles(new Map([["hello.txt", new Uint8Array()]]))).toThrow(
      /PackMate backup/,
    );
    expect(() =>
      fromFiles(
        new Map([["manifest.json", new TextEncoder().encode('{"format":99}')]]),
      ),
    ).toThrow(/newer/);
  });

  it("keeps hostile ids inside their folder", () => {
    const files = toFiles(lib({ projects: [project("../../etc/x", 1)] }));
    expect([...files.keys()].every((k) => !k.includes(".."))).toBe(true);
  });
});

describe("merge", () => {
  it("newest wins, missing records are copied", () => {
    const a = lib({ projects: [project("p1", 5, "A"), project("only-a", 1)] });
    const b = lib({ projects: [project("p1", 9, "B"), project("only-b", 1)] });
    const plan = planMerge(a, b);
    expect(plan.a.put.projects.map((p) => p.name).sort()).toEqual([
      "B",
      "only-b",
    ]);
    expect(plan.b.put.projects.map((p) => p.id)).toEqual(["only-a"]);
    const na = applyToData(a, plan.a);
    const nb = applyToData(b, plan.b);
    expect(planMerge(na, nb).changes).toBe(0); // converged
  });

  it("a deletion beats an older edit, but not a newer one", () => {
    const older = planMerge(
      lib({ projects: [project("p", 5)] }),
      lib({ tombstones: [tomb("project", "p", 8)] }),
    );
    expect(older.a.del).toEqual([{ kind: "project", id: "p" }]);
    const newer = planMerge(
      lib({ projects: [project("p", 12)] }),
      lib({ tombstones: [tomb("project", "p", 8)] }),
    );
    expect(newer.a.del).toEqual([]);
    expect(newer.b.put.projects).toHaveLength(1);
  });

  it("copies textures with their material", () => {
    const a = lib({
      materials: [material("m", 3, "t")],
      textures: [{ id: "t", mime: "image/png", data: new Uint8Array([9]) }],
    });
    const plan = planMerge(a, lib({}));
    expect(plan.b.put.textures.map((t) => t.id)).toEqual(["t"]);
  });
});

describe("repo io", () => {
  it("replaceLibrary makes the database match exactly", async () => {
    const repo = new MemoryRepo();
    await repo.putProject(project("old", 1));
    await replaceLibrary(
      repo,
      lib({ folders: [folder("f", 1)], materials: [material("m", 1)] }),
    );
    const d = await readLibrary(repo);
    expect(d.projects).toEqual([]);
    expect(d.folders).toHaveLength(1);
    expect((await repo.load()).seeded).toBe(true);
  });

  it("writeSide applies puts and deletes", async () => {
    const repo = new MemoryRepo();
    await repo.putProject(project("a", 1));
    const plan = planMerge(
      await readLibrary(repo),
      lib({
        projects: [project("b", 2)],
        tombstones: [tomb("project", "a", 5)],
      }),
    );
    await writeSide(repo, plan.a);
    expect((await readLibrary(repo)).projects.map((p) => p.id)).toEqual(["b"]);
  });

  it("upgrades a version 1 database without losing data", async () => {
    const name = "upgrade-" + Math.random();
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore("folders", { keyPath: "id" });
        const p = db.createObjectStore("projects", { keyPath: "id" });
        p.createIndex("byFolder", "folderId");
        db.createObjectStore("materials", { keyPath: "id" });
        db.createObjectStore("kv");
      },
    });
    await v1.put("projects", project("keep", 3));
    v1.close();
    const repo = new IdbRepo(name);
    expect((await repo.load()).projects.map((p) => p.id)).toEqual(["keep"]);
    await repo.putTombstone(tomb("folder", "x", 1));
    expect(await repo.listTombstones()).toHaveLength(1);
  });
});
