import { describe, expect, it } from "vitest";
import { readLibrary } from "../storage/libraryIo";
import type { Material, Project } from "../storage/model";
import { MemoryRepo } from "../storage/repo";
import { MemoryFolder } from "./folder";
import { syncOnce } from "./engine";

const proj = (id: string, t: number, name = id): Project => ({
  id,
  name,
  folderId: null,
  template: "tray",
  params: {},
  materialId: "m",
  createdAt: 1,
  updatedAt: t,
});
const mat = (id: string, t: number, tex?: string): Material => ({
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
            name: "x.png",
            w: 1,
            h: 1,
            mime: "image/png" as const,
          },
        },
      }
    : {}),
  createdAt: 1,
  updatedAt: t,
});
const ids = async (r: MemoryRepo) =>
  (await readLibrary(r)).projects.map((p) => p.id).sort();

describe("sync engine", () => {
  it("two devices converge and a second run is a no-op", async () => {
    const folder = new MemoryFolder();
    const a = new MemoryRepo();
    const b = new MemoryRepo();
    await a.putProject(proj("from-a", 1));
    await b.putProject(proj("from-b", 2));
    await syncOnce(a, folder);
    await syncOnce(b, folder);
    await syncOnce(a, folder);
    expect(await ids(a)).toEqual(["from-a", "from-b"]);
    expect(await ids(b)).toEqual(["from-a", "from-b"]);
    expect(await syncOnce(a, folder)).toEqual({ pulled: 0, pushed: 0 });
    expect(await syncOnce(b, folder)).toEqual({ pulled: 0, pushed: 0 });
  });

  it("the newest edit of the same record wins", async () => {
    const folder = new MemoryFolder();
    const a = new MemoryRepo();
    const b = new MemoryRepo();
    await a.putProject(proj("p", 1, "old"));
    await syncOnce(a, folder);
    await syncOnce(b, folder);
    await a.putProject(proj("p", 5, "edited on A"));
    await b.putProject(proj("p", 9, "edited on B"));
    await syncOnce(a, folder);
    await syncOnce(b, folder);
    await syncOnce(a, folder);
    expect((await readLibrary(a)).projects[0].name).toBe("edited on B");
    expect((await readLibrary(b)).projects[0].name).toBe("edited on B");
  });

  it("deletions travel, and a newer edit survives an older deletion", async () => {
    const folder = new MemoryFolder();
    const a = new MemoryRepo();
    const b = new MemoryRepo();
    await a.putProject(proj("gone", 1));
    await a.putProject(proj("kept", 1));
    await syncOnce(a, folder);
    await syncOnce(b, folder);
    // A deletes both; B edits "kept" afterwards
    for (const id of ["gone", "kept"]) {
      await a.deleteProject(id);
      await a.putTombstone({
        key: `project:${id}`,
        kind: "project",
        id,
        deletedAt: 10,
      });
    }
    await b.putProject(proj("kept", 20, "revived"));
    await syncOnce(a, folder);
    await syncOnce(b, folder);
    await syncOnce(a, folder);
    expect(await ids(a)).toEqual(["kept"]);
    expect(await ids(b)).toEqual(["kept"]);
  });

  it("moves textures with their material and cleans up unused ones", async () => {
    const folder = new MemoryFolder();
    const a = new MemoryRepo();
    const b = new MemoryRepo();
    await a.putMaterial(mat("m", 1, "tex"));
    await a.putTexture({
      id: "tex",
      mime: "image/png",
      data: new Uint8Array([4, 5, 6]),
    });
    await syncOnce(a, folder);
    expect(await folder.list()).toContain("textures/tex.png");
    await syncOnce(b, folder);
    expect([...(await b.getTexture("tex"))!.data]).toEqual([4, 5, 6]);
    // A drops the texture: it disappears from the folder after the next round
    await a.putMaterial(mat("m", 5));
    await syncOnce(a, folder);
    expect(await folder.list()).not.toContain("textures/tex.png");
  });

  it("ignores files it doesn't own and survives bad records", async () => {
    const folder = new MemoryFolder();
    folder.files.set("notes.txt", new Uint8Array([1]));
    folder.files.set("projects/broken.json", new TextEncoder().encode("{oops"));
    const a = new MemoryRepo();
    await a.putProject(proj("ok", 1));
    await syncOnce(a, folder);
    expect(folder.files.get("notes.txt")).toBeDefined();
    expect(await ids(a)).toEqual(["ok"]);
  });
});
