import type { Editor } from "@punchpress/engine";

export interface PerformanceBenchmarkOptions {
  frames?: number;
  nodeCount?: number;
  stepX?: number;
  stepY?: number;
  warmupFrames?: number;
}

export interface ResolvedPerformanceBenchmarkOptions {
  frames: number;
  nodeCount: number;
  stepX: number;
  stepY: number;
  warmupFrames: number;
}

export interface PerformanceBenchmarkContext {
  editor: Editor;
  options: ResolvedPerformanceBenchmarkOptions;
  // Records one benchmark-level sample (for example action-to-settled-frame
  // latency); the result summarizes count, p50, p95, and max per label.
  recordMetric: (label: string, value: number) => void;
  waitForFrame: () => Promise<number>;
  waitForFrames: (count?: number) => Promise<void>;
}

export interface PerformanceBenchmarkDefinition {
  defaultOptions: ResolvedPerformanceBenchmarkOptions;
  description: string;
  id: string;
  label: string;
  run: (context: PerformanceBenchmarkContext) => Promise<void>;
  setup?: (context: PerformanceBenchmarkContext) => Promise<void>;
  usesScratchDocument?: boolean;
}
