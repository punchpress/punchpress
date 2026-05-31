import {
  memo,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PerformanceBenchmarkResult,
  PerformanceFrameSample,
} from "../../performance/performance-controller";

const CHART_HEIGHT = 76;
const CHART_SCROLL_HEIGHT = 80;
const CHART_TOP_INSET = 8;
const MINIMAP_HEIGHT = 28;
const MIN_CHART_MAX_MS = 75;
const CHART_HEADROOM = 1.25;
const FRAME_SLOT_WIDTH = 11;
const FRAME_BAR_WIDTH = 9;
const SLOW_FRAME_THRESHOLD_MS = 16.7;

interface ScrollIndicatorState {
  leftPercent: number;
  visible: boolean;
  widthPercent: number;
}

interface FrameTooltipState {
  durationMs: number;
  label: string;
}

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

const getChartMaxMs = (frames: PerformanceFrameSample[]) => {
  const durations = frames
    .map((frame) => frame.durationMs)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (durations.length === 0) {
    return MIN_CHART_MAX_MS;
  }

  const p95Index = Math.min(
    durations.length - 1,
    Math.floor((durations.length - 1) * 0.95)
  );

  return Math.max(
    MIN_CHART_MAX_MS,
    SLOW_FRAME_THRESHOLD_MS,
    (durations[p95Index] || 0) * CHART_HEADROOM
  );
};

const getFrameBarHeight = (durationMs: number, chartMaxMs: number) => {
  return Math.max(
    2,
    Math.min(1, durationMs / chartMaxMs) * (CHART_HEIGHT - CHART_TOP_INSET)
  );
};

const getFrameOpacity = ({
  isSelected,
  isSlow,
}: {
  isSelected: boolean;
  isSlow: boolean;
}) => {
  if (isSelected) {
    return 1;
  }

  return isSlow ? 0.55 : 0.75;
};

const getThumbLeftPercent = (scrollIndicator: ScrollIndicatorState) => {
  return (
    (scrollIndicator.leftPercent / 100) * (100 - scrollIndicator.widthPercent)
  );
};

export const getInitialPerformanceFrame = (
  result: PerformanceBenchmarkResult | null
) => {
  if (!result) {
    return null;
  }

  return (
    [...result.frames]
      .filter((frame) => frame.spans?.length)
      .sort((left, right) => right.durationMs - left.durationMs)[0] ||
    result.frames.at(-1) ||
    null
  );
};

