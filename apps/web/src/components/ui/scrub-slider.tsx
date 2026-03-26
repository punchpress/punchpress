"use client";

import { clamp, format, toNumber } from "@punchpress/engine";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ScrubSliderProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  max: number;
  min: number;
  onValueChange: (value: number) => void;
  overflowRecoveryPixels?: number;
  pixelsPerStep?: number;
  step?: number;
  value: number;
}

const TICK_SPACING = 6;
const TICK_HEIGHT_SMALL = 4;
const TICK_HEIGHT_LARGE = 7;
const LARGE_TICK_INTERVAL = 5;
const RANGE_SCRUB_PIXELS = 400;
export const ScrubSlider = ({
  ariaLabel,
  className,
  disabled = false,
  formatValue = format,
  max,
  min,
  onValueChange,
  overflowRecoveryPixels = 80,
  pixelsPerStep = 2,
  step = 1,
  value,
}: ScrubSliderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startValue: number;
    startX: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubLineRef = useRef<HTMLDivElement>(null);
  const [draftValue, setDraftValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dragValuePerPixel = getDragValuePerPixel(min, max, step, pixelsPerStep);
  const overflowRecoveryValueSpan = overflowRecoveryPixels * dragValuePerPixel;

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const commitScrubValue = (startValue: number, deltaValue: number) => {
    onValueChange(
      resolveScrubValue(
        startValue,
        deltaValue,
        min,
        max,
        step,
        overflowRecoveryValueSpan
      )
    );
  };

  const commitTypedValue = (nextValue: number) => {
    onValueChange(normalizeValue(nextValue, min, max, step));
  };

  const startEditing = () => {
    if (disabled) {
      return;
    }

    setDraftValue(formatValue(value));
    setIsEditing(true);
  };

  const stopDragging = () => {
    dragStateRef.current = null;
    setIsDragging(false);
  };

  const commitDraftValue = () => {
    commitTypedValue(toNumber(draftValue, value));
    setIsEditing(false);
  };

  const tickCount = useCallback(() => {
    if (!containerRef.current) {
      return 0;
    }

    const width = containerRef.current.offsetWidth;
    return Math.floor(width / TICK_SPACING);
  }, []);

  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    setTicks(tickCount());

    const observer = new ResizeObserver(() => {
      setTicks(tickCount());
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [tickCount]);

  return (
    <div
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      aria-valuemax={Number.isFinite(max) ? max : undefined}
      aria-valuemin={Number.isFinite(min) ? min : undefined}
      aria-valuenow={value}
      aria-valuetext={formatValue(value)}
      className={cn(
        "group relative flex min-h-9 w-full touch-none select-none items-center overflow-hidden rounded-lg border border-transparent bg-muted px-[calc(--spacing(3)-1px)] text-base text-foreground outline-none transition-[border-color,background-color] hover:border-input hover:bg-accent focus-visible:border-ring sm:min-h-8 sm:text-sm dark:bg-input/32 dark:hover:bg-input/64",
        disabled && "pointer-events-none opacity-64",
        isDragging &&
          "cursor-ew-resize border-input bg-accent dark:bg-input/64",
        !(disabled || isDragging) && "cursor-ew-resize",
        className
      )}
      data-dragging={isDragging ? "true" : undefined}
      onDoubleClick={() => {
        startEditing();
      }}
      onKeyDown={(event) => {
        if (isEditing || disabled) {
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          startEditing();
          return;
        }

        if (event.key === "Home" && Number.isFinite(min)) {
          event.preventDefault();
          onValueChange(min);
          return;
        }

        if (event.key === "End" && Number.isFinite(max)) {
          event.preventDefault();
          onValueChange(max);
          return;
        }

        const delta = getKeyboardDelta(event.key, step, event.shiftKey);
        if (delta !== null) {
          event.preventDefault();
          commitScrubValue(value, delta);
        }
      }}
      onLostPointerCapture={stopDragging}
      onPointerCancel={stopDragging}
      onPointerDown={(event) => {
        if (disabled || isEditing) {
          return;
        }

        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);

        dragStateRef.current = {
          pointerId: event.pointerId,
          startValue: value,
          startX: event.clientX,
        };
        setIsDragging(true);
      }}
      onPointerMove={(event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
          return;
        }

        const deltaX = event.clientX - dragState.startX;
        const deltaValue = deltaX * dragValuePerPixel;

        commitScrubValue(dragState.startValue, deltaValue);
      }}
      onPointerUp={stopDragging}
      ref={containerRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      title="Drag horizontally to scrub. Double-click or press Enter to type a value."
    >
      {/* Ruler tick marks */}
      {!isEditing && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <svg
            aria-hidden="true"
            className={cn(
              "h-full w-full text-foreground/[0.13] transition-opacity dark:text-foreground/[0.16]",
              isDragging && "text-foreground/[0.2] dark:text-foreground/[0.24]"
            )}
            focusable="false"
            preserveAspectRatio="none"
          >
            {Array.from({ length: ticks }, (_, i) => {
              const x = (i + 1) * TICK_SPACING;
              const isLarge = (i + 1) % LARGE_TICK_INTERVAL === 0;
              const tickH = isLarge ? TICK_HEIGHT_LARGE : TICK_HEIGHT_SMALL;
              return (
                <line
                  key={x}
                  stroke="currentColor"
                  strokeWidth={1}
                  x1={x}
                  x2={x}
                  y1={`calc(50% - ${tickH / 2}px)`}
                  y2={`calc(50% + ${tickH / 2}px)`}
                />
              );
            })}
          </svg>
        </div>
      )}

      {/* Scrub line indicator */}
      {!isEditing && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1.5 bottom-1.5 w-0.5 -translate-x-1/2 rounded-full",
            isDragging
              ? "bg-foreground/50 dark:bg-foreground/60"
              : "bg-foreground/20 dark:bg-foreground/25"
          )}
          ref={scrubLineRef}
          style={{
            left: getScrubPercent(value, min, max),
          }}
        />
      )}

      {isEditing ? (
        <input
          className="relative z-10 h-8.5 w-full min-w-0 bg-transparent leading-8.5 outline-none sm:h-7.5 sm:leading-7.5"
          inputMode="decimal"
          onBlur={commitDraftValue}
          onChange={(event) => {
            setDraftValue(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraftValue();
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setIsEditing(false);
            }
          }}
          ref={inputRef}
          value={draftValue}
        />
      ) : (
        <span className="pointer-events-none relative z-10 ml-auto truncate font-medium tabular-nums tracking-[-0.01em]">
          {formatValue(value)}
        </span>
      )}
    </div>
  );
};

