import { app, dialog } from "electron";
import updaterPackage from "electron-updater";

const { autoUpdater } = updaterPackage;

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

export type DesktopUpdateStatus =
  | { phase: "idle" }
  | { phase: "checking"; initiation: "automatic" | "manual" }
  | {
      phase: "downloading";
      initiation: "automatic" | "manual";
      percent: number;
      version: string | null;
    }
  | { phase: "ready"; version: string | null }
  | { phase: "up-to-date" }
  | { phase: "error" };

let isUpdaterInitialized = false;
let areUpdaterListenersRegistered = false;
let checkRunId = 0;
let autoUpdaterStatus: DesktopUpdateStatus = { phase: "idle" };
let activeInitiation: "automatic" | "manual" = "automatic";
let requestQuitAndInstallHandler: (() => void) | null = null;

const statusListeners = new Set<(status: DesktopUpdateStatus) => void>();

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

export const onRequestQuitAndInstallUpdate = (handler: (() => void) | null) => {
  requestQuitAndInstallHandler = handler;
};

export const requestQuitAndInstallUpdate = () => {
  if (requestQuitAndInstallHandler) {
    requestQuitAndInstallHandler();
    return;
  }

  autoUpdater.quitAndInstall();
};

export const quitAndInstallUpdate = () => {
  autoUpdater.quitAndInstall();
};

export const requestCheckForUpdates = async () => {
  if (!isUpdaterInitialized) {
    setAutoUpdaterStatus({ phase: "error" });
    return;
  }

  if (!areUpdaterListenersRegistered) {
    initAutoUpdater(false);
  }

  if (autoUpdaterStatus.phase === "ready") {
    return;
  }

  if (autoUpdaterStatus.phase === "downloading") {
    activeInitiation = "manual";
    setAutoUpdaterStatus({ ...autoUpdaterStatus, initiation: "manual" });
    return;
  }

  if (autoUpdaterStatus.phase === "checking") {
    activeInitiation = "manual";
    setAutoUpdaterStatus({ phase: "checking", initiation: "manual" });
    return;
  }

  activeInitiation = "manual";
  setAutoUpdaterStatus({ phase: "checking", initiation: "manual" });
  await checkForUpdates(true);
};

export const startAutoUpdater = ({
  initialDelayMs = 3000,
}: {
  initialDelayMs?: number;
} = {}) => {
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

    initAutoUpdater(true);
  }, initialDelayMs);
};

const initAutoUpdater = (runInitialCheck: boolean) => {
  if (areUpdaterListenersRegistered) {
    return;
  }

  areUpdaterListenersRegistered = true;
  autoUpdater.on("error", (error) => {
    setAutoUpdaterStatus(
      activeInitiation === "manual" ? { phase: "error" } : { phase: "idle" }
    );
    activeInitiation = "automatic";
    console.error("Auto-updater error", error);
  });

  autoUpdater.on("checking-for-update", () => {
    if (
      autoUpdaterStatus.phase !== "checking" ||
      autoUpdaterStatus.initiation !== activeInitiation
    ) {
      setAutoUpdaterStatus({ phase: "checking", initiation: activeInitiation });
    }
    console.info("Checking for desktop updates");
  });

  autoUpdater.on("update-available", (info: { version?: string | null }) => {
    setAutoUpdaterStatus({
      phase: "downloading",
      initiation: activeInitiation,
      percent: 0,
      version: info.version ?? null,
    });
    console.info("Desktop update available");
  });

  autoUpdater.on("update-not-available", () => {
    setAutoUpdaterStatus(
      activeInitiation === "manual"
        ? { phase: "up-to-date" }
        : { phase: "idle" }
    );
    activeInitiation = "automatic";
    console.info("Desktop update not available");
  });

  autoUpdater.on(
    "download-progress",
    (progress: { percent: number; total: number; transferred: number }) => {
      setAutoUpdaterStatus({
        phase: "downloading",
        initiation:
          autoUpdaterStatus.phase === "downloading"
            ? autoUpdaterStatus.initiation
            : activeInitiation,
        percent: progress.percent,
        version: getTrackedUpdateVersion(),
      });

      console.info(
        `Desktop update download ${progress.percent.toFixed(1)}% (${progress.transferred}/${progress.total})`
      );
    }
  );

  autoUpdater.on(
    "update-downloaded",
    async (info: { releaseName?: string | null; version?: string | null }) => {
      setAutoUpdaterStatus({
        phase: "ready",
        version: info.version ?? getTrackedUpdateVersion(),
      });
      activeInitiation = "automatic";

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
        requestQuitAndInstallUpdate();
      }
    }
  );

  if (runInitialCheck) {
    checkForUpdates().catch((error) => {
      console.error(error);
    });
  }

  setInterval(() => {
    checkForUpdates().catch((error) => {
      console.error(error);
    });
  }, UPDATE_CHECK_INTERVAL_MS);
};

const checkForUpdates = async (manual = false) => {
  if (
    autoUpdaterStatus.phase === "ready" ||
    autoUpdaterStatus.phase === "downloading" ||
    (autoUpdaterStatus.phase === "checking" && !manual)
  ) {
    return;
  }

  if (autoUpdaterStatus.phase !== "checking") {
    activeInitiation = "automatic";
  }

  const runId = ++checkRunId;
  try {
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    if (runId !== checkRunId) {
      return;
    }

    if (autoUpdaterStatus.phase !== "error") {
      setAutoUpdaterStatus(
        activeInitiation === "manual" ? { phase: "error" } : { phase: "idle" }
      );
    }
    activeInitiation = "automatic";
    console.error("Failed to check for desktop updates", error);
  }
};
