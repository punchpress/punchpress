import { idleSoakBenchmark } from "./benchmarks/idle-soak-benchmark";
import {
  textDragBenchmark,
  textDragBenchmarkLarge,
} from "./benchmarks/text-drag-benchmark";

export const performanceBenchmarks = [
  idleSoakBenchmark,
  textDragBenchmark,
  textDragBenchmarkLarge,
];

export const findPerformanceBenchmark = (benchmarkId: string) => {
  return performanceBenchmarks.find(
    (benchmark) => benchmark.id === benchmarkId
  );
};
