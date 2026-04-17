"use client";

import { clamp, format, toNumber } from "@punchpress/engine";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ScrubSliderProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  displayValue?: string | null;
  formatValue?: (value: number) => string;
  keyboardStep?: number;
  max: number;
  min: number;
  onScrubEnd?: () => void;
  onScrubStart?: () => void;
  onValueChange: (value: number) => void;
  overflowRecoveryPixels?: number;
  pixelsPerStep?: number;
  preserveDisplayValueWhileDragging?: boolean;
  step?: number;
  value: number;
  valueBadge?: string | null;
}

const TICK_SPACING = 6;
const TICK_HEIGHT_SMALL = 4;
const TICK_HEIGHT_LARGE = 7;
const LARGE_TICK_INTERVAL = 5;
const SCRUB_PERCENT_PADDING = 4;
const SCRUB_PERCENT_SPAN = 100 - SCRUB_PERCENT_PADDING * 2;

const handleSliderKeyDown = ({
  disabled,
  event,
  isEditing,
  max,
  min,
  onStep,
  onValueChange,
  resolvedKeyboardStep,
  startEditing,
}: {
  disabled: boolean;
  event: ReactKeyboardEvent<HTMLDivElement>;
  isEditing: boolean;
  max: number;
  min: number;
  onStep: (deltaValue: number) => void;
  onValueChange: (value: number) => void;
  resolvedKeyboardStep: number;
  startEditing: () => void;
}) => {
  if (isEditing || disabled) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    startEditing();
    return;
  }

  if (event.key === "Home" && Number.isFinite(min)) {
    event.preventDefault();
    event.stopPropagation();
    onValueChange(min);
    return;
  }

  if (event.key === "End" && Number.isFinite(max)) {
    event.preventDefault();
    event.stopPropagation();
    onValueChange(max);
    return;
  }

  const delta = getKeyboardDelta(
    event.key,
    resolvedKeyboardStep,
    event.shiftKey
  );

  if (delta === null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  onStep(delta);
};

const beginScrubDrag = ({
  event,
  max,
  min,
  overflowRecoveryPixels,
  pixelsPerStep,
  setIsDragging,
  startValue,
  step,
}: {
  event: React.PointerEvent<HTMLDivElement>;
  max: number;
  min: number;
  overflowRecoveryPixels: number;
  pixelsPerStep: number;
  setIsDragging: (value: boolean) => void;
  startValue: number;
  step: number;
}) => {
  event.preventDefault();
  event.currentTarget.focus();
  event.currentTarget.setPointerCapture(event.pointerId);

  const dragValuePerPixel = getDragValuePerPixel(
    min,
    max,
    step,
    pixelsPerStep,
    event.currentTarget.getBoundingClientRect().width
  );

  setIsDragging(true);

  return {
    dragValuePerPixel,
    max,
    min,
    overflowRecoveryValueSpan: overflowRecoveryPixels * dragValuePerPixel,
    pointerId: event.pointerId,
    startValue,
    startX: event.clientX,
  };
};

const getScrubDragDeltaValue = ({
  dragState,
  event,
}: {
  dragState: {
    dragValuePerPixel: number;
    max: number;
    min: number;
    overflowRecoveryValueSpan: number;
    pointerId: number;
    startValue: number;
    startX: number;
  } | null;
  event: React.PointerEvent<HTMLDivElement>;
}) => {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return null;
  }

  const deltaX = event.clientX - dragState.startX;

  return {
    deltaValue: deltaX * dragState.dragValuePerPixel,
    dragState,
  };
};

const handleScrubSliderPointerDown = ({
  disabled,
  event,
  isEditing,
  max,
  min,
  overflowRecoveryPixels,
  pixelsPerStep,
  setIsDragging,
  startValue,
  step,
}: {
  disabled: boolean;
  event: React.PointerEvent<HTMLDivElement>;
  isEditing: boolean;
  max: number;
  min: number;
  overflowRecoveryPixels: number;
  pixelsPerStep: number;
  setIsDragging: (value: boolean) => void;
  startValue: number;
  step: number;
}) => {
  if (disabled || isEditing) {
    return null;
  }

  return beginScrubDrag({
    event,
    max,
    min,
    overflowRecoveryPixels,
    pixelsPerStep,
    setIsDragging,
    startValue,
    step,
  });
};

const handleScrubSliderPointerMove = ({
  dragState,
  event,
  onValueChange,
  step,
}: {
  dragState: {
    dragValuePerPixel: number;
    max: number;
    min: number;
    overflowRecoveryValueSpan: number;
    pointerId: number;
    startValue: number;
    startX: number;
  } | null;
  event: React.PointerEvent<HTMLDivElement>;
  onValueChange: (value: number) => void;
  step: number;
}) => {
  const dragUpdate = getScrubDragDeltaValue({
    dragState,
    event,
  });

  if (!dragUpdate) {
    return;
  }

  onValueChange(
    resolveScrubValue(
      dragUpdate.dragState.startValue,
      dragUpdate.deltaValue,
      dragUpdate.dragState.min,
      dragUpdate.dragState.max,
      step,
      dragUpdate.dragState.overflowRecoveryValueSpan
    )
  );
};

const handleScrubSliderInputKeyDown = ({
  event,
  commitDraftValue,
  cancelEditing,
}: {
  cancelEditing: () => void;
  commitDraftValue: () => void;
  event: ReactKeyboardEvent<HTMLInputElement>;
}) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitDraftValue();
    return;
  }

  if (event.key !== "Escape") {
    return;
  }

  event.preventDefault();
  cancelEditing();
};

