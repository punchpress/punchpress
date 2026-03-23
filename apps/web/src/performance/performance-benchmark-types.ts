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
}
