import { app, dialog } from "electron";
import updaterPackage from "electron-updater";

const { autoUpdater } = updaterPackage;

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

export type DesktopUpdateStatus =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "downloading"; percent: number; version: string | null }
  | { phase: "ready"; version: string | null };

let isUpdaterInitialized = false;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;
let autoUpdaterStatus: DesktopUpdateStatus = { phase: "idle" };

const statusListeners = new Set<
  (status: DesktopUpdateStatus) => void
>();

const setAutoUpdaterStatus = (nextStatus: DesktopUpdateStatus) => {
  autoUpdaterStatus = nextStatus;

  for (const listener of statusListeners) {
    listener(autoUpdaterStatus);
  }
};

const getTrackedUpdateVersion = () => {
  if (
    autoUpdaterStatus.phase === "downloading" ||
    autoUpdaterStatus.phase === "ready"
  ) {
    return autoUpdaterStatus.version;
  }

  return null;
};

export const getAutoUpdaterStatus = () => {
  return autoUpdaterStatus;
};

export const onAutoUpdaterStatus = (
  listener: (status: DesktopUpdateStatus) => void
) => {
  statusListeners.add(listener);
  listener(autoUpdaterStatus);

  return () => {
    statusListeners.delete(listener);
  };
};

export const quitAndInstallUpdate = () => {
  autoUpdater.quitAndInstall();
};

export const startAutoUpdater = ({
  initialDelayMs = 3000,
}: { initialDelayMs?: number } = {}) => {
  if (!app.isPackaged || isUpdaterInitialized) {
    return;
  }

  isUpdaterInitialized = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  setTimeout(() => {
    if (!app.isReady()) {
      return;
    }

    initAutoUpdater();
  }, initialDelayMs);
};

const initAutoUpdater = () => {
  autoUpdater.on("error", (error) => {
    setAutoUpdaterStatus({ phase: "idle" });
    console.error("Auto-updater error", error);
  });

  autoUpdater.on("checking-for-update", () => {
    setAutoUpdaterStatus({ phase: "checking" });
    console.info("Checking for desktop updates");
  });

  autoUpdater.on("update-available", (info: { version?: string | null }) => {
    setAutoUpdaterStatus({
      phase: "downloading",
      percent: 0,
      version: info.version ?? null,
    });
    console.info("Desktop update available");
  });

  autoUpdater.on("update-not-available", () => {
    setAutoUpdaterStatus({ phase: "idle" });
    console.info("Desktop update not available");
  });

  autoUpdater.on(
    "download-progress",
    (progress: { percent: number; total: number; transferred: number }) => {
      setAutoUpdaterStatus({
        phase: "downloading",
        percent: progress.percent,
        version: getTrackedUpdateVersion(),
      });

      console.info(
        `Desktop update download ${progress.percent.toFixed(1)}% (${progress.transferred}/${progress.total})`,
      );
    },
  );

  autoUpdater.on(
    "update-downloaded",
    async (info: { releaseName?: string | null; version?: string | null }) => {
      setAutoUpdaterStatus({
        phase: "ready",
        version: info.version ?? getTrackedUpdateVersion(),
      });

      const { response } = await dialog.showMessageBox({
        type: "info",
        buttons: ["Restart", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "PunchPress Update Ready",
        message: info.releaseName || `PunchPress ${info.version}`,
        detail:
          "A new version has been downloaded. Restart PunchPress now to finish installing it.",
      });

      if (response === 0) {
        quitAndInstallUpdate();
      }
    },
  );

  void checkForUpdates();

  updateCheckTimer = setInterval(() => {
    void checkForUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);
};

const checkForUpdates = async () => {
  try {
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    setAutoUpdaterStatus({ phase: "idle" });
    console.error("Failed to check for desktop updates", error);
  }
};
