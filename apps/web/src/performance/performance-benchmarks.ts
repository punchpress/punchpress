import { compoundVectorDragBenchmark } from "./benchmarks/compound-vector-drag-benchmark";
import { idleSoakBenchmark } from "./benchmarks/idle-soak-benchmark";
import {
  largeSvgDeselectBenchmark,
  largeSvgHoverBenchmark,
  largeSvgPointerDeselectBenchmark,
  largeSvgPointerDragBenchmark,
  largeSvgResizeBenchmark,
  largeSvgRotateBenchmark,
  largeSvgSelectBenchmark,
  largeSvgSelectionColorBenchmark,
  largeSvgTextDeselectBenchmark,
  largeSvgViewportBenchmark,
} from "./benchmarks/large-svg-benchmark";
import { shapeDragBenchmarkLarge } from "./benchmarks/square-drag-benchmark";
import {
  textDragBenchmark,
  textDragBenchmarkLarge,
} from "./benchmarks/text-drag-benchmark";
import {
  largeSvgPathPointDragBenchmark,
  simpleVectorPathPointDragBenchmark,
} from "./benchmarks/vector-path-point-benchmark";

export const performanceBenchmarks = [
  largeSvgPointerDragBenchmark,
  largeSvgViewportBenchmark,
  largeSvgResizeBenchmark,
  largeSvgRotateBenchmark,
  largeSvgSelectBenchmark,
  largeSvgSelectionColorBenchmark,
  largeSvgHoverBenchmark,
  largeSvgDeselectBenchmark,
  largeSvgPointerDeselectBenchmark,
  largeSvgTextDeselectBenchmark,
  largeSvgPathPointDragBenchmark,
  simpleVectorPathPointDragBenchmark,
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
