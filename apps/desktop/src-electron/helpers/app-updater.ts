import { app, dialog } from "electron";
import updaterPackage from "electron-updater";

const { autoUpdater } = updaterPackage;

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

let isUpdaterInitialized = false;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;

export const startAutoUpdater = () => {
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
  }, 3000);
};

const initAutoUpdater = () => {
  autoUpdater.on("error", (error) => {
    console.error("Auto-updater error", error);
  });

  autoUpdater.on("checking-for-update", () => {
    console.info("Checking for desktop updates");
  });

  autoUpdater.on("update-available", () => {
    console.info("Desktop update available");
  });

  autoUpdater.on("update-not-available", () => {
    console.info("Desktop update not available");
  });

  autoUpdater.on("download-progress", (progress) => {
    console.info(
      `Desktop update download ${progress.percent.toFixed(1)}% (${progress.transferred}/${progress.total})`,
    );
  });

  autoUpdater.on("update-downloaded", async (info) => {
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
      autoUpdater.quitAndInstall();
    }
  });

  void checkForUpdates();

  updateCheckTimer = setInterval(() => {
    void checkForUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);
};

const checkForUpdates = async () => {
  try {
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    console.error("Failed to check for desktop updates", error);
  }
};
