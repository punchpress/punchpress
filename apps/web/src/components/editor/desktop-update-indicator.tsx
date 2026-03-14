import { ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDesktopUpdateStatus } from "@/hooks/use-desktop-update-status";

const getProgressWedge = ({
  background,
  fill,
  percent,
}: {
  background: string;
  fill: string;
  percent: number;
}) => {
  const clamped = Math.max(1, Math.min(percent, 100));
  const sweep = clamped * 3.6;
  return `conic-gradient(from 0deg, ${fill} 0deg, ${fill} ${sweep}deg, ${background} ${sweep}deg, ${background} 360deg)`;
};

const getProgressMask = ({
  fillOpaque,
  percent,
}: {
  fillOpaque: boolean;
  percent: number;
}) => {
  const clamped = Math.max(1, Math.min(percent, 100));
  const sweep = clamped * 3.6;
  const fill = fillOpaque ? "#000" : "transparent";
  const background = fillOpaque ? "transparent" : "#000";
  return `conic-gradient(from 0deg, ${fill} 0deg, ${fill} ${sweep}deg, ${background} ${sweep}deg, ${background} 360deg)`;
};

export const DesktopUpdateIndicator = () => {
  const { isDesktopShell, restartToUpdate, status } = useDesktopUpdateStatus();
  const isReady = status.phase === "ready";
  const [isWindowFocused, setIsWindowFocused] = useState(() => {
    if (typeof document === "undefined") {
      return true;
    }

    return document.hasFocus();
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleFocus = () => {
      setIsWindowFocused(true);
    };
    const handleBlur = () => {
      setIsWindowFocused(false);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);
  const [ellipsisFrame, setEllipsisFrame] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || isReady) {
      setEllipsisFrame(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setEllipsisFrame((current) => (current + 1) % 4);
    }, 640);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isReady]);

  if (
    !isDesktopShell ||
    status.phase === "idle" ||
    status.phase === "checking"
  ) {
    return null;
  }

  const progressPercent =
    status.phase === "downloading" ? Math.round(status.percent) : 100;
  const bubbleBackground = isWindowFocused ? "#AEC9FF" : "#D7D7D7";
  const bubbleBorder = isWindowFocused ? "#517fff" : "#ababab";
  const bubbleWedge = isWindowFocused ? "#2B7FFF" : "#ababab";
  const bubbleIconDark = isWindowFocused ? "#1E4A97" : "#767676";
  const bubbleIconLight = isWindowFocused ? "#DCEAFF" : "#F3F3F3";
  const tooltipMessage = isReady
    ? "A PunchPress update is ready to install."
    : "A PunchPress update is downloading in the background. Hang tight.";
  const ellipsis = ".".repeat(ellipsisFrame);

  return (
    <div
      className="no-drag absolute z-30"
      style={{
        left: "var(--desktop-update-indicator-left, 8px)",
        top: "var(--desktop-update-indicator-top, 6px)",
      }}
    >
      <div
        aria-live="polite"
        className="no-drag group relative flex items-center gap-2 text-[11px]"
      >
        <span
          aria-hidden="true"
          className="relative flex size-[14px] shrink-0 items-center justify-center rounded-full border-[0.5px]"
          style={{
            background: isReady
              ? bubbleWedge
              : getProgressWedge({
                  background: bubbleBackground,
                  fill: bubbleWedge,
                  percent: progressPercent,
                }),
            borderColor: bubbleBorder,
          }}
        >
          {isReady ? (
            <ChevronDownIcon
              className="size-[9px] opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
              strokeWidth={4.25}
              style={{ color: bubbleIconLight }}
            />
          ) : (
            <>
              <span
                className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
                style={{
                  WebkitMaskImage: getProgressMask({
                    fillOpaque: false,
                    percent: progressPercent,
                  }),
                  maskImage: getProgressMask({
                    fillOpaque: false,
                    percent: progressPercent,
                  }),
                }}
              >
                <ChevronDownIcon
                  className="size-[9px]"
                  strokeWidth={4.25}
                  style={{ color: bubbleIconDark }}
                />
              </span>

              <span
                className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
                style={{
                  WebkitMaskImage: getProgressMask({
                    fillOpaque: true,
                    percent: progressPercent,
                  }),
                  maskImage: getProgressMask({
                    fillOpaque: true,
                    percent: progressPercent,
                  }),
                }}
              >
                <ChevronDownIcon
                  className="size-[9px]"
                  strokeWidth={4.25}
                  style={{ color: bubbleIconLight }}
                />
              </span>
            </>
          )}
        </span>

        <span className="font-medium text-foreground tracking-[0.01em]">
          {isReady ? "Update ready" : "Update in progress"}
          {!isReady && (
            <span className="inline-block min-w-[12px] text-left tabular-nums">
              {ellipsis}
            </span>
          )}
        </span>

        {isReady && (
          <Button
            className="rounded-full px-2.5"
            onClick={() => {
              restartToUpdate().catch(() => undefined);
            }}
            size="xs"
            variant="ghost"
          >
            Restart
          </Button>
        )}

        <div className="pointer-events-none absolute top-[calc(100%+10px)] left-[-8px] z-10 w-56 translate-y-1 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
          <div className="rounded-2xl border border-[color:rgba(15,23,42,0.14)] bg-[color:rgba(255,255,255,0.96)] px-3 py-2.5 shadow-[0_16px_44px_rgba(15,23,42,0.18),0_3px_10px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-[11px] text-[var(--designer-text-muted)] leading-4">
              {tooltipMessage}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
