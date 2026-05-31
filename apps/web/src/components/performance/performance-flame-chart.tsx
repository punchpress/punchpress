import { HugeiconsIcon } from "@hugeicons/react";
import { ChartBarBigIcon } from "@hugeicons-pro/core-stroke-rounded";
import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PerformanceFlameSpan } from "../../performance/performance-controller";

const BAR_COLORS = [
  { background: "var(--chart-1)", foreground: "white" },
  { background: "var(--chart-2)", foreground: "white" },
  { background: "var(--chart-3)", foreground: "white" },
  { background: "var(--chart-4)", foreground: "var(--foreground)" },
  { background: "var(--chart-5)", foreground: "var(--foreground)" },
  { background: "var(--canvas-selected)", foreground: "white" },
  { background: "var(--info)", foreground: "white" },
  { background: "var(--success)", foreground: "white" },
  { background: "var(--warning)", foreground: "var(--foreground)" },
  { background: "var(--destructive)", foreground: "white" },
];
const MAX_RENDERED_SPANS = 900;
const ROW_HEIGHT = 26;
const ROW_GAP = 4;
const CHART_PADDING_Y = 0;
const MIN_UNMEASURED_MS = 0.05;

interface PerformanceFlameChartProps {
  className?: string;
  frameDurationMs?: number | null;
  height?: number;
  spans: PerformanceFlameSpan[];
}

interface FlameChartSpan {
  color?: string;
  depth: number;
  durationMs: number;
  endMs: number;
  label: string;
  startMs: number;
  textColor?: string;
}

interface CursorTooltipState {
  durationMs: number;
  label: string;
}

const getLabelHash = (label: string) => {
  let hash = 0;

  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) % 1_000_003;
  }

  return Math.abs(hash);
};

const getSpanColor = (label: string) => {
  return BAR_COLORS[getLabelHash(label) % BAR_COLORS.length].background;
};

const getSpanTextColor = (label: string) => {
  return BAR_COLORS[getLabelHash(label) % BAR_COLORS.length].foreground;
};

const formatMs = (value: number) => `${value.toFixed(value < 10 ? 2 : 1)}ms`;

const getFrameGroups = (spans: PerformanceFlameSpan[]) => {
  const frames = new Map<string, PerformanceFlameSpan[]>();

  for (const span of spans.filter((span) => span.frameId !== undefined)) {
    const frameId = String(span.frameId);
    const frame = frames.get(frameId);

    if (frame) {
      frame.push(span);
    } else {
      frames.set(frameId, [span]);
    }
  }

  if (frames.size > 0) {
    return [...frames.values()];
  }

  const fallbackFrames: PerformanceFlameSpan[][] = [];
  const orderedSpans = [...spans].sort(
    (left, right) => left.startMs - right.startMs || left.depth - right.depth
  );

  for (const span of orderedSpans) {
    const lastFrame = fallbackFrames.at(-1);
    const lastSpan = lastFrame?.at(-1);

    if (!(lastFrame && lastSpan) || span.startMs - lastSpan.endMs > 4) {
      fallbackFrames.push([span]);
    } else {
      lastFrame.push(span);
    }
  }

  return fallbackFrames;
};

const getRepresentativeFrameSpans = (spans: PerformanceFlameSpan[]) => {
  const frameGroups = getFrameGroups(spans);
  let representativeFrame: FlameChartSpan[] = [];
  let representativeMeasuredMs = 0;

  for (const frameSpans of frameGroups) {
    if (frameSpans.length === 0) {
      continue;
    }

    const frameStartMs = Math.min(...frameSpans.map((span) => span.startMs));
    const frame = frameSpans.map((span) => {
      const durationMs = span.durationMs;

      return {
        depth: span.depth,
        durationMs,
        endMs: span.startMs - frameStartMs + durationMs,
        label: span.label,
        startMs: span.startMs - frameStartMs,
      };
    });
    const measuredMs = frame
      .filter((span) => span.depth === 0)
      .reduce((sum, span) => sum + span.durationMs, 0);

    if (measuredMs > representativeMeasuredMs) {
      representativeFrame = frame;
      representativeMeasuredMs = measuredMs;
    }
  }

  const orderedSpans = representativeFrame.sort(
    (left, right) =>
      left.startMs - right.startMs ||
      left.depth - right.depth ||
      right.durationMs - left.durationMs
  );

  if (orderedSpans.length <= MAX_RENDERED_SPANS) {
    return orderedSpans;
  }

  return orderedSpans
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, MAX_RENDERED_SPANS)
    .sort(
      (left, right) => left.startMs - right.startMs || left.depth - right.depth
    );
};