const PerformanceResultFrameStripComponent = ({
  children,
  onFrameHover,
  onFrameSelect,
  result,
  scrollFrameId,
  selectedFrameId,
}: {
  children?: ReactNode;
  onFrameHover?: (frame: PerformanceFrameSample | null) => void;
  onFrameSelect?: (frame: PerformanceFrameSample) => void;
  result: PerformanceBenchmarkResult | null;
  scrollFrameId?: number | null;
  selectedFrameId: number | null;
}) => {
  const chartScrollId = useId();
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const frameTooltipRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const minimapDragOffsetRatioRef = useRef<number | null>(null);
  const [frameTooltip, setFrameTooltip] = useState<FrameTooltipState | null>(
    null
  );
  const [scrollIndicator, setScrollIndicator] = useState<ScrollIndicatorState>({
    leftPercent: 0,
    visible: false,
    widthPercent: 100,
  });
  const frames = result?.frames || [];
  const frameCount = frames.length;
  const chartMaxMs = useMemo(() => getChartMaxMs(frames), [frames]);
  const summary = result?.summary;
  const frameWidth = FRAME_SLOT_WIDTH;
  const chartWidth = Math.max(frameWidth, frames.length * frameWidth);
  const thresholdLineBottom =
    (SLOW_FRAME_THRESHOLD_MS / chartMaxMs) * (CHART_HEIGHT - CHART_TOP_INSET);
  const thresholdLabelTop =
    CHART_TOP_INSET + CHART_HEIGHT - thresholdLineBottom - 14;
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId);
  const scrollFrame = frames.find((frame) => frame.id === scrollFrameId);
  const headlineMs =
    selectedFrame?.durationMs ??
    summary?.p95FrameMs ??
    summary?.averageFrameMs ??
    0;
  const updateScrollIndicator = useCallback(() => {
    const chartScroll = chartScrollRef.current;

    if (!chartScroll) {
      return;
    }

    const scrollableWidth = chartScroll.scrollWidth - chartScroll.clientWidth;

    if (scrollableWidth <= 1) {
      setScrollIndicator({
        leftPercent: 0,
        visible: false,
        widthPercent: 100,
      });
      return;
    }

    setScrollIndicator({
      leftPercent: (chartScroll.scrollLeft / scrollableWidth) * 100,
      visible: true,
      widthPercent: (chartScroll.clientWidth / chartScroll.scrollWidth) * 100,
    });
  }, []);
  const positionFrameTooltipAt = useCallback(
    (clientX: number, clientY: number) => {
      const tooltip = frameTooltipRef.current;

      if (!tooltip) {
        return;
      }

      const offset = 12;
      const bounds = tooltip.getBoundingClientRect();
      let left = clientX + offset;
      let top = clientY + offset;

      if (left + bounds.width > window.innerWidth - 8) {
        left = clientX - bounds.width - offset;
      }

      if (top + bounds.height > window.innerHeight - 8) {
        top = clientY - bounds.height - offset;
      }

      tooltip.style.transform = `translate3d(${Math.max(8, left)}px, ${Math.max(8, top)}px, 0)`;
    },
    []
  );
  const positionFrameTooltip = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      positionFrameTooltipAt(event.clientX, event.clientY);
    },
    [positionFrameTooltipAt]
  );
  const updateScrollFromMinimap = useCallback(
    (clientX: number, mode: "center" | "drag") => {
      const chartScroll = chartScrollRef.current;
      const minimap = minimapRef.current;

      if (!(chartScroll && minimap)) {
        return;
      }

      const scrollableWidth = chartScroll.scrollWidth - chartScroll.clientWidth;

      if (scrollableWidth <= 1) {
        return;
      }

      const bounds = minimap.getBoundingClientRect();
      const pointerRatio = Math.max(
        0,
        Math.min(1, (clientX - bounds.left) / bounds.width)
      );
      const viewportRatio = scrollIndicator.widthPercent / 100;
      const dragOffsetRatio = minimapDragOffsetRatioRef.current ?? 0;
      const nextThumbLeftRatio = Math.max(
        0,
        Math.min(
          1 - viewportRatio,
          mode === "center"
            ? pointerRatio - viewportRatio / 2
            : pointerRatio - dragOffsetRatio
        )
      );
      const nextScrollRatio =
        viewportRatio >= 1 ? 0 : nextThumbLeftRatio / (1 - viewportRatio);

      chartScroll.scrollLeft = nextScrollRatio * scrollableWidth;
      updateScrollIndicator();
    },
    [scrollIndicator.widthPercent, updateScrollIndicator]
  );

  useEffect(() => {
    const chartScroll = chartScrollRef.current;
    const selectedIndex = scrollFrame ? frames.indexOf(scrollFrame) : -1;

    if (!(chartScroll && selectedIndex >= 0)) {
      return;
    }

    const selectedX = selectedIndex * frameWidth;
    const targetScrollLeft = Math.max(
      0,
      selectedX - chartScroll.clientWidth * 0.75
    );

    chartScroll.scrollLeft = targetScrollLeft;
    updateScrollIndicator();
  }, [frames, scrollFrame, updateScrollIndicator]);

  useEffect(() => {
    const chartScroll = chartScrollRef.current;

    if (!chartScroll) {
      return;
    }

    updateScrollIndicator();
    chartScroll.addEventListener("scroll", updateScrollIndicator, {
      passive: true,
    });

    const resizeObserver = new ResizeObserver(updateScrollIndicator);
    resizeObserver.observe(chartScroll);

    return () => {
      chartScroll.removeEventListener("scroll", updateScrollIndicator);
      resizeObserver.disconnect();
    };
  }, [updateScrollIndicator]);

  useEffect(() => {
    if (frameCount < 0) {
      return;
    }

    updateScrollIndicator();
  }, [frameCount, updateScrollIndicator]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 items-stretch divide-x divide-border border-black/7 border-b dark:border-white/7">
        <div className="flex items-center gap-4 px-4 py-2.5">
          <HudStatCell label="FPS" value={Math.round(summary?.fps || 0)} />
          <HudStatCell
            color={getTimingColor(summary?.p50FrameMs || 0)}
            label="P50"
            value={formatMs(summary?.p50FrameMs || 0)}
          />
          <HudStatCell
            color={getTimingColor(summary?.p95FrameMs || 0)}
            label="P95"
            value={formatMs(summary?.p95FrameMs || 0)}
          />
          <HudStatCell label="Slow" value={summary?.slowFrameCount || 0} />
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5">
          <HudStatCell label="Frames" value={frameCount} />
          <HudStatCell
            label="Selected"
            value={
              selectedFrame ? `#${frames.indexOf(selectedFrame) + 1}` : "-"
            }
          />
        </div>

        <div className="flex items-center px-4 py-2.5">
          <span
            className="font-semibold text-xl tabular-nums tracking-tight"
            style={{ color: getTimingColor(headlineMs) }}
          >
            {formatMs(headlineMs)}
          </span>
          <span className="ml-1.5 text-[11px] text-muted-foreground">
            / 8ms
          </span>
        </div>
        {children ? children : null}
      </div>

      <div>
        <div className="relative h-[120px] w-full px-2 pt-2">
          <span className="pointer-events-none absolute top-1 left-2 text-[10px] text-muted-foreground tabular-nums">
            {formatMs(chartMaxMs)}
          </span>
          <span
            className="pointer-events-none absolute left-2 text-[10px] text-muted-foreground tabular-nums"
            style={{ top: thresholdLabelTop }}
          >
            16.7ms
          </span>
          <div
            className="relative w-full overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            id={chartScrollId}
            onPointerLeave={() => {
              onFrameHover?.(null);
              setFrameTooltip(null);
            }}
            ref={chartScrollRef}
            style={{ height: CHART_SCROLL_HEIGHT }}
          >
            <div
              className="relative"
              style={{
                height: CHART_HEIGHT,
                width: frames.length > 0 ? chartWidth : "100%",
              }}
            >
              <div
                className="pointer-events-none absolute right-0 left-0 border-red-500/30 border-t border-dashed dark:border-red-500/20"
                style={{ bottom: thresholdLineBottom }}
              />
              {frames.length > 0
                ? frames.map((frame, index) => {
                    const height = getFrameBarHeight(
                      frame.durationMs,
                      chartMaxMs
                    );
                    const isSelected = frame.id === selectedFrameId;
                    const isSlow = frame.durationMs > SLOW_FRAME_THRESHOLD_MS;

                    return (
                      <button
                        aria-label={`Frame ${index + 1}: ${formatMs(frame.durationMs)}`}
                        className="group absolute bottom-0"
                        key={frame.id}
                        onClick={() => onFrameSelect?.(frame)}
                        onPointerEnter={(event) => {
                          const { clientX, clientY } = event;

                          onFrameHover?.(frame);
                          setFrameTooltip({
                            durationMs: frame.durationMs,
                            label: `Frame #${index + 1}`,
                          });
                          window.requestAnimationFrame(() => {
                            positionFrameTooltipAt(clientX, clientY);
                          });
                        }}
                        onPointerLeave={() => {
                          setFrameTooltip(null);
                        }}
                        onPointerMove={positionFrameTooltip}
                        style={{
                          height: CHART_HEIGHT,
                          left: index * frameWidth,
                          width: frameWidth,
                        }}
                        type="button"
                      >
                        <span
                          className="absolute bottom-0 rounded-[1px] group-hover:outline group-hover:outline-1 group-hover:outline-foreground/45"
                          style={{
                            backgroundColor: isSlow ? "#ef4444" : "#9ca3af",
                            height,
                            left: 0,
                            opacity: getFrameOpacity({ isSelected, isSlow }),
                            outline: isSelected
                              ? "1px solid var(--foreground)"
                              : "none",
                            width: FRAME_BAR_WIDTH,
                          }}
                        />
                      </button>
                    );
                  })
                : null}
            </div>
          </div>
          {scrollIndicator.visible ? (
            <div
              aria-controls={chartScrollId}
              aria-label="Scroll performance frames"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(scrollIndicator.leftPercent)}
              className="absolute right-2 bottom-1 left-2 cursor-grab overflow-hidden rounded bg-muted active:cursor-grabbing"
              onKeyDown={(event) => {
                const chartScroll = chartScrollRef.current;

                if (!chartScroll) {
                  return;
                }

                const scrollableWidth =
                  chartScroll.scrollWidth - chartScroll.clientWidth;

                if (scrollableWidth <= 1) {
                  return;
                }

                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  chartScroll.scrollLeft -= chartScroll.clientWidth * 0.25;
                  updateScrollIndicator();
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  chartScroll.scrollLeft += chartScroll.clientWidth * 0.25;
                  updateScrollIndicator();
                } else if (event.key === "Home") {
                  event.preventDefault();
                  chartScroll.scrollLeft = 0;
                  updateScrollIndicator();
                } else if (event.key === "End") {
                  event.preventDefault();
                  chartScroll.scrollLeft = scrollableWidth;
                  updateScrollIndicator();
                }
              }}
              onPointerCancel={() => {
                minimapDragOffsetRatioRef.current = null;
              }}
              onPointerDown={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const pointerRatio = Math.max(
                  0,
                  Math.min(1, (event.clientX - bounds.left) / bounds.width)
                );
                const viewportRatio = scrollIndicator.widthPercent / 100;
                const thumbTrackLeftRatio =
                  (scrollIndicator.leftPercent / 100) * (1 - viewportRatio);
                const thumbTrackRightRatio =
                  thumbTrackLeftRatio + viewportRatio;
                const isInsideThumb =
                  pointerRatio >= thumbTrackLeftRatio &&
                  pointerRatio <= thumbTrackRightRatio;

                minimapDragOffsetRatioRef.current = isInsideThumb
                  ? pointerRatio - thumbTrackLeftRatio
                  : scrollIndicator.widthPercent / 200;
                event.currentTarget.setPointerCapture(event.pointerId);
                updateScrollFromMinimap(
                  event.clientX,
                  isInsideThumb ? "drag" : "center"
                );
              }}
              onPointerMove={(event) => {
                if (minimapDragOffsetRatioRef.current === null) {
                  return;
                }

                updateScrollFromMinimap(event.clientX, "drag");
              }}
              onPointerUp={(event) => {
                minimapDragOffsetRatioRef.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              ref={minimapRef}
              role="scrollbar"
              style={{ height: MINIMAP_HEIGHT }}
              tabIndex={0}
            >
              {frames.map((frame, index) => {
                const height = Math.max(
                  2,
                  Math.sqrt(Math.min(1, frame.durationMs / chartMaxMs)) *
                    MINIMAP_HEIGHT
                );
                const isSlow = frame.durationMs > SLOW_FRAME_THRESHOLD_MS;

                return (
                  <div
                    className="absolute bottom-0 rounded-[1px]"
                    key={frame.id}
                    style={{
                      backgroundColor: isSlow ? "#ef4444" : "#9ca3af",
                      height,
                      left: `${(index / frameCount) * 100}%`,
                      opacity: isSlow ? 0.65 : 0.7,
                      width: `${100 / frameCount}%`,
                    }}
                  />
                );
              })}
              <div className="pointer-events-none absolute inset-x-[2px] top-[2px] bottom-[2px]">
                <div
                  className="absolute top-0 bottom-0 rounded border border-foreground/35 bg-background/55"
                  style={{
                    left: `${getThumbLeftPercent(scrollIndicator)}%`,
                    width: `${scrollIndicator.widthPercent}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {frameTooltip ? (
        <div
          className="pointer-events-none fixed top-0 left-0 z-50 flex items-center whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-popover-foreground text-xs shadow-md/5"
          ref={frameTooltipRef}
        >
          <span>{frameTooltip.label}</span>
          <span className="ml-2 border-border border-l pl-2 font-mono text-muted-foreground tabular-nums">
            {formatMs(frameTooltip.durationMs)}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export const PerformanceResultFrameStrip = memo(
  PerformanceResultFrameStripComponent
);

const HudStatCell = ({
  color,
  label,
  value,
}: {
  color?: string;
  label: string;
  value: number | string;
}) => {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-[12px] text-foreground/35 tracking-[-0.01em]">
        {label}
      </span>
      <span
        className="font-medium text-sm tabular-nums leading-tight"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
};
