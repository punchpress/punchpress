import { GaugeIcon, MonitorUpIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { performanceBenchmarks } from "../../performance/performance-benchmarks";
import type { PerformanceSummary } from "../../performance/performance-controller";
import { getRuntimeTaskSummary } from "../../performance/runtime-task-recorder";
import {
  getSlowFrameCauseLabel,
  getSlowFrameSummary,
  getTaskHotspotSummary,
  getTimelineEntrySummary,
} from "../../performance/slow-frame-diagnostics";
import { usePerformance } from "../../performance/use-performance";
import {
  PerformanceBenchmarkConfirmDialog,
  usePerformanceBenchmarkRunner,
} from "../../performance/use-performance-benchmark-runner";
import { usePerformanceLiveCapture } from "../../performance/use-performance-live-capture";
import { PerformanceScenarioSelect } from "./performance-scenario-select";

const formatFrameMs = (value: number) => `${value.toFixed(1)}ms`;
const formatFps = (value: number) =>
  Number.isFinite(value) && value > 0 ? `${Math.round(value)}` : "0";

const getTimingColor = (ms: number) => {
  if (ms <= 8.3) {
    return "text-emerald-500";
  }

  if (ms <= 16.7) {
    return "text-amber-500";
  }

  return "text-red-500";
};

const SUMMARY_ITEMS: Array<{
  id: string;
  label: string;
  render: (summary: PerformanceSummary) => string;
  colorFn?: (summary: PerformanceSummary) => string;
}> = [
  {
    id: "fps",
    label: "FPS",
    render: (summary) => formatFps(summary.fps),
  },
  {
    id: "p50",
    label: "P50",
    render: (summary) => formatFrameMs(summary.p50FrameMs),
    colorFn: (summary) => getTimingColor(summary.p50FrameMs),
  },
  {
    id: "p95",
    label: "P95",
    render: (summary) => formatFrameMs(summary.p95FrameMs),
    colorFn: (summary) => getTimingColor(summary.p95FrameMs),
  },
  {
    id: "slow",
    label: "Slow frames",
    render: (summary) => `${summary.slowFrameCount}`,
  },
];

/**
 * Performance panel content used inside the settings dialog.
 * The bottom-docked HUD uses PerformanceHud + PerformanceHudStats instead.
 */
export const PerformancePanelContent = () => {
  const { controller, state } = usePerformance();
  usePerformanceLiveCapture();
  const {
    cancelBenchmarkRun,
    confirmBenchmarkRun,
    isConfirmOpen,
    requestBenchmarkRun,
  } = usePerformanceBenchmarkRunner();
  const selectedBenchmarkId =
    state.selectedBenchmarkId || performanceBenchmarks[0]?.id || "";
  const selectedBenchmark =
    performanceBenchmarks.find(
      (benchmark) => benchmark.id === selectedBenchmarkId
    ) || performanceBenchmarks[0];
  const benchmarkOptions = performanceBenchmarks.map((benchmark) => ({
    label: benchmark.label,
    value: benchmark.id,
  }));
  const lastResult = state.lastResult;
  const recentSlowFrames = [...state.recentSlowFrames].reverse().slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">Performance</h2>
          <p className="max-w-2xl text-muted-foreground text-sm leading-6">
            Live frame timing and manual benchmarks for editor performance.
            Toggle the bottom panel with{" "}
            <kbd className="rounded-[5px] border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⇧⌘P
            </kbd>
            .
          </p>
        </div>
        <Button
          onClick={() => controller.toggleHud()}
          size="sm"
          variant={state.hudOpen ? "secondary" : "outline"}
        >
          <MonitorUpIcon />
          {state.hudOpen ? "Hide panel" : "Show panel"}
        </Button>
      </div>

      {/* Live stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        {SUMMARY_ITEMS.map((item) => (
          <div
            className="rounded-xl border bg-muted/40 px-3 py-2.5"
            key={item.id}
          >
            <div className="text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              {item.label}
            </div>
            <div
              className={cn(
                "mt-1 font-semibold text-lg tabular-nums",
                item.colorFn?.(state.liveSummary)
              )}
            >
              {item.render(state.liveSummary)}
            </div>
          </div>
        ))}
      </div>

      {/* Benchmark + Document context */}
      <div className="grid gap-3 md:grid-cols-[1.35fr_1fr]">
        <div className="rounded-xl border bg-muted/16 p-4">
          <div className="mb-3 flex items-center gap-2 font-medium text-sm">
            <PlayIcon className="size-4" />
            Scenario
          </div>
          <div className="space-y-3">
            <PerformanceScenarioSelect
              onValueChange={controller.setSelectedBenchmarkId}
              options={benchmarkOptions}
              value={selectedBenchmarkId}
            />

            <p className="text-muted-foreground text-sm leading-6">
              {selectedBenchmark?.description}
            </p>

            {selectedBenchmark?.usesScratchDocument === false ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 dark:bg-emerald-500/8 dark:text-emerald-200">
                This scenario runs against the current live editor state.
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/20 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-500/8 dark:text-amber-200">
                This scenario runs in a scratch scene inside the live editor.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={
                  !selectedBenchmark || state.benchmarkStatus === "running"
                }
                onClick={() => {
                  requestBenchmarkRun(selectedBenchmark);
                }}
                size="sm"
              >
                <GaugeIcon />
                {state.benchmarkStatus === "running"
                  ? "Running\u2026"
                  : "Run scenario"}
              </Button>
              <span className="text-muted-foreground text-xs">
                {state.benchmarkMessage || "Ready"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/16 p-4">
          <div className="mb-3 font-medium text-sm">Document context</div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Total nodes</dt>
            <dd className="text-right font-medium tabular-nums">
              {state.nodeStats.totalNodeCount}
            </dd>
            <dt className="text-muted-foreground">Visible text</dt>
            <dd className="text-right font-medium tabular-nums">
              {state.nodeStats.visibleTextNodeCount}
            </dd>
            <dt className="text-muted-foreground">Selected</dt>
            <dd className="text-right font-medium tabular-nums">
              {state.nodeStats.selectedNodeCount}
            </dd>
          </dl>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/16 p-4">
        <div className="mb-3 font-medium text-sm">Recurring renderer tasks</div>
        {state.recentTaskHotspots.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No recurring task activity captured yet.
          </p>
        ) : (
          <div className="space-y-2">
            {state.recentTaskHotspots.slice(0, 5).map((hotspot) => (
              <div
                className="rounded-lg bg-muted/50 px-3 py-2.5"
                key={`${hotspot.scheduler}-${hotspot.label}-${hotspot.source || "unknown"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{hotspot.label}</div>
                  <div className="font-medium text-sm tabular-nums">
                    {hotspot.totalDurationMs.toFixed(1)}ms
                  </div>
                </div>
                <div className="mt-1 text-muted-foreground text-xs leading-5">
                  {getTaskHotspotSummary(hotspot)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-muted/16 p-4">
        <div className="mb-3 font-medium text-sm">Recent slow frames</div>
        {recentSlowFrames.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No slow-frame diagnostics captured yet.
          </p>
        ) : (
          <div className="space-y-2">
            {recentSlowFrames.map((diagnostic) => (
              <div
                className="rounded-lg bg-muted/50 px-3 py-2.5"
                key={`${diagnostic.frameId}-${diagnostic.timestamp}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">
                    {getSlowFrameCauseLabel(diagnostic.cause)}
                  </div>
                  <div className="font-medium text-sm tabular-nums">
                    {diagnostic.durationMs.toFixed(1)}ms
                  </div>
                </div>
                <div className="mt-1 text-muted-foreground text-xs leading-5">
                  {getSlowFrameSummary(diagnostic)}
                </div>
                {diagnostic.timelineEntries.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {diagnostic.timelineEntries
                      .slice(0, 3)
                      .map((entry, index) => (
                        <div
                          className="rounded bg-background/50 px-2 py-1 text-[11px] text-muted-foreground"
                          key={`${diagnostic.frameId}-${entry.startTime}-${index}`}
                        >
                          {getTimelineEntrySummary(entry)}
                        </div>
                      ))}
                  </div>
                ) : null}
                {diagnostic.overlappingTasks.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {diagnostic.overlappingTasks.map((task, index) => (
                      <div
                        className="rounded bg-background/50 px-2 py-1 text-[11px] text-muted-foreground"
                        key={`${diagnostic.frameId}-${task.id}-${task.startedAt}-${index}`}
                      >
                        Active during frame: {getRuntimeTaskSummary(task)}
                      </div>
                    ))}
                  </div>
                ) : null}
                {diagnostic.recentTaskHotspots.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {diagnostic.recentTaskHotspots.map((hotspot, index) => (
                      <div
                        className="rounded bg-background/50 px-2 py-1 text-[11px] text-muted-foreground"
                        key={`${diagnostic.frameId}-${hotspot.scheduler}-${hotspot.label}-${index}`}
                      >
                        Recent offender: {getTaskHotspotSummary(hotspot)}
                      </div>
                    ))}
                  </div>
                ) : null}
                {diagnostic.recentTasks.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {diagnostic.recentTasks.slice(-3).map((task, index) => (
                      <div
                        className="rounded bg-background/50 px-2 py-1 text-[11px] text-muted-foreground"
                        key={`${diagnostic.frameId}-${task.id}-${task.startedAt}-recent-${index}`}
                      >
                        Recent task: {getRuntimeTaskSummary(task)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last result */}
      {lastResult ? (
        <div className="rounded-xl border bg-muted/16 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium text-sm">{lastResult.label}</div>
              <div className="text-muted-foreground text-xs">
                {lastResult.startedAt} &middot;{" "}
                {lastResult.durationMs.toFixed(0)}ms total
              </div>
            </div>
            <div
              className={cn(
                "rounded-full px-2.5 py-1 font-medium text-[11px] uppercase tracking-[0.14em]",
                lastResult.error
                  ? "bg-red-500/12 text-red-500"
                  : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {lastResult.error ? "Error" : "Complete"}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {SUMMARY_ITEMS.map((item) => (
              <div className="rounded-lg bg-muted/50 px-3 py-2" key={item.id}>
                <div className="text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                  {item.label}
                </div>
                <div
                  className={cn(
                    "mt-0.5 font-semibold text-sm tabular-nums",
                    item.colorFn?.(lastResult.summary)
                  )}
                >
                  {item.render(lastResult.summary)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1.25fr_1fr]">
            <div>
              <div className="mb-2 font-medium text-sm">Top spans</div>
              <div className="space-y-1.5">
                {lastResult.spans.slice(0, 6).map((span) => {
                  const maxSpanMs = lastResult.spans[0]?.totalMs || 1;
                  const barWidth = Math.max(
                    4,
                    (span.totalMs / maxSpanMs) * 100
                  );

                  return (
                    <div
                      className="rounded-lg bg-muted/50 px-3 py-2"
                      key={span.label}
                    >
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="truncate pr-4 text-muted-foreground">
                          {span.label}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {span.totalMs.toFixed(1)}ms
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/20"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 font-medium text-sm">Counters</div>
              <div className="space-y-1.5">
                {Object.entries(lastResult.counters)
                  .sort((left, right) => right[1] - left[1])
                  .slice(0, 6)
                  .map(([label, value]) => (
                    <div
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-[13px]"
                      key={label}
                    >
                      <span className="truncate pr-4 text-muted-foreground">
                        {label}
                      </span>
                      <span className="font-medium tabular-nums">{value}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <PerformanceBenchmarkConfirmDialog
        benchmarkLabel={selectedBenchmark?.label}
        onConfirm={confirmBenchmarkRun}
        onOpenChange={(open) => {
          if (!open) {
            cancelBenchmarkRun();
          }
        }}
        open={isConfirmOpen}
      />
    </div>
  );
};
