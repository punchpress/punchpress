import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FrameData {
  buckets: Record<string, number>;
  durationMs: number;
  id: number;
  timestamp: number;
}

interface SecondBucket {
  avgMs: number;
  frameCount: number;
  id: number;
  maxMs: number;
  mergedBuckets: Record<string, number>;
  slowCount: number;
}

const BUCKET_COLORS = {
  "selection.bounds": "bg-neutral-400",
  "selection.drag.begin": "bg-neutral-500",
  "selection.drag.end": "bg-neutral-300",
  "selection.drag.update": "bg-neutral-400",
  "selection.move.absolute": "bg-neutral-500",
  "selection.move.by": "bg-neutral-300",
} as const;

const getBucketColor = (label: string) => {
  return BUCKET_COLORS[label] || "bg-neutral-400";
};

/** Group frames into 1-second buckets using the frame timestamp. */
const aggregateBySecond = (frames: FrameData[]): SecondBucket[] => {
  if (frames.length === 0) {
    return [];
  }

  const buckets: SecondBucket[] = [];
  let currentSecond = Math.floor(frames[0].timestamp / 1000);
  let currentFrames: FrameData[] = [];

  const flush = () => {
    if (currentFrames.length === 0) {
      return;
    }

    const durations = currentFrames.map((f) => f.durationMs);
    const total = durations.reduce((s, d) => s + d, 0);
    const mergedBuckets: Record<string, number> = {};

    for (const frame of currentFrames) {
      for (const [label, duration] of Object.entries(frame.buckets)) {
        mergedBuckets[label] = (mergedBuckets[label] || 0) + duration;
      }
    }

    buckets.push({
      avgMs: total / currentFrames.length,
      frameCount: currentFrames.length,
      id: currentSecond,
      maxMs: Math.max(...durations),
      mergedBuckets,
      slowCount: durations.filter((d) => d > 16.7).length,
    });
  };

  for (const frame of frames) {
    const frameSec = Math.floor(frame.timestamp / 1000);

    if (frameSec !== currentSecond) {
      flush();
      currentSecond = frameSec;
      currentFrames = [];
    }

    currentFrames.push(frame);
  }

  flush();

  return buckets;
};

const BAR_AREA_HEIGHT = 100;
const MAX_VISIBLE_SECONDS = 120;

const buildSlots = (realSeconds: SecondBucket[]) =>
  realSeconds.length >= MAX_VISIBLE_SECONDS
    ? realSeconds.map((second) => ({
        second,
        slotId: `second-${second.id}`,
      }))
    : [
        ...new Array(MAX_VISIBLE_SECONDS - realSeconds.length)
          .fill(null)
          .map((_, slotIndex) => ({
            second: null as SecondBucket | null,
            slotId: `empty-${slotIndex}`,
          })),
        ...realSeconds.map((second) => ({
          second: second as SecondBucket | null,
          slotId: `second-${second.id}`,
        })),
      ];

