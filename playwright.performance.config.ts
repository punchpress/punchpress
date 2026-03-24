import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/tests/performance",
  fullyParallel: false,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
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
  webServer: {
    command: "bun run --cwd apps/web dev --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
