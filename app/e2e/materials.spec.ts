import { expect, test } from "@playwright/test";

test("create a material, add a texture, use it on a dieline", async ({
  page,
}) => {
  const errors: string[] = [];
  await page.goto("/");
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 8;
    const g = c.getContext("2d")!;
    g.fillStyle = "#b08050";
    g.fillRect(0, 0, 8, 8);
    return c.toDataURL("image/png");
  });
  const PNG = Buffer.from(dataUrl.split(",")[1], "base64");
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/#/new");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.goto("/#/materials");

  await page.getByRole("button", { name: "New", exact: true }).click();
  const save = page.getByRole("button", { name: "Save material" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Name", { exact: true }).fill("Linen board");
  await page.getByRole("button", { name: /Board · / }).click();
  await expect(save).toBeEnabled();
  await save.click();

  await expect(
    page.getByRole("heading", { name: "Linen board" }),
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({ name: "linen.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "linen.png" })).toBeVisible();

  // survives a reload and is selectable on the dieline
  await page.reload();
  await expect(page.getByRole("img", { name: "linen.png" })).toBeVisible();
  await page.goto("/#/");
  await page.locator(".cfg select").selectOption({ label: "Linen board" });
  await expect(page.locator(".matline")).toContainText("0.5 mm");

  // deleting falls back to the default material
  await page.goto("/#/materials");
  await page.getByRole("button", { name: /Linen board/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await page.goto("/#/");
  await expect(page.locator(".cfg select")).toHaveValue("builtin-kraft-350");
  expect(errors).toEqual([]);
});
