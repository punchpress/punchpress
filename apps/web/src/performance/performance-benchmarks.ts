import { compoundVectorDragBenchmark } from "./benchmarks/compound-vector-drag-benchmark";
import { idleSoakBenchmark } from "./benchmarks/idle-soak-benchmark";
import {
  largeSvgCorgiDeselectBenchmark,
  largeSvgCorgiHoverBenchmark,
  largeSvgCorgiPointerDeselectBenchmark,
  largeSvgCorgiPointerDragBenchmark,
  largeSvgCorgiResizeBenchmark,
  largeSvgCorgiRotateBenchmark,
  largeSvgCorgiSelectBenchmark,
  largeSvgCorgiSelectionColorBenchmark,
  largeSvgCorgiTextDeselectBenchmark,
  largeSvgCorgiViewportBenchmark,
} from "./benchmarks/large-svg-corgi-benchmark";
import { shapeDragBenchmarkLarge } from "./benchmarks/square-drag-benchmark";
import {
  textDragBenchmark,
  textDragBenchmarkLarge,
} from "./benchmarks/text-drag-benchmark";

export const performanceBenchmarks = [
  largeSvgCorgiPointerDragBenchmark,
  largeSvgCorgiViewportBenchmark,
  largeSvgCorgiResizeBenchmark,
  largeSvgCorgiRotateBenchmark,
  largeSvgCorgiSelectBenchmark,
  largeSvgCorgiSelectionColorBenchmark,
  largeSvgCorgiHoverBenchmark,
  largeSvgCorgiDeselectBenchmark,
  largeSvgCorgiPointerDeselectBenchmark,
  largeSvgCorgiTextDeselectBenchmark,
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
