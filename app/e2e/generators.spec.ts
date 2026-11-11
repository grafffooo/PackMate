import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { initSync, templates } from "../wasm/dieline.js";

initSync({
  module: readFileSync(new URL("../wasm/dieline_bg.wasm", import.meta.url)),
});
const list = JSON.parse(templates()) as { id: string; name: string }[];

test("every generator can be created and exported as SVG", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    () =>
      delete (window as unknown as { showSaveFilePicker?: unknown })
        .showSaveFilePicker,
  );

  for (const t of list) {
    await page.goto("/#/new");
    await page.locator("button.gen", { hasText: t.name }).first().click();
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator(".cfg")).toBeVisible();
    await expect(page.locator(".stat b").first()).toContainText("mm");

    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export SVG/ }).click();
    const svg = await readFile((await (await download).path())!, "utf8");
    expect(svg, t.id).toContain("<svg");
    expect(svg, t.id).toMatch(/<path/);
  }
  expect(errors).toEqual([]);
});
