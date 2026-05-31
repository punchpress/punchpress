import { XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  PerformanceBenchmarkResult,
  PerformanceFrameSample,
  PerformanceSecondBucket,
} from "../../performance/performance-controller";
import { usePerformanceController } from "../../performance/use-performance-controller";
import { usePerformanceLiveCapture } from "../../performance/use-performance-live-capture";
import { usePerformanceValue } from "../../performance/use-performance-value";
import { PerformanceFlameChart } from "./performance-flame-chart";
import { PerformanceHudControls } from "./performance-hud-controls";
import { PerformanceHudLiveStrip } from "./performance-hud-live-strip";
import {
  getInitialPerformanceFrame,
  PerformanceResultFrameStrip,
} from "./performance-result-frame-strip";

const getLatestResultBucketSpans = (
  result: PerformanceBenchmarkResult | null
) => {
  if (!result) {
    return [];
  }

  const framesWithSpans = result.frames.filter((frame) => frame.spans?.length);
  const latestFrame = framesWithSpans.at(-1);

  if (!latestFrame) {
    return result.flameSpans;
  }

  const latestSecondId = Math.floor(latestFrame.timestamp / 1000);

  return framesWithSpans
    .filter((frame) => Math.floor(frame.timestamp / 1000) === latestSecondId)
    .flatMap((frame) => frame.spans || []);
};

const getFlameSpans = ({
  defaultSpans,
  hoveredBucket,
  isRunning,
  selectedResultFrame,
}: {
  defaultSpans: PerformanceBenchmarkResult["flameSpans"];
  hoveredBucket: PerformanceSecondBucket | null;
  isRunning: boolean;
  selectedResultFrame: PerformanceFrameSample | null;
}) => {
  if (isRunning && hoveredBucket?.spans?.length) {
    return hoveredBucket.spans;
  }

  if (!isRunning && selectedResultFrame?.spans?.length) {
    return selectedResultFrame.spans;
  }

  return defaultSpans;
};

export const PerformanceHud = () => {
  const controller = usePerformanceController();
  const hudOpen = usePerformanceValue((state) => state.hudOpen);
  const benchmarkStatus = usePerformanceValue((state) => state.benchmarkStatus);
  const lastResult = usePerformanceValue((state) => state.lastResult);
  const [hoveredBucket, setHoveredBucket] =
    useState<PerformanceSecondBucket | null>(null);
  const [hoveredFrame, setHoveredFrame] =
    useState<PerformanceFrameSample | null>(null);
  const [selectedFrame, setSelectedFrame] =
    useState<PerformanceFrameSample | null>(null);
  const hoveredFrameIdRef = useRef<number | null>(null);
  const hoverFrameRafRef = useRef<number | null>(null);
  const pendingHoveredFrameRef = useRef<PerformanceFrameSample | null>(null);
  const defaultSpans = useMemo(
    () => getLatestResultBucketSpans(lastResult),
    [lastResult]
  );
  const controls = useMemo(() => <PerformanceHudControls />, []);
  const isRunning = benchmarkStatus === "running";
  const showLiveStrip = isRunning || !lastResult;
  const selectedResultFrame = hoveredFrame || selectedFrame;
  const flameSpans = getFlameSpans({
    defaultSpans,
    hoveredBucket,
    isRunning: showLiveStrip,
    selectedResultFrame,
  });
  const flameFrameDurationMs =
    !showLiveStrip && selectedResultFrame?.spans?.length
      ? selectedResultFrame.durationMs
      : null;
  usePerformanceLiveCapture(hudOpen && showLiveStrip);

  useEffect(() => {
    hoveredFrameIdRef.current = null;
    pendingHoveredFrameRef.current = null;
    setHoveredFrame(null);
    setSelectedFrame(getInitialPerformanceFrame(lastResult));
  }, [lastResult]);

  const setHoveredFramePreview = useCallback(
    (frame: PerformanceFrameSample | null) => {
      const nextFrameId = frame?.id ?? null;

      if (hoveredFrameIdRef.current === nextFrameId) {
        return;
      }

      hoveredFrameIdRef.current = nextFrameId;
      pendingHoveredFrameRef.current = frame;

      if (hoverFrameRafRef.current !== null) {
        return;
      }

      hoverFrameRafRef.current = window.requestAnimationFrame(() => {
        hoverFrameRafRef.current = null;
        setHoveredFrame(pendingHoveredFrameRef.current);
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      if (hoverFrameRafRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRafRef.current);
      }
    };
  }, []);

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
        {showLiveStrip ? (
          <PerformanceHudLiveStrip onHoverBucketChange={setHoveredBucket}>
            {controls}
          </PerformanceHudLiveStrip>
        ) : (
          <PerformanceResultFrameStrip
            onFrameHover={setHoveredFramePreview}
            onFrameSelect={setSelectedFrame}
            result={lastResult}
            scrollFrameId={selectedFrame?.id ?? null}
            selectedFrameId={selectedFrame?.id ?? null}
          >
            {controls}
          </PerformanceResultFrameStrip>
        )}

        <PerformanceFlameChart
          className="rounded-none border-black/7 border-x-0 border-b-0 dark:border-white/7"
          frameDurationMs={flameFrameDurationMs}
          height={280}
          spans={flameSpans}
        />

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
