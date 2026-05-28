import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle01Icon,
  Download04Icon,
  Loading03Icon,
} from "@hugeicons-pro/core-stroke-rounded";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDesktopUpdateStatus } from "@/hooks/use-desktop-update-status";

export const DesktopUpdateIndicator = () => {
  const { isDesktopShell, restartToUpdate, status } = useDesktopUpdateStatus();
  const isReady = status.phase === "ready";
  const [actionState, setActionState] = useState<
    "ready" | "preparing" | "restart"
  >("ready");

  useEffect(() => {
    if (!isReady) {
      setActionState("ready");
    }
  }, [isReady]);

  if (!(isDesktopShell && isReady)) {
    return null;
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