const compactMeasuredWork = (spans: FlameChartSpan[]) => {
  if (spans.length === 0) {
    return [];
  }

  let currentEndMs = 0;
  let removedGapMs = 0;

  return [...spans]
    .sort(
      (left, right) => left.startMs - right.startMs || left.depth - right.depth
    )
    .map((span) => {
      const gapMs = Math.max(0, span.startMs - currentEndMs);
      removedGapMs += gapMs;
      currentEndMs = Math.max(currentEndMs, span.endMs);

      return {
        ...span,
        endMs: span.endMs - removedGapMs,
        startMs: span.startMs - removedGapMs,
      };
    });
};

const addFrameContext = (
  spans: FlameChartSpan[],
  frameDurationMs: number | null | undefined
) => {
  const compactedSpans = compactMeasuredWork(spans);

  if (compactedSpans.length === 0) {
    return [];
  }

  const measuredDurationMs = Math.max(
    ...compactedSpans.map((span) => span.endMs)
  );
  const visibleDurationMs = Math.max(
    measuredDurationMs,
    frameDurationMs ?? measuredDurationMs
  );
  const unattributedDurationMs = visibleDurationMs - measuredDurationMs;
  const unattributedSpan =
    unattributedDurationMs > MIN_UNMEASURED_MS
      ? [
          {
            color:
              "color-mix(in srgb, var(--muted-foreground) 14%, transparent)",
            depth: 1,
            durationMs: unattributedDurationMs,
            endMs: visibleDurationMs,
            label: "Unattributed Time",
            startMs: measuredDurationMs,
            textColor: "var(--muted-foreground)",
          },
        ]
      : [];
  const punchpressMeasuredSpan =
    measuredDurationMs > MIN_UNMEASURED_MS
      ? [
          {
            color: "color-mix(in srgb, var(--success) 22%, transparent)",
            depth: 1,
            durationMs: measuredDurationMs,
            endMs: measuredDurationMs,
            label: "Measured PunchPress Work",
            startMs: 0,
            textColor: "var(--foreground)",
          },
        ]
      : [];

  return [
    {
      color: "color-mix(in srgb, var(--muted-foreground) 22%, transparent)",
      depth: 0,
      durationMs: visibleDurationMs,
      endMs: visibleDurationMs,
      label: "frame",
      startMs: 0,
      textColor: "var(--foreground)",
    },
    ...punchpressMeasuredSpan,
    ...compactedSpans.map((span) => ({
      ...span,
      depth: span.depth + 2,
    })),
    ...unattributedSpan,
  ];
};

const getVisibleSpans = (
  spans: PerformanceFlameSpan[],
  frameDurationMs: number | null | undefined
) => {
  const representativeSpans = addFrameContext(
    getRepresentativeFrameSpans(spans),
    frameDurationMs
  );

  if (representativeSpans.length <= MAX_RENDERED_SPANS) {
    return representativeSpans;
  }

  return [...representativeSpans]
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, MAX_RENDERED_SPANS)
    .sort(
      (left, right) => left.startMs - right.startMs || left.depth - right.depth
    );
};

const getFlameModel = (
  spans: PerformanceFlameSpan[],
  frameDurationMs: number | null | undefined
) => {
  const visibleSpans = getVisibleSpans(spans, frameDurationMs);
  const startMs = 0;
  const endMs = Math.max(...visibleSpans.map((span) => span.endMs));
  const durationMs = Math.max(0.1, endMs);
  const maxDepth = Math.max(0, ...visibleSpans.map((span) => span.depth));

  return {
    durationMs,
    maxDepth,
    startMs,
    visibleSpans,
  };
};

