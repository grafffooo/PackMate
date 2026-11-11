// Regenerates docs/screenshots from the real app. See docs/DEVELOPMENT.md ("Screenshots").
//   pnpm build:web && pnpm preview --port 4173 &   then   node scripts/screenshots.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL || "http://127.0.0.1:4173/";
const OUT = fileURLToPath(new URL("../../docs/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", locale: "en-US" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.addInitScript(() => delete window.showSaveFilePicker);

const shot = async (name, opts = {}) => {
  await page.waitForTimeout(opts.wait ?? 500);
  await page.screenshot({ path: `${OUT}${name}.png`, ...(opts.clip ? { clip: opts.clip } : {}) });
  console.log("shot", name);
};
const go = async (hash) => {
  await page.goto(`${BASE}#${hash}`);
  await page.waitForTimeout(250);
};

// ---------- 1. first open ----------
await page.goto(BASE);
await page.waitForSelector(".welcome");
await shot("01-first-open");

// ---------- seed: folders, dielines, a textured material ----------
async function newFolder(name, { menuShot } = {}) {
  await page.click(".split-arrow");
  if (menuShot) await shot(menuShot, { wait: 300 });
  await page.getByRole("menuitem", { name: "New folder" }).click();
  await page.locator(".rename").waitFor();
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
}
async function newDieline(template, name, folder, setup) {
  await go("/new");
  await page.locator("button.gen", { hasText: template }).first().click();
  await page.fill("#nd-name", name);
  if (folder) await page.selectOption("#nd-folder", { label: folder });
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForSelector(".cfg");
  if (setup) await setup();
}

await go("/new");
await page.locator("button.gen", { hasText: "Locking Tray" }).first().click();
await page.fill("#nd-name", "Presentation tray");
await page.getByRole("button", { name: "Create", exact: true }).click();
await page.waitForSelector(".cfg");
await newFolder("Shop orders", { menuShot: "04-new-menu" });
await newFolder("Gift boxes");

// a linen-style texture made in the page, used for a material below
const texture = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#e9e1d2";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 3) {
    g.fillStyle = `rgba(120,100,70,${0.05 + ((i * 37) % 10) / 100})`;
    g.fillRect(i, 0, 1, 256);
    g.fillRect(0, i, 256, 1);
  }
  return c.toDataURL("image/png");
});
await go("/materials");
await page.getByRole("button", { name: "New", exact: true }).click();
await page.fill("#mn", "Linen board 300 gsm");
await page.getByRole("button", { name: /^Board/ }).click();
await page.fill("#mg", "300");
await shot("12-material-new");
await page.getByRole("button", { name: "Save material" }).click();
await page.locator("input[type=file]").first().setInputFiles({ name: "linen.png", mimeType: "image/png", buffer: Buffer.from(texture.split(",")[1], "base64") });
await page.getByRole("img", { name: "linen.png" }).waitFor();
await go("/materials/builtin-kraft-350");
await shot("11-materials", { wait: 800 });

const dielines = [
  ["Pillow Box", "Wedding favour", "Gift boxes"],
  ["Hexagon / Polygon Box", "Hexagon gift box", "Gift boxes"],
  ["Drawer Box", "Jewellery drawer", "Gift boxes"],
  ["Mailer Box", "Print shipping box", "Shop orders"],
  ["Gusseted Paper Bag", "Bakery bag", "Shop orders"],
  ["Reverse Tuck End Box", "Perfume carton", null],
];
for (const [t, n, f] of dielines) await newDieline(t, n, f);

// Hexagon box in the linen material
await page.getByRole("button", { name: /Hexagon gift box/ }).first().click();
await page.selectOption(".cfg select.sel", { label: "Linen board 300 gsm" });
await page.waitForTimeout(400);

// ---------- settings: machine so the mat outline shows ----------
await go("/settings");
await page.selectOption("select[aria-label='My machine']", { label: "Cricut Maker / Explore — 12×24\" mat" });
await shot("07-settings-general");
await go("/settings/appearance");
await shot("08-settings-appearance");
await go("/settings/sync");
await shot("09-settings-sync");
await go("/settings/language");
await shot("10-settings-language");

// ---------- workspace ----------
await go("/");
await page.getByRole("button", { name: /Perfume carton/ }).first().click();
await page.waitForSelector(".cfg");
await shot("02-workspace", { wait: 900 });

await page.getByRole("button", { name: /Hexagon gift box/ }).first().click();
await page.click(".swap");
await page.waitForTimeout(1500);
await page.fill(".fold input[type=range]", "0.6");
await shot("03-fold-3d", { wait: 900 });
await page.fill(".fold input[type=range]", "1");
await shot("03b-folded-3d", { wait: 700 });

await page.getByRole("button", { name: /Jewellery drawer/ }).first().click();
await page.waitForTimeout(800);
await page.fill(".fold input[type=range]", "0.5");
await shot("13-multi-part-assembly", { wait: 900 });
await page.click(".swap"); // back to the dieline view for later shots

// ---------- dialogs ----------
await go("/new");
await shot("05-new-dieline", { wait: 800 });
await go("/");
await page.getByRole("button", { name: /Perfume carton/ }).first().click();
await go("/export");
await shot("06-export");

// ---------- dark mode and accents ----------
const setAppearance = async (scheme, accent) => {
  await go("/settings/appearance");
  if (scheme) await page.getByRole("button", { name: scheme, exact: true }).click();
  if (accent) await page.getByRole("button", { name: accent, exact: true }).click();
  await go("/");
  await page.getByRole("button", { name: /Perfume carton/ }).first().click();
  await page.waitForTimeout(700);
};
await go("/");
await page.getByRole("button", { name: /Perfume carton/ }).first().click();
await setAppearance("Dark", null);
await shot("14-dark-workspace", { wait: 900 });
await go("/settings/appearance");
await shot("15-dark-settings");
await setAppearance("Light", null);
for (const [id, accent] of [["terracotta", "Terracotta"], ["lavender", "Lavender"], ["marigold", "Marigold"], ["ocean", "Ocean"], ["rose", "Rose"]]) {
  await setAppearance(null, accent);
  await shot(`16-accent-${id}`, { wait: 700 });
}
await setAppearance(null, "Seafoam");

// ---------- phone ----------
const state = await ctx.storageState({ indexedDB: true });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "light", storageState: state, isMobile: true, hasTouch: true });
const p2 = await phone.newPage();
await p2.goto(BASE);
await p2.waitForSelector(".cfg");
await p2.waitForTimeout(1200);
await p2.screenshot({ path: `${OUT}17-phone.png` });
console.log("shot 17-phone");
await phone.close();

// ---------- empty materials library (separate profile) ----------
const empty = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", locale: "en-US" });
const p3 = await empty.newPage();
await p3.goto(`${BASE}#/materials`);
await p3.waitForSelector(".detail");
for (let i = 0; i < 4; i++) {
  await p3.getByRole("button", { name: "Delete", exact: true }).click();
  await p3.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await p3.waitForTimeout(300);
}
await p3.waitForSelector(".empty-detail");
await p3.waitForTimeout(400);
await p3.screenshot({ path: `${OUT}18-materials-empty.png` });
console.log("shot 18-materials-empty");

await browser.close();
