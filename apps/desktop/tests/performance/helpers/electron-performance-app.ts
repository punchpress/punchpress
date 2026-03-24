import path from "node:path";
import { expect } from "@playwright/test";
import {
  type ElectronApplication,
  _electron as electron,
  type Page,
} from "playwright";

const DEFAULT_DESKTOP_DEV_SERVER_URL = "http://127.0.0.1:4173";
const DEFAULT_TRACE_BUFFER_SIZE_KB = 150 * 1024;

const TRACE_CONFIG = {
  included_categories: [
    "blink",
    "browser",
    "cc",
    "devtools.timeline",
    "disabled-by-default-devtools.timeline",
    "gpu",
    "input",
    "renderer_host",
    "scheduler",
    "toplevel",
  ],
  recording_mode: "record-continuously" as const,
  trace_buffer_size_in_kb: Number(
    process.env.PUNCHPRESS_DESKTOP_TRACE_BUFFER_KB ||
      DEFAULT_TRACE_BUFFER_SIZE_KB
  ),
};

const getDesktopAppPath = () => {
  return path.join(process.cwd(), "apps", "desktop", "out", "main", "index.js");
};

const getDesktopWorkingDirectory = () => {
  return path.join(process.cwd(), "apps", "desktop");
};

const getRendererDevServerUrl = () => {
  return (
    process.env.PUNCHPRESS_DESKTOP_DEV_SERVER_URL ||
    process.env.VITE_DEV_SERVER_URL ||
    DEFAULT_DESKTOP_DEV_SERVER_URL
  );
};

export const launchDesktopPerformanceApp = async (): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> => {
  const electronApp = await electron.launch({
    args: [getDesktopAppPath()],
    cwd: getDesktopWorkingDirectory(),
    env: {
      ...process.env,
      ELECTRON_IS_DEV: "1",
      VITE_DEV_SERVER_URL: getRendererDevServerUrl(),
    },
  });
  const page = await electronApp.firstWindow();

  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("button", { name: "Text (T)" })).toBeVisible();

  return {
    electronApp,
    page,
  };
};

export const startElectronTraceCapture = async (
  electronApp: ElectronApplication
) => {
  await electronApp.evaluate(async ({ contentTracing }, traceConfig) => {
    await contentTracing.startRecording(traceConfig);
  }, TRACE_CONFIG);

  return {
    stop: async (traceArtifactPath: string) => {
      return await electronApp.evaluate(
        async ({ contentTracing }, resultFilePath) => {
          return await contentTracing.stopRecording(resultFilePath);
        },
        traceArtifactPath
      );
    },
  };
};
