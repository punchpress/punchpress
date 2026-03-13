import { DownloadIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesktopUpdateStatus } from "@/hooks/use-desktop-update-status";

const getUpdateProgressFill = (percent: number) => {
  const clampedPercent = Math.max(4, Math.min(percent, 100));
  const sweep = clampedPercent * 3.6;
  const trackColor = "color-mix(in srgb, var(--info) 16%, transparent)";

  return `conic-gradient(from -90deg, var(--info) 0deg, var(--info) ${sweep}deg, ${trackColor} ${sweep}deg, ${trackColor} 360deg)`;
};

export const DesktopUpdateIndicator = () => {
  const { isDesktopShell, restartToUpdate, status } = useDesktopUpdateStatus();

  if (
    !isDesktopShell ||
    status.phase === "idle" ||
    status.phase === "checking"
  ) {
    return null;
  }

  const isReady = status.phase === "ready";
  const progressPercent =
    status.phase === "downloading" ? Math.round(status.percent) : 100;

  return (
    <div className="pointer-events-none absolute top-1.5 left-[calc(var(--desktop-drag-left-inset,0px)+8px)] z-30">
      <section
        aria-live="polite"
        className="pointer-events-auto flex min-h-8 items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--info)_14%,var(--designer-border))] bg-[color:color-mix(in_srgb,var(--designer-surface)_90%,transparent)] py-1 pr-1 pl-1.5 text-[11px] text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-md"
        style={{ WebkitAppRegion: "no-drag" }}
      >
        <span
          aria-hidden="true"
          className="relative flex size-5 items-center justify-center rounded-full"
          style={{
            background: getUpdateProgressFill(progressPercent),
          }}
        >
          <span className="absolute inset-[3px] rounded-full bg-[var(--designer-surface)]" />
          {isReady ? (
            <RotateCcwIcon className="relative z-[1] size-2.5 text-[var(--info-foreground)]" />
          ) : (
            <DownloadIcon className="relative z-[1] size-2.5 text-[var(--info-foreground)]" />
          )}
        </span>

        <span className="font-medium text-foreground tracking-[0.01em]">
          {isReady ? "Update ready" : "Update in progress"}
        </span>

        {isReady ? (
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
        ) : (
          <span className="rounded-full bg-[color:color-mix(in_srgb,var(--info)_10%,transparent)] px-2 py-0.5 font-medium text-[var(--info-foreground)] tabular-nums">
            {progressPercent}%
          </span>
        )}
      </section>
    </div>
  );
};
