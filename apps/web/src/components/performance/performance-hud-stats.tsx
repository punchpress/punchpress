import { GaugeIcon } from "lucide-react";
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
import { usePerformance } from "../../performance/use-performance";
import {
  PerformanceBenchmarkConfirmDialog,
  usePerformanceBenchmarkRunner,
} from "../../performance/use-performance-benchmark-runner";

const formatMs = (value: number) => `${value.toFixed(1)}ms`;

const getTimingColor = (ms: number) => {
  if (ms <= 8.3) {
    return "text-emerald-500";
  }

  if (ms <= 16.7) {
    return "text-amber-500";
  }

  return "text-red-500";
};

export const PerformanceHudStats = () => {
  const { controller, state } = usePerformance();
  const {
    cancelBenchmarkRun,
    confirmBenchmarkRun,
    isConfirmOpen,
    requestBenchmarkRun,
  } = usePerformanceBenchmarkRunner();
  const summary = state.liveSummary;
  const selectedBenchmarkId =
    state.selectedBenchmarkId || performanceBenchmarks[0]?.id || "";
  const selectedBenchmark =
    performanceBenchmarks.find(
      (benchmark) => benchmark.id === selectedBenchmarkId
    ) || performanceBenchmarks[0];

  return (
    <div className="flex items-stretch divide-x divide-border">
      {/* Stats group */}
      <div className="flex items-center gap-4 px-4 py-2.5">
        <StatCell label="FPS" value={`${Math.round(summary.fps)}`} />
        <StatCell
          label="P50"
          value={formatMs(summary.p50FrameMs)}
          valueClassName={getTimingColor(summary.p50FrameMs)}
        />
        <StatCell
          label="P95"
          value={formatMs(summary.p95FrameMs)}
          valueClassName={getTimingColor(summary.p95FrameMs)}
        />
        <StatCell label="Slow" value={`${summary.slowFrameCount}`} />
      </div>

      {/* Big timing readout */}
      <div className="flex items-center px-4 py-2.5">
        <span
          className={cn(
            "font-semibold text-xl tabular-nums tracking-tight",
            getTimingColor(summary.p95FrameMs)
          )}
        >
          {formatMs(summary.p95FrameMs)}
        </span>
        <span className="ml-1.5 text-[11px] text-muted-foreground">
          / 8ms
        </span>
      </div>

      {/* Document context */}
      <div className="flex items-center gap-4 px-4 py-2.5">
        <StatCell label="Nodes" value={`${state.nodeStats.totalNodeCount}`} />
        <StatCell
          label="Text"
          value={`${state.nodeStats.visibleTextNodeCount}`}
        />
        <StatCell
          label="Selected"
          value={`${state.nodeStats.selectedNodeCount}`}
        />
      </div>

      {/* Benchmark controls */}
      <div className="flex flex-1 items-center gap-2 px-4 py-2.5">
        <Select
          onValueChange={controller.setSelectedBenchmarkId}
          value={selectedBenchmarkId}
        >
          <SelectTrigger className="h-7 w-40 text-xs">
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
        <Button
          disabled={!selectedBenchmark || state.benchmarkStatus === "running"}
          onClick={() => {
            requestBenchmarkRun(selectedBenchmark);
          }}
          size="xs"
          variant="outline"
        >
          <GaugeIcon />
          {state.benchmarkStatus === "running" ? "Running\u2026" : "Run"}
        </Button>
        {state.benchmarkMessage ? (
          <span className="text-[11px] text-muted-foreground">
            {state.benchmarkMessage}
          </span>
        ) : null}
      </div>

      {/* Last result summary */}
      {state.lastResult ? (
        <div className="flex items-center gap-4 px-4 py-2.5">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
            Last run
          </div>
          <StatCell
            label="P95"
            value={formatMs(state.lastResult.summary.p95FrameMs)}
            valueClassName={getTimingColor(state.lastResult.summary.p95FrameMs)}
          />
          <StatCell
            label="FPS"
            value={`${Math.round(state.lastResult.summary.fps)}`}
          />
          <StatCell
            label="Slow"
            value={`${state.lastResult.summary.slowFrameCount}`}
          />
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

const StatCell = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) => {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-[12px] text-foreground/35 tracking-[-0.01em]">
        {label}
      </span>
      <span
        className={cn(
          "font-medium text-sm tabular-nums leading-tight",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
};