const beginScrubSliderEditing = ({
  disabled,
  formatValue,
  setDraftValue,
  setIsEditing,
  value,
}: {
  disabled: boolean;
  formatValue: (value: number) => string;
  setDraftValue: (value: string) => void;
  setIsEditing: (value: boolean) => void;
  value: number;
}) => {
  if (disabled) {
    return;
  }

  setDraftValue(formatValue(value));
  setIsEditing(true);
};

const useAutoSelectScrubSliderInput = (
  inputRef: RefObject<HTMLInputElement | null>,
  isEditing: boolean
) => {
  useEffect(() => {
    if (!isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing, inputRef]);
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: shared slider handles display, typing, keyboard scrub, and pointer scrub in one control.
export const ScrubSlider = (props: ScrubSliderProps) => {
  const {
    ariaLabel,
    className,
    disabled = false,
    displayValue = null,
    formatValue = format,
    keyboardStep,
    max,
    min,
    onScrubEnd,
    onScrubStart,
    onValueChange,
    overflowRecoveryPixels = 80,
    pixelsPerStep = 2,
    preserveDisplayValueWhileDragging = false,
    step = 1,
    value,
    valueBadge = null,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    dragValuePerPixel: number;
    max: number;
    min: number;
    overflowRecoveryValueSpan: number;
    pointerId: number;
    startValue: number;
    startX: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubLineRef = useRef<HTMLDivElement>(null);
  const [draftValue, setDraftValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dragMin = dragStateRef.current?.min ?? min;
  const dragMax = dragStateRef.current?.max ?? max;
  useAutoSelectScrubSliderInput(inputRef, isEditing);

  const commitScrubValue = (startValue: number, deltaValue: number) => {
    const overflowRecoveryValueSpan =
      overflowRecoveryPixels *
      getDragValuePerPixel(min, max, step, pixelsPerStep);

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
    beginScrubSliderEditing({
      disabled,
      formatValue,
      setDraftValue,
      setIsEditing,
      value,
    });
  };

  const stopDragging = () => {
    const wasDragging = dragStateRef.current !== null;
    dragStateRef.current = null;
    setIsDragging(false);

    if (wasDragging) {
      onScrubEnd?.();
    }
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
  const visibleValue =
    displayValue && (!isDragging || preserveDisplayValueWhileDragging)
      ? displayValue
      : formatValue(value);
  const ariaValueText = [displayValue || formatValue(value), valueBadge]
    .filter(Boolean)
    .join(" ");
  const resolvedKeyboardStep = keyboardStep ?? step;

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
      aria-valuemax={Number.isFinite(dragMax) ? dragMax : undefined}
      aria-valuemin={Number.isFinite(dragMin) ? dragMin : undefined}
      aria-valuenow={value}
      aria-valuetext={ariaValueText}
      className={cn(
        "canvas-cursor-scroll-horizontal group relative flex min-h-9 w-full touch-none select-none items-center overflow-hidden rounded-lg border border-transparent bg-muted px-[calc(--spacing(3)-1px)] text-base text-foreground outline-none transition-[border-color,background-color] hover:border-input hover:bg-accent focus-visible:border-ring sm:min-h-8 sm:text-sm dark:bg-input/32 dark:hover:bg-input/64",
        disabled && "pointer-events-none opacity-64",
        isDragging && "border-input bg-accent dark:bg-input/64",
        className
      )}
      data-dragging={isDragging ? "true" : undefined}
      data-slot="scrub-slider"
      onDoubleClick={() => {
        startEditing();
      }}
      onKeyDown={(event) => {
        handleSliderKeyDown({
          disabled,
          event,
          isEditing,
          max,
          min,
          onStep: (deltaValue) => {
            commitScrubValue(value, deltaValue);
          },
          onValueChange,
          resolvedKeyboardStep,
          startEditing,
        });
      }}
      onLostPointerCapture={stopDragging}
      onPointerCancel={stopDragging}
      onPointerDown={(event) => {
        dragStateRef.current = handleScrubSliderPointerDown({
          disabled,
          event,
          isEditing,
          max,
          min,
          overflowRecoveryPixels,
          pixelsPerStep,
          setIsDragging,
          startValue: value,
          step,
        });

        if (dragStateRef.current) {
          onScrubStart?.();
        }
      }}
      onPointerMove={(event) => {
        handleScrubSliderPointerMove({
          dragState: dragStateRef.current,
          event,
          onValueChange,
          step,
        });
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
          data-slot="scrub-slider-indicator"
          ref={scrubLineRef}
          style={{
            left: getScrubPercent(value, dragMin, dragMax),
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
            handleScrubSliderInputKeyDown({
              cancelEditing: () => {
                setIsEditing(false);
              },
              commitDraftValue,
              event,
            });
          }}
          ref={inputRef}
          value={draftValue}
        />
      ) : (
        <span className="pointer-events-none relative z-10 ml-auto flex min-w-0 items-center gap-1.5 font-medium tabular-nums tracking-[-0.01em]">
          {valueBadge ? (
            <span className="shrink-0 rounded-full bg-foreground/7 px-1.5 py-0.5 font-semibold text-[10px] text-foreground/56 uppercase tracking-[0.08em]">
              {valueBadge}
            </span>
          ) : null}
          <span className="truncate">{visibleValue}</span>
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
  pixelsPerStep: number,
  containerWidth?: number
) => {
  if (
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    max > min &&
    typeof containerWidth === "number" &&
    containerWidth > 0
  ) {
    return (
      (max - min) / Math.max((containerWidth * SCRUB_PERCENT_SPAN) / 100, 1)
    );
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
  const percent = SCRUB_PERCENT_PADDING + ratio * SCRUB_PERCENT_SPAN;
  return `${percent}%`;
};

const easeOutQuart = (value: number) => {
  return 1 - (1 - value) ** 4;
};
