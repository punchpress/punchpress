import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/desktop/tests/performance",
  fullyParallel: false,
  globalSetup: "./apps/desktop/tests/performance/global-setup.ts",
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  retries: 0,
  use: {
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run --cwd apps/web dev --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
