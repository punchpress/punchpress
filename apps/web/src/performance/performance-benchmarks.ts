import { compoundVectorDragBenchmark } from "./benchmarks/compound-vector-drag-benchmark";
import { idleSoakBenchmark } from "./benchmarks/idle-soak-benchmark";
import { shapeDragBenchmarkLarge } from "./benchmarks/square-drag-benchmark";
import {
  textDragBenchmark,
  textDragBenchmarkLarge,
} from "./benchmarks/text-drag-benchmark";

export const performanceBenchmarks = [
  compoundVectorDragBenchmark,
  idleSoakBenchmark,
  shapeDragBenchmarkLarge,
  textDragBenchmark,
  textDragBenchmarkLarge,
];

export const findPerformanceBenchmark = (benchmarkId: string) => {
  return performanceBenchmarks.find(
    (benchmark) => benchmark.id === benchmarkId
  );
};
