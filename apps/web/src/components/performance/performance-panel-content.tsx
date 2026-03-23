import { GaugeIcon, MonitorUpIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { performanceBenchmarks } from "../../performance/performance-benchmarks";
import type { PerformanceSummary } from "../../performance/performance-controller";
import { usePerformance } from "../../performance/use-performance";
import { usePerformanceLiveCapture } from "../../performance/use-performance-live-capture";
import {
  PerformanceBenchmarkConfirmDialog,
  usePerformanceBenchmarkRunner,
} from "../../performance/use-performance-benchmark-runner";

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
  const lastResult = state.lastResult;

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
            Benchmark
          </div>
          <div className="space-y-3">
            <Select
              onValueChange={controller.setSelectedBenchmarkId}
              value={selectedBenchmarkId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {performanceBenchmarks.map((benchmark) => (
                  <SelectItem key={benchmark.id} value={benchmark.id}>
                    {benchmark.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="text-muted-foreground text-sm leading-6">
              {selectedBenchmark?.description}
            </p>

            <div className="rounded-lg border border-amber-500/20 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-500/8 dark:text-amber-200">
              Benchmarks run in a scratch scene inside the live editor.
            </div>

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
                  : "Run benchmark"}
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
