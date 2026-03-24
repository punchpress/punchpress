import { PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { performanceBenchmarks } from "../../performance/performance-benchmarks";
import {
  PerformanceBenchmarkConfirmDialog,
  usePerformanceBenchmarkRunner,
} from "../../performance/use-performance-benchmark-runner";
import { usePerformanceController } from "../../performance/use-performance-controller";
import { usePerformanceValue } from "../../performance/use-performance-value";
import { PerformanceScenarioSelect } from "./performance-scenario-select";

export const PerformanceHudControls = () => {
  const controller = usePerformanceController();
  const benchmarkStatus = usePerformanceValue((state) => state.benchmarkStatus);
  const selectedBenchmarkId = usePerformanceValue((state) => {
    return state.selectedBenchmarkId || performanceBenchmarks[0]?.id || "";
  });
  const {
    cancelBenchmarkRun,
    confirmBenchmarkRun,
    isConfirmOpen,
    requestBenchmarkRun,
  } = usePerformanceBenchmarkRunner();
  const selectedBenchmark =
    performanceBenchmarks.find(
      (benchmark) => benchmark.id === selectedBenchmarkId
    ) || performanceBenchmarks[0];
  const benchmarkOptions = performanceBenchmarks.map((benchmark) => ({
    label: benchmark.label,
    value: benchmark.id,
  }));

  return (
    <div className="grid min-w-[18rem] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5">
      <PerformanceScenarioSelect
        className="h-7 min-w-0 text-xs"
        onValueChange={controller.setSelectedBenchmarkId}
        options={benchmarkOptions}
        size="sm"
        value={selectedBenchmarkId}
      />
      <Button
        className="h-7 shrink-0 whitespace-nowrap px-2.5 text-xs leading-none [&_svg]:mx-0"
        disabled={!selectedBenchmark || benchmarkStatus === "running"}
        onClick={() => {
          requestBenchmarkRun(selectedBenchmark);
        }}
        size="sm"
        variant="outline"
      >
        <PlayIcon className="size-3.5 shrink-0 fill-current stroke-none" />
        {benchmarkStatus === "running" ? "Running\u2026" : "Run"}
      </Button>

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
