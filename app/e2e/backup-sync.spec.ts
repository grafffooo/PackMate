import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  // headless Chromium has no real save dialog: use the download fallback
  await page.addInitScript(
    () =>
      delete (window as unknown as { showSaveFilePicker?: unknown })
        .showSaveFilePicker,
  );
});

async function makeDieline(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.goto("/#/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator(".crumb")).toContainText(name);
}

test("backup, wipe the database, restore", async ({ page }) => {
  await page.goto("/");
  await makeDieline(page, "Keep me");

  await page.goto("/#/settings/sync");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Back up everything/ }).click();
  const path = await (await download).path();

  // wipe the database completely
  await page.evaluate(async () => {
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase("packmate");
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  });
  await page.goto("/");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /made to measure/ }),
  ).toBeVisible();

  await page.goto("/#/settings/sync");
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(page.getByText(/1 dielines/)).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Restored.")).toBeVisible();
  await page.goto("/#/");
  await expect(page.locator(".crumb")).toContainText("Keep me");
  expect((await readFile(path!)).subarray(0, 2).toString()).toBe("PK");
});

test("a bad file is rejected with a message", async ({ page }) => {
  await page.goto("/#/settings/sync");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "x.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("nope"),
    });
  await expect(page.getByRole("alert")).toContainText("zip");
});

test("two browser profiles sync through one folder", async ({ browser }) => {
  // stand in for iCloud/Dropbox: both profiles use the same OPFS-like directory via a shared in-page store is not possible,
  // so each context gets its own OPFS directory and we copy the folder's files between them like a cloud app would.
  const stub = () => {
    (
      window as unknown as { showDirectoryPicker: unknown }
    ).showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle("cloud", { create: true });
    };
  };
  const read = async (page: import("@playwright/test").Page) =>
    page.evaluate(async () => {
      const out: Record<string, string> = {};
      const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
        for await (const [name, h] of (
          dir as unknown as {
            entries(): AsyncIterable<[string, FileSystemHandle]>;
          }
        ).entries()) {
          if (h.kind === "directory")
            await walk(h as FileSystemDirectoryHandle, `${prefix}${name}/`);
          else
            out[`${prefix}${name}`] = await (
              await (h as FileSystemFileHandle).getFile()
            ).text();
        }
      };
      await walk(
        await (
          await navigator.storage.getDirectory()
        ).getDirectoryHandle("cloud", { create: true }),
        "",
      );
      return out;
    });
  const write = async (
    page: import("@playwright/test").Page,
    files: Record<string, string>,
  ) =>
    page.evaluate(async (f) => {
      const root = await (
        await navigator.storage.getDirectory()
      ).getDirectoryHandle("cloud", { create: true });
      for (const [path, text] of Object.entries(f)) {
        const parts = path.split("/");
        let dir = root;
        for (const p of parts.slice(0, -1))
          dir = await dir.getDirectoryHandle(p, { create: true });
        const w = await (
          await dir.getFileHandle(parts.at(-1)!, { create: true })
        ).createWritable();
        await w.write(text);
        await w.close();
      }
    }, files);

  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  for (const p of [a, b]) await p.addInitScript(stub);

  await a.goto("/");
  await makeDieline(a, "From device A");
  await a.goto("/#/settings/sync");
  await a.getByRole("button", { name: "Choose folder…" }).click();
  await expect(a.getByText(/Up to date/)).toBeVisible();
  const files = await read(a);
  expect(Object.keys(files).some((k) => k.startsWith("projects/"))).toBe(true);

  // "the cloud app" delivers the files to device B, which then connects to its copy
  await b.goto("/");
  await write(b, files);
  await b.goto("/#/settings/sync");
  await b.getByRole("button", { name: "Choose folder…" }).click();
  await expect(b.getByText(/Up to date/)).toBeVisible();
  await b.goto("/#/");
  await expect(
    b.getByRole("button", { name: /From device A/ }).first(),
  ).toBeVisible();
});
