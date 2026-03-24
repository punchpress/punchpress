import type {
  PerformanceFrameSample,
  PerformanceSummary,
} from "./performance-controller";

const HISTOGRAM_BIN_SIZE_MS = 0.5;
const HISTOGRAM_MAX_DURATION_MS = 200;
const HISTOGRAM_BIN_COUNT =
  Math.floor(HISTOGRAM_MAX_DURATION_MS / HISTOGRAM_BIN_SIZE_MS) + 1;
const SLOW_FRAME_THRESHOLD_MS = 16.7;

const toHistogramIndex = (durationMs: number) => {
  const boundedDuration = Math.max(
    0,
    Math.min(HISTOGRAM_MAX_DURATION_MS, durationMs)
  );

  return Math.min(
    HISTOGRAM_BIN_COUNT - 1,
    Math.floor(boundedDuration / HISTOGRAM_BIN_SIZE_MS)
  );
};

const toHistogramDuration = (index: number) => {
  return index * HISTOGRAM_BIN_SIZE_MS;
};

const createEmptySummary = (): PerformanceSummary => {
  return {
    averageFrameMs: 0,
    fps: 0,
    maxFrameMs: 0,
    p50FrameMs: 0,
    p95FrameMs: 0,
    slowFrameCount: 0,
  };
};

export class LiveFrameSummary {
  private readonly histogram = new Uint32Array(HISTOGRAM_BIN_COUNT);
  private frameCount = 0;
  private maxFrameMs = 0;
  private maxFrameDirty = false;
  private slowFrameCount = 0;
  private totalFrameMs = 0;

  append = ({
    frame,
    evictedFrame,
  }: {
    frame: PerformanceFrameSample;
    evictedFrame?: PerformanceFrameSample;
  }) => {
    this.frameCount += 1;
    this.totalFrameMs += frame.durationMs;
    this.maxFrameMs = Math.max(this.maxFrameMs, frame.durationMs);
    this.histogram[toHistogramIndex(frame.durationMs)] += 1;

    if (frame.durationMs > SLOW_FRAME_THRESHOLD_MS) {
      this.slowFrameCount += 1;
    }

    if (!evictedFrame) {
      return;
    }

    this.frameCount = Math.max(0, this.frameCount - 1);
    this.totalFrameMs = Math.max(
      0,
      this.totalFrameMs - evictedFrame.durationMs
    );
    this.histogram[toHistogramIndex(evictedFrame.durationMs)] = Math.max(
      0,
      this.histogram[toHistogramIndex(evictedFrame.durationMs)] - 1
    );

    if (evictedFrame.durationMs > SLOW_FRAME_THRESHOLD_MS) {
      this.slowFrameCount = Math.max(0, this.slowFrameCount - 1);
    }

    if (evictedFrame.durationMs >= this.maxFrameMs) {
      this.maxFrameDirty = true;
    }
  };

  clear = () => {
    this.frameCount = 0;
    this.maxFrameMs = 0;
    this.maxFrameDirty = false;
    this.slowFrameCount = 0;
    this.totalFrameMs = 0;
    this.histogram.fill(0);
  };

  getSummary = (framesSnapshot?: PerformanceFrameSample[]) => {
    if (this.frameCount === 0) {
      return createEmptySummary();
    }

    if (this.maxFrameDirty) {
      this.recalculateMaxFrameMs(framesSnapshot);
    }

    const averageFrameMs = this.totalFrameMs / this.frameCount;

    return {
      averageFrameMs,
      fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
      maxFrameMs: this.maxFrameMs,
      p50FrameMs: this.getPercentile(0.5),
      p95FrameMs: this.getPercentile(0.95),
      slowFrameCount: this.slowFrameCount,
    };
  };

  private readonly getPercentile = (percentile: number) => {
    const targetCount = Math.max(
      0,
      Math.ceil(this.frameCount * percentile) - 1
    );
    let runningCount = 0;

    for (let index = 0; index < this.histogram.length; index += 1) {
      runningCount += this.histogram[index] || 0;

      if (runningCount > targetCount) {
        return toHistogramDuration(index);
      }
    }

    return this.maxFrameMs;
  };

  private readonly recalculateMaxFrameMs = (
    framesSnapshot?: PerformanceFrameSample[]
  ) => {
    if (!framesSnapshot) {
      return;
    }

    this.maxFrameMs = framesSnapshot.reduce((maxFrameMs, frame) => {
      return Math.max(maxFrameMs, frame.durationMs);
    }, 0);
    this.maxFrameDirty = false;
  };
}
