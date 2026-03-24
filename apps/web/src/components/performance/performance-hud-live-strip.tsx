import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import type {
  PerformanceHudSnapshot,
  PerformanceSecondBucket,
} from "../../performance/performance-controller";
import { usePerformanceController } from "../../performance/use-performance-controller";
import {
  drawPerformanceHudChart,
  type HudChartSlot,
} from "./performance-hud-chart-canvas";

const CHART_HEIGHT = 100;

const formatMs = (value: number) => `${value.toFixed(1)}ms`;

const getTimingColor = (ms: number) => {
  if (ms <= 8.3) {
    return "#10b981";
  }

  if (ms <= 16.7) {
    return "#f59e0b";
  }

  return "#ef4444";
};

interface HudTextRefs {
  fpsRef: RefObject<HTMLSpanElement | null>;
  headlineRef: RefObject<HTMLSpanElement | null>;
  nodesRef: RefObject<HTMLSpanElement | null>;
  p50Ref: RefObject<HTMLSpanElement | null>;
  p95Ref: RefObject<HTMLSpanElement | null>;
  selectedNodesRef: RefObject<HTMLSpanElement | null>;
  slowRef: RefObject<HTMLSpanElement | null>;
  textNodesRef: RefObject<HTMLSpanElement | null>;
  thresholdLineRef: RefObject<HTMLDivElement | null>;
  topLabelRef: RefObject<HTMLSpanElement | null>;
}

interface HudHoverRefs {
  highlightRef: RefObject<HTMLDivElement | null>;
  tooltipBucketsRef: RefObject<HTMLDivElement | null>;
  tooltipPrimaryRef: RefObject<HTMLDivElement | null>;
  tooltipRef: RefObject<HTMLDivElement | null>;
  tooltipSecondaryRef: RefObject<HTMLDivElement | null>;
}

const setText = (
  ref: RefObject<HTMLElement | null>,
  value: number | string,
  color?: string
) => {
  if (!ref.current) {
    return;
  }

  ref.current.textContent = `${value}`;

  if (color) {
    ref.current.style.color = color;
  }
};

const updateChart = ({
  canvas,
  chartContainer,
  snapshot,
  slotsRef,
  thresholdLineRef,
  topLabelRef,
}: {
  canvas: HTMLCanvasElement | null;
  chartContainer: HTMLDivElement | null;
  snapshot: PerformanceHudSnapshot;
  slotsRef: RefObject<HudChartSlot[]>;
  thresholdLineRef: RefObject<HTMLDivElement | null>;
  topLabelRef: RefObject<HTMLSpanElement | null>;
}) => {
  if (!(canvas && chartContainer)) {
    return;
  }

  const { chartMaxMs, slots, thresholdLineY } = drawPerformanceHudChart({
    canvas,
    height: CHART_HEIGHT,
    snapshot,
    width: chartContainer.clientWidth,
  });

  slotsRef.current = slots;
  setText(topLabelRef, `${Math.round(chartMaxMs)}ms`);

  if (thresholdLineRef.current) {
    thresholdLineRef.current.style.bottom = `${thresholdLineY}px`;
  }
};

const formatBucketSummary = (second: PerformanceSecondBucket) => {
  return Object.entries(second.mergedBuckets)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label, duration]) => `${label} ${duration.toFixed(1)}ms`)
    .join("\n");
};

const updateHoverTooltip = ({
  chartContainer,
  hoverRefs,
  slot,
}: {
  chartContainer: HTMLDivElement | null;
  hoverRefs: HudHoverRefs;
  slot: HudChartSlot | null;
}) => {
  if (
    !(
      chartContainer &&
      hoverRefs.highlightRef.current &&
      hoverRefs.tooltipRef.current
    )
  ) {
    return;
  }

  if (!slot) {
    hoverRefs.highlightRef.current.hidden = true;
    hoverRefs.tooltipRef.current.hidden = true;
    return;
  }

  const highlight = hoverRefs.highlightRef.current;
  const tooltip = hoverRefs.tooltipRef.current;
  const tooltipWidth = 240;
  const preferredLeft = slot.x + slot.width / 2 - tooltipWidth / 2;
  const tooltipLeft = Math.max(
    8,
    Math.min(preferredLeft, chartContainer.clientWidth - tooltipWidth - 8)
  );

  highlight.hidden = false;
  highlight.style.left = `${slot.x - 1}px`;
  highlight.style.width = `${slot.width + 2}px`;

  tooltip.hidden = false;
  tooltip.style.left = `${tooltipLeft}px`;

  setText(
    hoverRefs.tooltipPrimaryRef,
    `${slot.second.frameCount} frames${
      slot.second.slowCount > 0 ? ` • ${slot.second.slowCount} slow` : ""
    }`
  );
  setText(
    hoverRefs.tooltipSecondaryRef,
    `${slot.second.avgMs.toFixed(1)}ms avg • ${slot.second.maxMs.toFixed(1)}ms max`
  );
  setText(hoverRefs.tooltipBucketsRef, formatBucketSummary(slot.second));
};