export const PerformanceFrameChart = ({
  benchmarkElapsedMs = 0,
  benchmarkRange = null,
  frames = [],
  isBenchmarkRunning = false,
}: {
  benchmarkElapsedMs?: number;
  benchmarkRange?: null | {
    endMs: number | null;
    label: string;
    startMs: number;
  };
  frames?: FrameData[];
  isBenchmarkRunning?: boolean;
}) => {
  const [isFrozen, setIsFrozen] = useState(false);

  // Compute live data
  const liveSeconds = aggregateBySecond(frames).slice(-MAX_VISIBLE_SECONDS);
  const liveSlots = buildSlots(liveSeconds);

  // Store the last-rendered data in a ref so we can freeze it stably
  const frozenRef = useRef<{
    benchmarkElapsedMs: number;
    benchmarkRange: typeof benchmarkRange;
    isBenchmarkRunning: boolean;
    slots: typeof liveSlots;
  } | null>(null);

  // When not frozen, keep the ref up to date with live data
  if (!isFrozen) {
    frozenRef.current = {
      benchmarkElapsedMs,
      benchmarkRange,
      isBenchmarkRunning,
      slots: liveSlots,
    };
  }

  const chartBenchmarkElapsedMs = isFrozen
    ? (frozenRef.current?.benchmarkElapsedMs ?? benchmarkElapsedMs)
    : benchmarkElapsedMs;
  const chartBenchmarkRange = isFrozen
    ? (frozenRef.current?.benchmarkRange ?? benchmarkRange)
    : benchmarkRange;
  const chartIsBenchmarkRunning = isFrozen
    ? (frozenRef.current?.isBenchmarkRunning ?? isBenchmarkRunning)
    : isBenchmarkRunning;
  const slots = isFrozen
    ? (frozenRef.current?.slots ?? liveSlots)
    : liveSlots;
  const realSeconds = isFrozen
    ? slots.filter((s) => s.second !== null).map((s) => s.second!)
    : liveSeconds;

  // Unfreeze when benchmark state changes
  useEffect(() => {
    if (isFrozen && frozenRef.current?.isBenchmarkRunning !== isBenchmarkRunning) {
      setIsFrozen(false);
    }
  }, [isFrozen, isBenchmarkRunning]);

  // Floor at 33ms so the 16.7ms threshold stays ~halfway up at idle.
  const maxMs = Math.max(33, ...realSeconds.map((s) => s.maxMs));
  const thresholdY16 = Math.round((16.7 / maxMs) * BAR_AREA_HEIGHT) + 6;

  // Y-axis labels: 0ms at bottom, 16.7ms threshold, and current max
  const padding = 6;
  const yAxisLabels = [
    { ms: 16.7, y: thresholdY16 },
    ...(maxMs > 20
      ? [{ ms: Math.round(maxMs), y: BAR_AREA_HEIGHT + padding - 8 }]
      : []),
  ];

  return (
    <div
      className="relative flex h-28 items-end gap-0.5 py-1.5 pr-3 pl-14"
      onPointerEnter={() => {
        setIsFrozen(true);
      }}
      onPointerLeave={() => {
        setIsFrozen(false);
      }}
    >
      <div
        className={cn(
          "contents",
          chartIsBenchmarkRunning && "[&>*]:opacity-18 [&>*]:saturate-50"
        )}
      >
        {/* Y-axis */}
        <div className="absolute top-1.5 bottom-1.5 left-2 w-9">
          {yAxisLabels.map(({ ms, y }) => (
            <span
              className="absolute right-1 font-mono text-[9px] text-muted-foreground tabular-nums leading-none"
              key={ms}
              style={{ bottom: y, transform: "translateY(50%)" }}
            >
              {ms === 16.7 ? "16.7" : ms}ms
            </span>
          ))}
        </div>

        {slots.map(({ second, slotId }) => {
          // Is this slot in the benchmark time range?
          const inRange =
            chartBenchmarkRange &&
            second &&
            (() => {
              const endMs =
                chartBenchmarkRange.endMs ??
                chartBenchmarkRange.startMs + chartBenchmarkElapsedMs;
              const secStart = second.id * 1000;
              const secEnd = secStart + 1000;
              return secStart < endMs && secEnd > chartBenchmarkRange.startMs;
            })();

          if (!second) {
            return (
              <div
                className="min-w-0 flex-1"
                key={slotId}
                style={{ height: BAR_AREA_HEIGHT }}
              />
            );
          }

          const barHeight = Math.max(
            2,
            Math.round((second.maxMs / maxMs) * BAR_AREA_HEIGHT)
          );
          const avgHeight = Math.max(
            1,
            Math.round((second.avgMs / maxMs) * BAR_AREA_HEIGHT)
          );
          const hasSlow = second.slowCount > 0;

          // Top bucket entries for coloring
          const bucketEntries = Object.entries(second.mergedBuckets).sort(
            (a, b) => b[1] - a[1]
          );
          const totalBucketMs = bucketEntries.reduce((s, [, d]) => s + d, 0);

          return (
            <Tooltip key={slotId}>
              <TooltipTrigger
                delay={0}
                render={<div />}
                className="group/bar relative flex min-w-0 flex-1 items-end"
                style={{ height: BAR_AREA_HEIGHT }}
              >
                {/* Hover highlight */}
                <div className="pointer-events-none absolute inset-x-[-1px] top-[-6px] bottom-[-6px] group-hover/bar:bg-foreground/[0.08] dark:group-hover/bar:bg-foreground/[0.06]" />

                {/* Benchmark range highlight — bleeds into gap to form seamless stripe */}
                {inRange ? (
                  <div
                    className="pointer-events-none absolute top-[-6px] bottom-[-6px] z-0 bg-foreground/[0.08] dark:bg-foreground/[0.06]"
                    style={{ left: "-1px", right: "-1px" }}
                  />
                ) : null}

                {/* Max bar (faint) */}
                <div
                  className={cn(
                    "absolute bottom-0 w-full rounded-t-[2px]",
                    hasSlow ? "bg-red-500/25 dark:bg-red-500/20" : "bg-foreground/12 dark:bg-foreground/6"
                  )}
                  style={{ height: barHeight }}
                />

                {/* Avg bar (solid) with bucket segments */}
                <div
                  className={cn(
                    "relative z-[1] flex w-full flex-col-reverse overflow-hidden rounded-t-[2px]",
                    hasSlow ? "bg-red-500/70 dark:bg-red-500/50" : "bg-neutral-400 dark:bg-neutral-500"
                  )}
                  style={{ height: avgHeight }}
                >
                  {bucketEntries.length > 0 && totalBucketMs > 0
                    ? bucketEntries.map(([label, duration]) => (
                        <div
                          className={cn(getBucketColor(label), "opacity-80")}
                          key={`${second.id}:${label}`}
                          style={{
                            flexBasis: `${Math.max(
                              6,
                              (duration / (second.avgMs * second.frameCount)) *
                                100
                            )}%`,
                          }}
                        />
                      ))
                    : null}
                </div>
              </TooltipTrigger>

              <TooltipPopup className="min-w-48" side="top" sideOffset={6}>
                {/* Benchmark label */}
                {inRange && chartBenchmarkRange?.label ? (
                  <div className="flex items-center gap-1.5 pb-1.5 text-sm font-medium">
                    {/* Play icon */}
                    <svg className="size-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                    {chartBenchmarkRange.label}
                  </div>
                ) : null}

                {/* Frame count */}
                <div className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", inRange && "border-border border-t pt-1.5")}>
                  {/* Layers icon */}
                  <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                    <path d="m2 12 8.58 3.91a2 2 0 0 0 1.66 0L22 12" className="opacity-60" />
                  </svg>
                  <span className="tabular-nums">{second.frameCount} frames</span>
                  {second.slowCount > 0 && (
                    <span className="text-red-400">&middot; {second.slowCount} slow</span>
                  )}
                </div>

                {/* Timing stats */}
                <div className="mt-1.5 flex items-center gap-3 border-border border-t pt-1.5">
                  <div className="flex items-center gap-1.5 text-sm">
                    {/* Clock icon */}
                    <svg className="size-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="font-semibold tabular-nums">
                      {second.avgMs.toFixed(1)}ms
                    </span>
                    <span className="text-muted-foreground">avg</span>
                  </div>
                  <div className="h-3 w-px bg-border" />
                  <div className={cn("flex items-center gap-1.5 text-sm", hasSlow && "text-red-400")}>
                    {hasSlow ? (
                      <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                        <line x1="12" x2="12" y1="9" y2="13" />
                        <line x1="12" x2="12.01" y1="17" y2="17" />
                      </svg>
                    ) : (
                      <svg className="size-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="m7 15 5-5 5 5" />
                      </svg>
                    )}
                    <span className="font-semibold tabular-nums">
                      {second.maxMs.toFixed(1)}ms
                    </span>
                    <span className={cn(!hasSlow && "text-muted-foreground")}>max</span>
                  </div>
                </div>

                {/* Bucket breakdown */}
                {bucketEntries.length > 0 && (
                  <div className="mt-1.5 space-y-1 border-border border-t pt-1.5">
                    {bucketEntries.slice(0, 3).map(([label, duration]) => (
                      <div
                        className="flex items-center justify-between gap-4 text-sm text-muted-foreground"
                        key={`${second.id}:${label}:tip`}
                      >
                        <span className="truncate">{label}</span>
                        <span className="font-medium tabular-nums text-popover-foreground">
                          {duration.toFixed(1)}ms
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TooltipPopup>
            </Tooltip>
          );
        })}

        {/* 16.7ms threshold */}
        <div
          className="pointer-events-none absolute right-3 left-14 flex items-center"
          style={{ bottom: `${thresholdY16}px` }}
        >
          <div className="flex-1 border-red-500/30 border-t border-dashed dark:border-red-500/20" />
        </div>
      </div>

      {/* Paused indicator when hovering freezes the chart */}
      {isFrozen && !chartIsBenchmarkRunning ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
            <svg className="size-3.5" fill="currentColor" viewBox="0 0 16 16">
              <rect height="10" rx="1" width="3" x="3" y="3" />
              <rect height="10" rx="1" width="3" x="10" y="3" />
            </svg>
            Paused
          </div>
        </div>
      ) : null}

      {chartIsBenchmarkRunning ? (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-card/84 backdrop-blur-[1.5px]" />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,var(--foreground)_0px_12px,transparent_12px_24px)] opacity-[0.03]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 rounded-full border border-border bg-card/96 px-4 py-2 text-sm shadow-sm">
              <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              <span className="font-medium">
                Running benchmark…{" "}
                {Math.max(1, Math.ceil(chartBenchmarkElapsedMs / 1000))}s
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
