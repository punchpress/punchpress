import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Download04Icon,
  Loading03Icon,
} from "@hugeicons-pro/core-stroke-rounded";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDesktopUpdateStatus } from "@/hooks/use-desktop-update-status";
import type { DesktopUpdateStatus } from "@/platform/electron";

export const DesktopUpdateIndicator = () => {
  const { isDesktopShell, restartToUpdate, status } = useDesktopUpdateStatus();
  const isReady = status.phase === "ready";
  const [actionState, setActionState] = useState<
    "ready" | "preparing" | "restart"
  >("ready");
  const [dismissedStatus, setDismissedStatus] =
    useState<DesktopUpdateStatus | null>(null);

  useEffect(() => {
    if (!isReady) {
      setActionState("ready");
    }
  }, [isReady]);

  useEffect(() => {
    if (status.phase !== "up-to-date" && status.phase !== "error") {
      return;
    }

    const timeout = window.setTimeout(() => setDismissedStatus(status), 8000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const isManualFeedback =
    status.phase === "checking" || status.phase === "downloading"
      ? status.initiation === "manual"
      : status.phase === "up-to-date" || status.phase === "error";

  if (
    !(isDesktopShell && (isReady || isManualFeedback)) ||
    dismissedStatus === status
  ) {
    return null;
  }

  if (!isReady) {
    const label = getFeedbackLabel(status);
    let Icon = Loading03Icon;
    if (status.phase === "error") {
      Icon = AlertCircleIcon;
    } else if (status.phase === "up-to-date") {
      Icon = CheckmarkCircle01Icon;
    }

    return (
      <output
        aria-live="polite"
        className="no-drag pointer-events-auto flex h-full shrink-0 translate-y-[3px] items-center gap-1.5 pr-3 text-xs"
      >
        <HugeiconsIcon
          className={
            status.phase === "checking" || status.phase === "downloading"
              ? "animate-spin"
              : undefined
          }
          color="currentColor"
          icon={Icon}
          size={15}
          strokeWidth={2}
        />
        <span>{label}</span>
      </output>
    );
  }

  const handleClick = () => {
    if (actionState === "restart") {
      restartToUpdate().catch(() => undefined);
      return;
    }

    if (actionState === "preparing") {
      return;
    }

    setActionState("preparing");
    window.setTimeout(() => {
      setActionState("restart");
    }, 720);
  };
  let Icon = Download04Icon;
  if (actionState === "preparing") {
    Icon = Loading03Icon;
  } else if (actionState === "restart") {
    Icon = CheckmarkCircle01Icon;
  }
  const label =
    actionState === "restart" ? "Restart To Apply Update" : "Update";

  return (
    <div
      className="no-drag pointer-events-auto flex h-full shrink-0 translate-y-[3px] items-center pr-2"
      style={{ WebkitAppRegion: "no-drag" }}
    >
      <Button
        aria-live="polite"
        disabled={actionState === "preparing"}
        onClick={handleClick}
        size="sm"
        variant="default"
      >
        <HugeiconsIcon
          className={actionState === "preparing" ? "animate-spin" : undefined}
          color="currentColor"
          icon={Icon}
          size={16}
          strokeWidth={2}
        />
        <span>{label}</span>
      </Button>
    </div>
  );
};

const getFeedbackLabel = (status: DesktopUpdateStatus) => {
  switch (status.phase) {
    case "checking":
      return "Checking for updates...";
    case "downloading":
      return `Downloading update ${Math.round(status.percent)}%`;
    case "up-to-date":
      return "PunchPress is up to date";
    case "error":
      return "Could not check for updates";
    case "idle":
    case "ready":
      return "";
    default:
      return "";
  }
};