const findHoveredSlot = (slots: HudChartSlot[], offsetX: number) => {
  return (
    slots.find((slot) => {
      return offsetX >= slot.x && offsetX <= slot.x + slot.width;
    }) || null
  );
};

const updateLiveSummary = (
  refs: HudTextRefs,
  snapshot: PerformanceHudSnapshot
) => {
  setText(refs.fpsRef, Math.round(snapshot.liveSummary.fps));
  setText(
    refs.p50Ref,
    formatMs(snapshot.liveSummary.p50FrameMs),
    getTimingColor(snapshot.liveSummary.p50FrameMs)
  );
  setText(
    refs.p95Ref,
    formatMs(snapshot.liveSummary.p95FrameMs),
    getTimingColor(snapshot.liveSummary.p95FrameMs)
  );
  setText(refs.slowRef, snapshot.liveSummary.slowFrameCount);
  setText(
    refs.headlineRef,
    formatMs(snapshot.liveSummary.p95FrameMs),
    getTimingColor(snapshot.liveSummary.p95FrameMs)
  );
};

const updateNodeStats = (
  refs: HudTextRefs,
  snapshot: PerformanceHudSnapshot
) => {
  setText(refs.nodesRef, snapshot.nodeStats.totalNodeCount);
  setText(refs.textNodesRef, snapshot.nodeStats.visibleTextNodeCount);
  setText(refs.selectedNodesRef, snapshot.nodeStats.selectedNodeCount);
};