export const PerformanceFlameChart = ({
  className,
  frameDurationMs = null,
  height = 280,
  spans,
}: PerformanceFlameChartProps) => {
  const cursorTooltipRef = useRef<HTMLDivElement | null>(null);
  const [cursorTooltip, setCursorTooltip] = useState<CursorTooltipState | null>(
    null
  );
  const flameModel = useMemo(() => {
    return spans.length > 0 ? getFlameModel(spans, frameDurationMs) : null;
  }, [frameDurationMs, spans]);
  const contentHeight = flameModel
    ? Math.max(
        height,
        (flameModel.maxDepth + 1) * (ROW_HEIGHT + ROW_GAP) + CHART_PADDING_Y * 2
      )
    : height;
  const positionCursorTooltipAt = useCallback(
    (clientX: number, clientY: number) => {
      const tooltip = cursorTooltipRef.current;

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
  const positionCursorTooltip = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      positionCursorTooltipAt(event.clientX, event.clientY);
    },
    [positionCursorTooltipAt]
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-background text-card-foreground",
        className
      )}
    >
      <div className="overflow-auto bg-background" style={{ height }}>
        <div
          className="min-w-[860px] p-2"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, color-mix(in srgb, var(--border) 18%, transparent) 1px, transparent 1px), linear-gradient(to right, color-mix(in srgb, var(--border) 12%, transparent) 1px, transparent 1px)",
            backgroundSize: `${ROW_HEIGHT + ROW_GAP}px ${ROW_HEIGHT + ROW_GAP}px, 64px 64px`,
            height: contentHeight,
          }}
        >
          <div className="relative h-full min-w-[844px]">
            {flameModel ? (
              flameModel.visibleSpans.map((span, index) => {
                const left =
                  ((span.startMs - flameModel.startMs) /
                    flameModel.durationMs) *
                  100;
                const width = Math.max(
                  1.2,
                  (span.durationMs / flameModel.durationMs) * 100
                );
                const top =
                  span.depth * (ROW_HEIGHT + ROW_GAP) + CHART_PADDING_Y;

                return (
                  <div
                    className="absolute overflow-hidden rounded-[3px] border border-foreground/10 px-2 text-center font-medium text-[11px] leading-[24px] shadow-[inset_0_1px_rgb(255_255_255/0.22)]"
                    key={`${span.label}-${span.startMs}-${span.depth}-${index}`}
                    onPointerEnter={(event) => {
                      const { clientX, clientY } = event;

                      setCursorTooltip({
                        durationMs: span.durationMs,
                        label: span.label,
                      });
                      window.requestAnimationFrame(() => {
                        positionCursorTooltipAt(clientX, clientY);
                      });
                    }}
                    onPointerLeave={() => {
                      setCursorTooltip(null);
                    }}
                    onPointerMove={positionCursorTooltip}
                    style={{
                      backgroundColor: span.color || getSpanColor(span.label),
                      color: span.textColor || getSpanTextColor(span.label),
                      height: ROW_HEIGHT,
                      left: `${left}%`,
                      minWidth: 18,
                      top,
                      width: `calc(${width}% - 1px)`,
                    }}
                  >
                    <span className="block truncate">
                      {span.label} ({formatMs(span.durationMs)})
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <HugeiconsIcon
                    className="text-muted-foreground/55"
                    color="currentColor"
                    icon={ChartBarBigIcon}
                    size={52}
                    strokeWidth={1.5}
                  />
                  <div className="space-y-1">
                    <div className="font-medium text-foreground text-sm">
                      No flame spans yet
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      Run a benchmark to capture frame-level work.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {cursorTooltip ? (
        <div
          className="pointer-events-none fixed top-0 left-0 z-50 flex items-center whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-popover-foreground text-xs shadow-md/5"
          ref={cursorTooltipRef}
        >
          <span>{cursorTooltip.label}</span>
          <span className="ml-2 border-border border-l pl-2 font-mono text-muted-foreground tabular-nums">
            {formatMs(cursorTooltip.durationMs)}
          </span>
        </div>
      ) : null}
    </div>
  );
};
