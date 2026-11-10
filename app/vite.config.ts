/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works from any sub-path (NAS reverse proxy), file:// and Tauri.
export default defineConfig({
  base: "./",
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true, host: true },
  build: { target: "es2021", chunkSizeWarningLimit: 1200 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
