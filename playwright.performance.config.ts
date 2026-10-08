import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PUNCHPRESS_TEST_PORT ?? 4173);

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
  webServer: {
    command: `bun run --cwd apps/web dev --host 127.0.0.1 --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
