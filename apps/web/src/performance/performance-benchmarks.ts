import { idleSoakBenchmark } from "./benchmarks/idle-soak-benchmark";
import { squareDragBenchmarkLarge } from "./benchmarks/square-drag-benchmark";
import {
  textDragBenchmark,
  textDragBenchmarkLarge,
} from "./benchmarks/text-drag-benchmark";

export const performanceBenchmarks = [
  idleSoakBenchmark,
  squareDragBenchmarkLarge,
  textDragBenchmark,
  textDragBenchmarkLarge,
];

export const findPerformanceBenchmark = (benchmarkId: string) => {
  return performanceBenchmarks.find(
    (benchmark) => benchmark.id === benchmarkId
  );
};
