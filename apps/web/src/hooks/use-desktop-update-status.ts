import { useEffect, useState } from "react";
import { useElectronIpcEvent } from "@/hooks/use-electron-ipc-event";
import type { DesktopUpdateStatus } from "@/platform/electron";

const IDLE_UPDATE_STATUS: DesktopUpdateStatus = { phase: "idle" };
const PREVIEW_UPDATE_STATUS: DesktopUpdateStatus = {
  phase: "ready",
  version: null,
};
const shouldPreviewUpdater =
  import.meta.env.VITE_PUNCHPRESS_PREVIEW_DESKTOP_UPDATER === "1";

export const useDesktopUpdateStatus = () => {
  const updaterCommands =
    typeof window === "undefined"
      ? undefined
      : window.electron?.updaterCommands;
  const [status, setStatus] = useState<DesktopUpdateStatus>(IDLE_UPDATE_STATUS);

  useElectronIpcEvent(
    shouldPreviewUpdater ? undefined : updaterCommands?.onStatusChange,
    (nextStatus) => {
      setStatus(nextStatus);
    }
  );

  useEffect(() => {
    if (shouldPreviewUpdater) {
      setStatus(PREVIEW_UPDATE_STATUS);
      return;
    }

    if (!updaterCommands) {
      setStatus(IDLE_UPDATE_STATUS);
      return;
    }

    let isSubscribed = true;

    updaterCommands
      .getStatus()
      .then((nextStatus) => {
        if (isSubscribed) {
          setStatus(nextStatus);
        }
      })
      .catch(() => undefined);

    return () => {
      isSubscribed = false;
    };
  }, [updaterCommands]);

  const restartToUpdate = () => {
    if (shouldPreviewUpdater) {
      return Promise.resolve();
    }

    return updaterCommands?.restartToUpdate() ?? Promise.resolve();
  };

  return {
    isDesktopShell: Boolean(updaterCommands) || shouldPreviewUpdater,
    restartToUpdate,
    status,
  };
};
