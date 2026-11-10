import { describe, expect, it } from "vitest";
import {
  backupName,
  createBackup,
  restoreAdd,
  restoreReplace,
  summarize,
  unzipLibrary,
} from "./backup";
import { MemoryRepo } from "./repo";
import { readLibrary } from "./libraryIo";

const mat = {
  id: "m",
  name: "M",
  thickness: 0.5,
  gsm: null,
  color: "#aabbcc",
  textures: {
    out: { id: "t", name: "t.png", w: 1, h: 1, mime: "image/png" as const },
  },
  createdAt: 1,
  updatedAt: 5,
};

async function source() {
  const r = new MemoryRepo();
  await r.putFolder({
    id: "f",
    name: "F",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
  });
  await r.putProject({
    id: "p",
    name: "P",
    folderId: "f",
    template: "tray",
    params: { length: 90 },
    materialId: "m",
    createdAt: 1,
    updatedAt: 7,
  });
  await r.putMaterial(mat);
  await r.putTexture({
    id: "t",
    mime: "image/png",
    data: new Uint8Array([7, 7, 7]),
  });
  return r;
}

describe("backup", () => {
  it("names files by date", () => {
    expect(backupName(new Date("2026-03-04T10:00:00Z"))).toBe(
      "packmate-backup-2026-03-04.packmate.zip",
    );
  });

  it("zip round-trip restores everything, including texture bytes", async () => {
    const file = await createBackup(await source());
    const { data, skipped } = unzipLibrary(file.bytes!);
    expect(skipped).toBe(0);
    expect(summarize(data)).toEqual({
      projects: 1,
      folders: 1,
      materials: 1,
      textures: 1,
    });
    const target = new MemoryRepo();
    await restoreReplace(target, data);
    const back = await readLibrary(target);
    expect(back.projects[0].params).toEqual({ length: 90 });
    expect([...back.textures[0].data]).toEqual([7, 7, 7]);
  });

  it("add keeps local records that are newer and what the backup lacks", async () => {
    const { data } = unzipLibrary((await createBackup(await source())).bytes!);
    const target = new MemoryRepo();
    await target.putProject({
      id: "p",
      name: "Newer here",
      folderId: null,
      template: "tray",
      params: {},
      materialId: "m",
      createdAt: 1,
      updatedAt: 99,
    });
    await target.putProject({
      id: "local-only",
      name: "L",
      folderId: null,
      template: "tray",
      params: {},
      materialId: "m",
      createdAt: 1,
      updatedAt: 1,
    });
    await restoreAdd(target, data);
    const d = await readLibrary(target);
    expect(d.projects.map((p) => p.id).sort()).toEqual(["local-only", "p"]);
    expect(d.projects.find((p) => p.id === "p")?.name).toBe("Newer here");
    expect(d.folders).toHaveLength(1);
    expect(d.textures).toHaveLength(1);
  });

  it("rejects things that aren't backups", () => {
    expect(() => unzipLibrary(new Uint8Array([1, 2, 3]))).toThrow(/zip/);
  });
});