export const PerformanceHudLiveStrip = ({
  children,
}: {
  children?: ReactNode;
}) => {
  const controller = usePerformanceController();
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const topLabelRef = useRef<HTMLSpanElement | null>(null);
  const fpsRef = useRef<HTMLSpanElement | null>(null);
  const p50Ref = useRef<HTMLSpanElement | null>(null);
  const p95Ref = useRef<HTMLSpanElement | null>(null);
  const slowRef = useRef<HTMLSpanElement | null>(null);
  const headlineRef = useRef<HTMLSpanElement | null>(null);
  const nodesRef = useRef<HTMLSpanElement | null>(null);
  const textNodesRef = useRef<HTMLSpanElement | null>(null);
  const selectedNodesRef = useRef<HTMLSpanElement | null>(null);
  const thresholdLineRef = useRef<HTMLDivElement | null>(null);
  const hoverHighlightRef = useRef<HTMLDivElement | null>(null);
  const hoverTooltipRef = useRef<HTMLDivElement | null>(null);
  const hoverTooltipPrimaryRef = useRef<HTMLDivElement | null>(null);
  const hoverTooltipSecondaryRef = useRef<HTMLDivElement | null>(null);
  const hoverTooltipBucketsRef = useRef<HTMLDivElement | null>(null);
  const hoverOffsetXRef = useRef<null | number>(null);
  const slotsRef = useRef<HudChartSlot[]>([]);

  useEffect(() => {
    const textRefs: HudTextRefs = {
      fpsRef,
      headlineRef,
      nodesRef,
      p50Ref,
      p95Ref,
      selectedNodesRef,
      slowRef,
      thresholdLineRef,
      textNodesRef,
      topLabelRef,
    };
    const hoverRefs: HudHoverRefs = {
      highlightRef: hoverHighlightRef,
      tooltipBucketsRef: hoverTooltipBucketsRef,
      tooltipPrimaryRef: hoverTooltipPrimaryRef,
      tooltipRef: hoverTooltipRef,
      tooltipSecondaryRef: hoverTooltipSecondaryRef,
    };

    const render = () => {
      const snapshot = controller.getHudSnapshot();
      updateChart({
        canvas: canvasRef.current,
        chartContainer: chartContainerRef.current,
        snapshot,
        slotsRef,
        thresholdLineRef,
        topLabelRef,
      });
      updateLiveSummary(textRefs, snapshot);
      updateNodeStats(textRefs, snapshot);
      updateHoverTooltip({
        chartContainer: chartContainerRef.current,
        hoverRefs,
        slot:
          hoverOffsetXRef.current === null
            ? null
            : findHoveredSlot(slotsRef.current, hoverOffsetXRef.current),
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      const chartContainer = chartContainerRef.current;

      if (!chartContainer) {
        return;
      }

      const bounds = chartContainer.getBoundingClientRect();
      const offsetX = event.clientX - bounds.left;
      const slot = findHoveredSlot(slotsRef.current, offsetX);
      hoverOffsetXRef.current = offsetX;

      updateHoverTooltip({
        chartContainer,
        hoverRefs,
        slot,
      });
    };

    const handlePointerLeave = () => {
      hoverOffsetXRef.current = null;
      updateHoverTooltip({
        chartContainer: chartContainerRef.current,
        hoverRefs,
        slot: null,
      });
    };

    render();

    const unsubscribe = controller.subscribeHud(render);
    const resizeObserver = new ResizeObserver(render);
    const chartContainer = chartContainerRef.current;

    if (chartContainer) {
      resizeObserver.observe(chartContainer);
      chartContainer.addEventListener("pointermove", handlePointerMove);
      chartContainer.addEventListener("pointerleave", handlePointerLeave);
    }

    return () => {
      unsubscribe();
      resizeObserver.disconnect();

      if (chartContainer) {
        chartContainer.removeEventListener("pointermove", handlePointerMove);
        chartContainer.removeEventListener("pointerleave", handlePointerLeave);
      }
    };
  }, [controller]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-black/7 border-b dark:border-white/7">
        <div className="relative h-[112px] w-full px-2 pt-2">
          <span
            className="pointer-events-none absolute top-1 left-2 text-[10px] text-muted-foreground tabular-nums"
            ref={topLabelRef}
          >
            75ms
          </span>
          <span className="pointer-events-none absolute bottom-4 left-2 text-[10px] text-muted-foreground tabular-nums">
            16.7ms
          </span>
          <div className="relative h-[100px] w-full" ref={chartContainerRef}>
            <canvas className="block h-[100px] w-full" ref={canvasRef} />
            <div
              className="pointer-events-none absolute right-0 left-0 border-red-500/30 border-t border-dashed dark:border-red-500/20"
              ref={thresholdLineRef}
            />
            <div
              className="pointer-events-none absolute top-[-6px] bottom-[-6px] bg-foreground/[0.08] dark:bg-foreground/[0.06]"
              hidden
              ref={hoverHighlightRef}
            />
            <div
              className="pointer-events-none absolute bottom-[calc(100%+10px)] z-10 w-60 rounded-md border border-border bg-card/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur-sm"
              hidden
              ref={hoverTooltipRef}
            >
              <div
                className="font-medium text-foreground"
                ref={hoverTooltipPrimaryRef}
              />
              <div
                className="mt-0.5 text-muted-foreground"
                ref={hoverTooltipSecondaryRef}
              />
              <div
                className="mt-1 whitespace-pre-line text-muted-foreground"
                ref={hoverTooltipBucketsRef}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-stretch divide-x divide-border">
        <div className="flex items-center gap-4 px-4 py-2.5">
          <HudStatCell label="FPS" valueRef={fpsRef} />
          <HudStatCell label="P50" valueRef={p50Ref} />
          <HudStatCell label="P95" valueRef={p95Ref} />
          <HudStatCell label="Slow" valueRef={slowRef} />
        </div>

        <div className="flex items-center px-4 py-2.5">
          <span
            className="font-semibold text-xl tabular-nums tracking-tight"
            ref={headlineRef}
          >
            0.0ms
          </span>
          <span className="ml-1.5 text-[11px] text-muted-foreground">
            / 8ms
          </span>
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5">
          <HudStatCell label="Nodes" valueRef={nodesRef} />
          <HudStatCell label="Text" valueRef={textNodesRef} />
          <HudStatCell label="Selected" valueRef={selectedNodesRef} />
        </div>
        {children ? children : null}
      </div>
    </div>
  );
};

const HudStatCell = ({
  label,
  valueRef,
}: {
  label: string;
  valueRef: RefObject<HTMLSpanElement | null>;
}) => {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-[12px] text-foreground/35 tracking-[-0.01em]">
        {label}
      </span>
      <span
        className="font-medium text-sm tabular-nums leading-tight"
        ref={valueRef}
      >
        0
      </span>
    </div>
  );
};
