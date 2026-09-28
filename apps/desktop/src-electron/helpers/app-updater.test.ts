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
      { phase: "checking", initiation: "automatic" },
      { percent: 0, phase: "downloading", initiation: "automatic", version: "0.2.1" },
      { percent: 41.6, phase: "downloading", initiation: "automatic", version: "0.2.1" },
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

  test("keeps automatic checks quiet and reports manual up-to-date feedback", async () => {
    const { getAutoUpdaterStatus, requestCheckForUpdates, startAutoUpdater } =
      await importAppUpdater();

    startAutoUpdater({ initialDelayMs: 0 });
    await flushTimeout();
    autoUpdaterListeners.get("checking-for-update")?.();
    expect(getAutoUpdaterStatus()).toEqual({
      phase: "checking",
      initiation: "automatic",
    });
    autoUpdaterListeners.get("update-not-available")?.();
    expect(getAutoUpdaterStatus()).toEqual({ phase: "idle" });

    await requestCheckForUpdates();
    expect(checkForUpdatesAndNotifyMock).toHaveBeenCalledTimes(2);
    expect(getAutoUpdaterStatus()).toEqual({
      phase: "checking",
      initiation: "manual",
    });
    autoUpdaterListeners.get("update-not-available")?.();
    expect(getAutoUpdaterStatus()).toEqual({ phase: "up-to-date" });
  });

  test("manual check keeps download visible and reports a service error", async () => {
    const { getAutoUpdaterStatus, requestCheckForUpdates, startAutoUpdater } =
      await importAppUpdater();

    startAutoUpdater({ initialDelayMs: 0 });
    await flushTimeout();
    autoUpdaterListeners.get("update-not-available")?.();

    await requestCheckForUpdates();
    autoUpdaterListeners.get("update-available")?.({ version: "0.2.3" });
    expect(getAutoUpdaterStatus()).toEqual({
      phase: "downloading",
      initiation: "manual",
      percent: 0,
      version: "0.2.3",
    });

    autoUpdaterListeners.get("error")?.(new Error("network unavailable"));
    expect(getAutoUpdaterStatus()).toEqual({ phase: "error" });
  });

  test("manual check reports a rejected request as an error", async () => {
    const { getAutoUpdaterStatus, requestCheckForUpdates, startAutoUpdater } =
      await importAppUpdater();

    startAutoUpdater({ initialDelayMs: 0 });
    await flushTimeout();
    autoUpdaterListeners.get("update-not-available")?.();
    checkForUpdatesAndNotifyMock.mockRejectedValueOnce(new Error("offline"));

    await requestCheckForUpdates();

    expect(getAutoUpdaterStatus()).toEqual({ phase: "error" });
  });

  test("manual check can start before the scheduled automatic check", async () => {
    const { getAutoUpdaterStatus, requestCheckForUpdates, startAutoUpdater } =
      await importAppUpdater();

    startAutoUpdater({ initialDelayMs: 20 });
    await requestCheckForUpdates();
    autoUpdaterListeners.get("update-not-available")?.();
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(checkForUpdatesAndNotifyMock).toHaveBeenCalledTimes(1);
    expect(getAutoUpdaterStatus()).toEqual({ phase: "up-to-date" });
  });

  test("an automatic failure stays visible after a manual check joins it", async () => {
    let rejectCheck: ((reason: Error) => void) | undefined;
    checkForUpdatesAndNotifyMock.mockImplementationOnce(
      () => new Promise((_, reject) => { rejectCheck = reject; })
    );
    const { getAutoUpdaterStatus, requestCheckForUpdates, startAutoUpdater } =
      await importAppUpdater();

    startAutoUpdater({ initialDelayMs: 0 });
    await flushTimeout();
    autoUpdaterListeners.get("checking-for-update")?.();
    await requestCheckForUpdates();
    rejectCheck?.(new Error("offline"));
    await flushTimeout();

    expect(checkForUpdatesAndNotifyMock).toHaveBeenCalledTimes(1);
    expect(getAutoUpdaterStatus()).toEqual({ phase: "error" });
  });
});
