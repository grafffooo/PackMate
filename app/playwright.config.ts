import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:4173", launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] } },
  webServer: { command: "pnpm build:web && pnpm preview --port 4173 --strictPort --host 127.0.0.1", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
