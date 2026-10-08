import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PUNCHPRESS_TEST_PORT ?? 4173);
// PUNCHPRESS_PERF_PROD=1 measures a production build (no dev React, no
// StrictMode double effects) served by `vite preview`. The perf build keeps
// the editor automation handle through VITE_PUNCHPRESS_PERF_BUILD.
const isProductionBuild = process.env.PUNCHPRESS_PERF_PROD === "1";
const productionOutDir = "dist/perf";

export default defineConfig({
  testDir: "./apps/web/tests/performance",
  testIgnore: "**/unit/**",
  fullyParallel: false,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: isProductionBuild
    ? {
        command: `VITE_PUNCHPRESS_PERF_BUILD=1 bun run --cwd apps/web build --outDir ${productionOutDir} && bun run --cwd apps/web preview --outDir ${productionOutDir} --host 127.0.0.1 --port ${port} --strictPort`,
        port,
        // A running dev server on the port would silently replace the build.
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : {
        command: `bun run --cwd apps/web dev --host 127.0.0.1 --port ${port}`,
        port,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
