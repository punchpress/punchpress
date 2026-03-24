import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePerformanceController } from "../../performance/use-performance-controller";
import { usePerformanceLiveCapture } from "../../performance/use-performance-live-capture";
import { usePerformanceValue } from "../../performance/use-performance-value";
import { PerformanceHudControls } from "./performance-hud-controls";
import { PerformanceHudLiveStrip } from "./performance-hud-live-strip";

export const PerformanceHud = () => {
  const controller = usePerformanceController();
  const hudOpen = usePerformanceValue((state) => state.hudOpen);
  usePerformanceLiveCapture(hudOpen);

  if (!hudOpen) {
    return null;
  }

  return (
    <div className="absolute right-0 bottom-0 left-0 z-30">
      <div
        className={cn(
          "border-black/7 border-t bg-card dark:border-white/7",
          "flex flex-col"
        )}
      >
        <PerformanceHudLiveStrip>
          <PerformanceHudControls />
        </PerformanceHudLiveStrip>

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
