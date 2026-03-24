import type {
  PerformanceHudSnapshot,
  PerformanceSecondBucket,
} from "../../performance/performance-controller";

const MAX_VISIBLE_SECONDS = 120;
const MIN_BAR_HEIGHT = 2;
const MIN_AVG_HEIGHT = 1;
const MIN_CHART_MAX_MS = 75;
const SLOW_FRAME_THRESHOLD_MS = 16.7;

const BUCKET_COLORS: Record<string, string> = {
  "selection.bounds": "#a3a3a3",
  "selection.drag.begin": "#737373",
  "selection.drag.end": "#d4d4d4",
  "selection.drag.update": "#a3a3a3",
  "selection.move.absolute": "#737373",
  "selection.move.by": "#d4d4d4",
};

export interface HudChartSlot {
  inBenchmarkRange: boolean;
  second: PerformanceSecondBucket;
  width: number;
  x: number;
}

interface ChartLayout {
  chartMaxMs: number;
  slots: HudChartSlot[];
  thresholdLineY: number;
}

const getBucketColor = (label: string) => {
  return BUCKET_COLORS[label] || "#a3a3a3";
};

const isSecondInBenchmarkRange = (
  second: PerformanceSecondBucket,
  snapshot: PerformanceHudSnapshot
) => {
  if (!snapshot.benchmarkRange) {
    return false;
  }

  const endMs =
    snapshot.benchmarkRange.endMs ??
    snapshot.benchmarkRange.startMs + snapshot.benchmarkElapsedMs;
  const secondStartMs = second.id * 1000;
  const secondEndMs = secondStartMs + 1000;

  return secondStartMs < endMs && secondEndMs > snapshot.benchmarkRange.startMs;
};

const getVisibleSeconds = (seconds: PerformanceSecondBucket[]) => {
  return seconds.slice(-MAX_VISIBLE_SECONDS);
};

const getChartMaxMs = (seconds: PerformanceSecondBucket[]) => {
  return Math.max(
    MIN_CHART_MAX_MS,
    SLOW_FRAME_THRESHOLD_MS,
    ...seconds.map((second) => second.maxMs)
  );
};

const scaleHeight = (value: number, maxValue: number, chartHeight: number) => {
  if (!(maxValue > 0)) {
    return 0;
  }

  return (value / maxValue) * chartHeight;
};

export const getHudChartSlots = ({
  snapshot,
  width,
}: {
  snapshot: PerformanceHudSnapshot;
  width: number;
}) => {
  const visibleSeconds = getVisibleSeconds(snapshot.liveSeconds);

  if (!(width > 0) || visibleSeconds.length === 0) {
    return [] as HudChartSlot[];
  }

  const slotWidth = width / MAX_VISIBLE_SECONDS;

  return visibleSeconds.map((second, visibleIndex) => {
    const slotIndex =
      MAX_VISIBLE_SECONDS - visibleSeconds.length + visibleIndex;
    const slotStart = Math.round(slotIndex * slotWidth);
    const slotEnd = Math.round((slotIndex + 1) * slotWidth);

    return {
      inBenchmarkRange: isSecondInBenchmarkRange(second, snapshot),
      second,
      width: Math.max(1, slotEnd - slotStart - 1),
      x: slotStart,
    };
  });
};

export const drawPerformanceHudChart = ({
  canvas,
  height,
  snapshot,
  width,
}: {
  canvas: HTMLCanvasElement;
  height: number;
  snapshot: PerformanceHudSnapshot;
  width: number;
}): ChartLayout => {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const visibleSeconds = getVisibleSeconds(snapshot.liveSeconds);
  const slots = getHudChartSlots({
    snapshot,
    width,
  });
  const chartMaxMs = getChartMaxMs(visibleSeconds);
  const thresholdLineY =
    height - scaleHeight(SLOW_FRAME_THRESHOLD_MS, chartMaxMs, height);

  canvas.width = Math.max(1, Math.round(width * devicePixelRatio));
  canvas.height = Math.max(1, Math.round(height * devicePixelRatio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");

  if (!context) {
    return {
      chartMaxMs,
      slots,
      thresholdLineY,
    };
  }

  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  context.fillStyle = "rgba(15, 23, 42, 0.08)";
  context.fillRect(0, thresholdLineY, width, 1);

  if (visibleSeconds.length === 0) {
    return {
      chartMaxMs,
      slots,
      thresholdLineY,
    };
  }

  for (const slot of slots) {
    const { second } = slot;
    const maxHeight = Math.max(
      MIN_BAR_HEIGHT,
      scaleHeight(second.maxMs, chartMaxMs, height)
    );
    const avgHeight = Math.max(
      MIN_AVG_HEIGHT,
      scaleHeight(second.avgMs, chartMaxMs, height)
    );
    const maxY = height - maxHeight;
    const avgY = height - avgHeight;
    const hasSlow = second.slowCount > 0;

    if (slot.inBenchmarkRange) {
      context.fillStyle = "rgba(15, 23, 42, 0.08)";
      context.fillRect(slot.x, 0, slot.width, height);
    }

    context.fillStyle = hasSlow
      ? "rgba(248, 113, 113, 0.28)"
      : "rgba(15, 23, 42, 0.12)";
    context.fillRect(slot.x, maxY, slot.width, maxHeight);

    context.fillStyle = hasSlow ? "#ef4444" : "#9ca3af";
    context.fillRect(slot.x, avgY, slot.width, avgHeight);

    const bucketEntries = Object.entries(second.mergedBuckets).sort(
      (left, right) => right[1] - left[1]
    );
    const totalBucketDuration = bucketEntries.reduce(
      (sum, [, duration]) => sum + duration,
      0
    );

    if (!(totalBucketDuration > 0)) {
      continue;
    }

    let remainingY = height;

    for (const [label, duration] of bucketEntries) {
      const segmentHeight = Math.max(
        1,
        Math.round((duration / totalBucketDuration) * avgHeight)
      );
      remainingY -= segmentHeight;
      context.fillStyle = getBucketColor(label);
      context.fillRect(
        slot.x,
        Math.max(avgY, remainingY),
        slot.width,
        segmentHeight
      );
    }
  }

  return {
    chartMaxMs,
    slots,
    thresholdLineY,
  };
};
