import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePerformance } from "../../performance/use-performance";
import { usePerformanceLiveCapture } from "../../performance/use-performance-live-capture";
import { PerformanceFrameChart } from "./performance-frame-chart";
import { PerformanceHudStats } from "./performance-hud-stats";

export const PerformanceHud = () => {
  const { controller, state } = usePerformance();
  usePerformanceLiveCapture(state.hudOpen);

  if (!state.hudOpen) {
    return null;
  }

  return (
    <div className="absolute right-0 bottom-0 left-0 z-30">
      <div
        className={cn(
          "border-black/7 dark:border-white/7 border-t bg-card",
          "flex flex-col"
        )}
      >
        {/* Frame timeline strip */}
        <div className="border-black/7 dark:border-white/7 border-b">
          <PerformanceFrameChart
            benchmarkElapsedMs={state.benchmarkElapsedMs}
            benchmarkRange={state.benchmarkRange}
            frames={state.frames}
            isBenchmarkRunning={state.benchmarkStatus === "running"}
          />
        </div>

        {/* Stats + controls */}
        <PerformanceHudStats />

        {/* Close button */}
        <button
          aria-label="Close performance panel"
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => controller.setHudOpen(false)}
          type="button"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
};
