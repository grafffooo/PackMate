import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("first open to exported SVG", async ({ page }) => {
  const errors: string[] = [];
  // headless Chromium has no real save dialog: exercise the download fallback
  await page.addInitScript(
    () =>
      delete (window as unknown as { showSaveFilePicker?: unknown })
        .showSaveFilePicker,
  );
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /made to measure/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Create your first dieline/ }).click();
  await page.getByRole("button", { name: /Mailer Box/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();

  // the dieline appears and follows the dimensions
  const size = page
    .locator(".stat")
    .filter({ hasText: "Flat size" })
    .locator("b");
  await expect(size).toBeVisible();
  const before = await size.textContent();
  const length = page.getByLabel("Length", { exact: true });
  await length.fill("260");
  await length.press("Enter");
  await expect(size).not.toHaveText(before!);

  // folders
  await page.getByRole("button", { name: "More ways to create" }).click();
  await page.getByRole("menuitem", { name: "New folder" }).click();
  await page.locator(".rename").waitFor();
  await page.keyboard.type("Orders");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Orders 0" })).toBeVisible();

  // 3D fold
  await page.getByRole("button", { name: "Swap main view and inset" }).click();
  const slider = page.getByRole("slider", { name: "Fold amount" });
  await slider.fill("0.4");
  await expect(page.locator(".fold .pct")).toHaveText("40%");

  // data survives a reload (local-first)
  await page.reload();
  await expect(page.locator(".crumb")).toContainText("Mailer Box");

  // export
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export SVG/ }).click();
  const file = await (await download).path();
  const svg = await readFile(file!, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toMatch(/width="\d/);

  expect(errors).toEqual([]);
});

test("Slovak language and dark theme", async ({ page }) => {
  await page.goto("/#/settings/language");
  await page.getByText("Slovenčina").click();
  await expect(page.getByRole("heading", { name: "Jazyk" })).toBeVisible();
  await page.getByRole("link", { name: "Vzhľad" }).click();
  await page.getByRole("button", { name: "Tmavý" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
});
