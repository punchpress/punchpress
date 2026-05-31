import { useEffect, useState } from "react";
import { useElectronIpcEvent } from "@/hooks/use-electron-ipc-event";
import type { DesktopUpdateStatus } from "@/platform/electron";

const IDLE_UPDATE_STATUS: DesktopUpdateStatus = { phase: "idle" };

export const useDesktopUpdateStatus = () => {
  const updaterCommands =
    typeof window === "undefined"
      ? undefined
      : window.electron?.updaterCommands;
  const [status, setStatus] = useState<DesktopUpdateStatus>(IDLE_UPDATE_STATUS);

  useElectronIpcEvent(updaterCommands?.onStatusChange, (nextStatus) => {
    setStatus(nextStatus);
  });

  useEffect(() => {
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
    return updaterCommands?.restartToUpdate() ?? Promise.resolve();
  };

  return {
    isDesktopShell: Boolean(updaterCommands),
    restartToUpdate,
    status,
  };
};