const getKeyboardDelta = (key: string, step: number, shiftKey: boolean) => {
  const multiplier = shiftKey ? 10 : 1;

  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return -step * multiplier;
    case "ArrowRight":
    case "ArrowUp":
      return step * multiplier;
    case "PageDown":
      return -step * 10;
    case "PageUp":
      return step * 10;
    default:
      return null;
  }
};

const getStepPrecision = (step: number) => {
  const normalizedStep = step.toString().toLowerCase();

  if (normalizedStep.includes("e-")) {
    const [, exponent = "0"] = normalizedStep.split("e-");
    return Number.parseInt(exponent, 10);
  }

  const [, decimals = ""] = normalizedStep.split(".");
  return decimals.length;
};

const normalizeValue = (
  value: number,
  min: number,
  max: number,
  step: number,
  clampToBounds = true
) => {
  const stepBase = Number.isFinite(min) ? min : 0;
  const stepPrecision = getStepPrecision(step);
  const steppedValue =
    step > 0 ? Math.round((value - stepBase) / step) * step + stepBase : value;
  const roundedValue =
    stepPrecision > 0
      ? Number.parseFloat(steppedValue.toFixed(stepPrecision))
      : Math.round(steppedValue);

  if (clampToBounds && (Number.isFinite(min) || Number.isFinite(max))) {
    return clamp(roundedValue, min, max);
  }

  return roundedValue;
};

const getDragValuePerPixel = (
  min: number,
  max: number,
  step: number,
  pixelsPerStep: number
) => {
  if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
    return (max - min) / RANGE_SCRUB_PIXELS;
  }

  return step / Math.max(pixelsPerStep, 1);
};

const resolveScrubValue = (
  startValue: number,
  deltaValue: number,
  min: number,
  max: number,
  step: number,
  overflowRecoveryValueSpan: number
) => {
  const nextValue = getScrubValue(
    startValue,
    deltaValue,
    min,
    max,
    overflowRecoveryValueSpan
  );

  return normalizeValue(nextValue, min, max, step);
};

const getScrubValue = (
  startValue: number,
  deltaValue: number,
  min: number,
  max: number,
  overflowRecoveryValueSpan: number
) => {
  if (startValue > max) {
    if (deltaValue >= 0) {
      return startValue;
    }

    return recoverFromUpperOverflow(
      startValue,
      max,
      -deltaValue,
      overflowRecoveryValueSpan
    );
  }

  if (startValue < min) {
    if (deltaValue <= 0) {
      return startValue;
    }

    return recoverFromLowerOverflow(
      startValue,
      min,
      deltaValue,
      overflowRecoveryValueSpan
    );
  }

  return clamp(startValue + deltaValue, min, max);
};

const recoverFromUpperOverflow = (
  startValue: number,
  max: number,
  towardRangeDelta: number,
  overflowRecoveryValueSpan: number
) => {
  const overshoot = startValue - max;
  const recoverySpan = Math.max(overflowRecoveryValueSpan, 1);

  if (towardRangeDelta >= recoverySpan) {
    return max - (towardRangeDelta - recoverySpan);
  }

  const progress = towardRangeDelta / recoverySpan;
  return max + overshoot * (1 - easeOutQuart(progress));
};

const recoverFromLowerOverflow = (
  startValue: number,
  min: number,
  towardRangeDelta: number,
  overflowRecoveryValueSpan: number
) => {
  const overshoot = min - startValue;
  const recoverySpan = Math.max(overflowRecoveryValueSpan, 1);

  if (towardRangeDelta >= recoverySpan) {
    return min + (towardRangeDelta - recoverySpan);
  }

  const progress = towardRangeDelta / recoverySpan;
  return min - overshoot * (1 - easeOutQuart(progress));
};

const getScrubPercent = (value: number, min: number, max: number): string => {
  const hasFiniteRange = Number.isFinite(min) && Number.isFinite(max);
  if (!hasFiniteRange || max === min) {
    return "50%";
  }

  const ratio = clamp((value - min) / (max - min), 0, 1);
  const percent = 4 + ratio * 92;
  return `${percent}%`;
};

const easeOutQuart = (value: number) => {
  return 1 - (1 - value) ** 4;
};
