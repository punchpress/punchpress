import { beforeEach, describe, expect, mock, test } from "bun:test";

const autoUpdaterListeners = new Map<string, (...args: unknown[]) => unknown>();
const checkForUpdatesAndNotifyMock = mock(async () => undefined);
const quitAndInstallMock = mock(() => undefined);
const showMessageBoxMock = mock(async () => ({ response: 1 }));

mock.module("electron", () => ({
  app: {
    isPackaged: true,
    isReady: () => true,
  },
  dialog: {
    showMessageBox: showMessageBoxMock,
  },
}));

mock.module("electron-updater", () => ({
  default: {
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      checkForUpdatesAndNotify: checkForUpdatesAndNotifyMock,
      on: (
        eventName: string,
        listener: (...args: unknown[]) => unknown,
      ) => {
        autoUpdaterListeners.set(eventName, listener);
      },
      quitAndInstall: quitAndInstallMock,
    },
  },
}));

const importAppUpdater = () => {
  return import(`./app-updater.ts?test=${crypto.randomUUID()}`);
};

const flushTimeout = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("desktop app updater", () => {
  beforeEach(() => {
    autoUpdaterListeners.clear();
    checkForUpdatesAndNotifyMock.mockClear();
    quitAndInstallMock.mockClear();
    showMessageBoxMock.mockClear();
    showMessageBoxMock.mockResolvedValue({ response: 1 });
  });

  test("publishes download progress and keeps the ready state when restart is deferred", async () => {
    const {
      getAutoUpdaterStatus,
      onAutoUpdaterStatus,
      startAutoUpdater,
    } = await importAppUpdater();
    const seenStatuses: Array<Record<string, unknown>> = [];

    onAutoUpdaterStatus((status) => {
      seenStatuses.push(status);
    });

    startAutoUpdater({ initialDelayMs: 0 });
    await flushTimeout();

    expect(checkForUpdatesAndNotifyMock).toHaveBeenCalledTimes(1);

    autoUpdaterListeners.get("checking-for-update")?.();
    autoUpdaterListeners.get("update-available")?.({ version: "0.2.1" });
    autoUpdaterListeners.get("download-progress")?.({
      percent: 41.6,
      total: 120,
      transferred: 50,
    });
    await autoUpdaterListeners.get("update-downloaded")?.({
      releaseName: "PunchPress 0.2.1",
      version: "0.2.1",
    });

    expect(seenStatuses).toEqual([
      { phase: "idle" },
      { phase: "checking" },
      { percent: 0, phase: "downloading", version: "0.2.1" },
      { percent: 41.6, phase: "downloading", version: "0.2.1" },
      { phase: "ready", version: "0.2.1" },
    ]);
    expect(getAutoUpdaterStatus()).toEqual({
      phase: "ready",
      version: "0.2.1",
    });
    expect(showMessageBoxMock).toHaveBeenCalledTimes(1);
    expect(quitAndInstallMock).not.toHaveBeenCalled();
  });

  test("restarts immediately when the update dialog chooses restart", async () => {
    showMessageBoxMock.mockResolvedValueOnce({ response: 0 });

    const { startAutoUpdater } = await importAppUpdater();

    startAutoUpdater({ initialDelayMs: 0 });
    await flushTimeout();

    await autoUpdaterListeners.get("update-downloaded")?.({
      releaseName: "PunchPress 0.2.2",
      version: "0.2.2",
    });

    expect(quitAndInstallMock).toHaveBeenCalledTimes(1);
  });
});
