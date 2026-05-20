"use client";

// Adapted from Fluid Functionalism Slider:
// https://www.fluidfunctionalism.com/docs/slider

import { Slider as BaseSliderPrimitive } from "@base-ui/react/slider";
import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  useMemo,
} from "react";

import { cn } from "@/lib/utils";

type SliderValue = number | [number, number];
type ValuePosition = "bottom" | "left" | "right" | "tooltip" | "top";

interface SliderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  disabled?: boolean;
  fillClassName?: string;
  fillStyle?: CSSProperties;
  formatValue?: (value: number) => string;
  hideFill?: boolean;
  label?: string;
  max?: number;
  min?: number;
  onChange: (value: SliderValue) => void;
  showSteps?: boolean;
  showValue?: boolean;
  step?: number;
  thumbBorderColor?: string;
  thumbColor?: string;
  trackClassName?: string;
  trackStyle?: CSSProperties;
  value: SliderValue;
  valuePosition?: ValuePosition;
}

interface SliderComfortableProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  disabled?: boolean;
  formatValue?: (value: number) => string;
  label?: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
  variant?: "pips" | "scrubber";
}

const SliderPrimitive = BaseSliderPrimitive;
const MAX_VISIBLE_STEPS = 48;

const toArrayValue = (value: SliderValue) =>
  Array.isArray(value) ? value : [value];

const normalizeSliderValue = (values: number[]): SliderValue =>
  values.length > 1 ? [values[0] ?? 0, values[1] ?? 0] : (values[0] ?? 0);

const getPercent = (value: number, min: number, max: number) => {
  if (max === min) {
    return 0;
  }

  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
};

const getSteps = (min: number, max: number, step: number) => {
  if (!(Number.isFinite(min) && Number.isFinite(max) && step > 0)) {
    return [];
  }

  const count = Math.round((max - min) / step) + 1;
  if (count < 2 || count > MAX_VISIBLE_STEPS) {
    return [];
  }

  return Array.from({ length: count }, (_, index) =>
    getPercent(min + index * step, min, max)
  );
};

const Slider = forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      className,
      disabled = false,
      fillClassName,
      fillStyle,
      formatValue = String,
      hideFill = false,
      label,
      max = 100,
      min = 0,
      onChange,
      showSteps = false,
      showValue = true,
      step = 1,
      thumbBorderColor,
      thumbColor,
      trackClassName,
      trackStyle,
      value,
      valuePosition = "left",
      ...props
    },
    ref
  ) => {
    const {
      "aria-label": ariaLabel,
      "data-slider-label": dataSliderLabel,
      ...rootProps
    } = props;
    const values = toArrayValue(value);
    const steps = useMemo(
      () => (showSteps ? getSteps(min, max, step) : []),
      [max, min, showSteps, step]
    );
    const displayValue = values.map(formatValue).join(" - ");
    const hasInlineValue = showValue && valuePosition !== "tooltip";
    const thumbKeys = values.length > 1 ? ["min", "max"] : ["single"];

    const control = (
      <BaseSliderPrimitive.Root
        className="group/slider relative w-full min-w-0 touch-none select-none"
        disabled={disabled}
        max={max}
        min={min}
        onValueChange={(nextValue) => {
          onChange(normalizeSliderValue(nextValue));
        }}
        ref={ref}
        step={step}
        thumbAlignment="edge"
        value={values}
        {...rootProps}
      >
        <BaseSliderPrimitive.Control
          className="relative flex min-h-5 items-center"
          data-slot="slider-control"
        >
          <BaseSliderPrimitive.Track
            className={cn(
              "relative h-5 w-full grow overflow-hidden rounded-full border border-border bg-muted shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.22)]",
              trackClassName
            )}
            data-slot="slider-track"
            style={trackStyle}
          >
            {hideFill ? null : (
              <BaseSliderPrimitive.Indicator
                className={cn(
                  "h-full rounded-full bg-[var(--canvas-selected)]",
                  fillClassName
                )}
                data-slot="slider-indicator"
                style={fillStyle}
              />
            )}
            {steps.length > 0 ? (
              <div aria-hidden className="pointer-events-none absolute inset-0">
                {steps.map((left) => (
                  <span
                    className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/24"
                    key={left}
                    style={{ left: `${left}%` }}
                  />
                ))}
              </div>
            ) : null}
          </BaseSliderPrimitive.Track>
          {values.map((_, index) => (
            <BaseSliderPrimitive.Thumb
              className="block size-4 shrink-0 rounded-full border-2 border-white bg-white shadow-[0_0_0_1px_rgb(0_0_0_/_0.32)] outline-none transition-transform has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background data-dragging:scale-110"
              data-slider-label={dataSliderLabel}
              data-slot="slider-thumb"
              index={index}
              key={thumbKeys[index]}
              style={{
                backgroundColor: thumbColor,
                borderColor: thumbBorderColor,
              }}
            />
          ))}
        </BaseSliderPrimitive.Control>
        {ariaLabel && values.length === 1 ? (
          <input
            aria-label={ariaLabel}
            className="absolute inset-0 z-10 m-0 h-full w-full cursor-default appearance-none bg-transparent opacity-0"
            data-slider-label={dataSliderLabel}
            max={max}
            min={min}
            onChange={(event) => onChange(Number(event.currentTarget.value))}
            step={step}
            type="range"
            value={values[0]}
          />
        ) : null}
      </BaseSliderPrimitive.Root>
    );

    let positionedControl = control;
    if (valuePosition === "top") {
      positionedControl = (
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          {hasInlineValue ? (
            <SliderValueText label={label} value={displayValue} />
          ) : null}
          {control}
        </div>
      );
    } else if (valuePosition === "bottom") {
      positionedControl = (
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          {control}
          {hasInlineValue ? (
            <SliderValueText label={label} value={displayValue} />
          ) : null}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-2 text-xs",
          disabled && "pointer-events-none opacity-64",
          className
        )}
        data-slot="slider"
      >
        {hasInlineValue && valuePosition === "left" ? (
          <SliderValueText label={label} value={displayValue} />
        ) : null}
        {positionedControl}
        {hasInlineValue && valuePosition === "right" ? (
          <SliderValueText label={label} value={displayValue} />
        ) : null}
      </div>
    );
  }
);

Slider.displayName = "Slider";

const SliderComfortable = forwardRef<HTMLDivElement, SliderComfortableProps>(
  (
    {
      className,
      disabled = false,
      formatValue = String,
      label,
      max = 100,
      min = 0,
      onChange,
      step = 1,
      value,
      variant = "pips",
      ...props
    },
    ref
  ) => {
    const percent = getPercent(value, min, max);
    const steps = useMemo(
      () => (variant === "pips" ? getSteps(min, max, step) : []),
      [max, min, step, variant]
    );

    return (
      <BaseSliderPrimitive.Root
        className={cn(
          "group/comfortable relative flex min-h-9 w-full min-w-0 touch-none select-none items-center overflow-hidden rounded-lg border border-[var(--control-border)] bg-[var(--control-surface)] px-3 text-foreground text-sm outline-none transition-colors focus-within:border-[var(--control-border-focus)] hover:border-[var(--control-border-hover)] hover:bg-[var(--control-surface-hover)]",
          variant === "pips" && "gap-3",
          disabled && "pointer-events-none opacity-64",
          className
        )}
        data-slot="slider-comfortable"
        disabled={disabled}
        max={max}
        min={min}
        onValueChange={(nextValue) => onChange(nextValue[0] ?? value)}
        ref={ref}
        step={step}
        thumbAlignment="edge"
        value={[value]}
        {...props}
      >
        {label ? (
          <span className="relative z-10 min-w-0 shrink truncate text-muted-foreground text-xs">
            {label}
          </span>
        ) : null}
        <BaseSliderPrimitive.Control
          className="relative flex h-6 min-w-0 flex-1 items-center"
          data-slot="slider-comfortable-control"
        >
          <BaseSliderPrimitive.Track
            className="relative h-full w-full overflow-hidden rounded-full"
            data-slot="slider-comfortable-track"
          >
            <div className="absolute inset-0 rounded-full bg-foreground/7" />
            <BaseSliderPrimitive.Indicator
              className="absolute h-full rounded-full bg-[var(--canvas-selected)]/22"
              data-slot="slider-comfortable-indicator"
            />
            {steps.length > 0 ? (
              <div aria-hidden className="pointer-events-none absolute inset-0">
                {steps.map((left) => (
                  <span
                    className={cn(
                      "absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
                      left <= percent
                        ? "bg-[var(--canvas-selected)]"
                        : "bg-foreground/24"
                    )}
                    key={left}
                    style={{ left: `${left}%` }}
                  />
                ))}
              </div>
            ) : null}
          </BaseSliderPrimitive.Track>
          <BaseSliderPrimitive.Thumb
            className="block h-5 w-0.5 shrink-0 rounded-full bg-[var(--canvas-selected)] outline-none transition-transform has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background data-dragging:scale-y-110"
            data-slot="slider-comfortable-thumb"
            index={0}
          />
        </BaseSliderPrimitive.Control>
        <span className="relative z-10 min-w-9 shrink-0 text-right font-medium text-xs tabular-nums">
          {formatValue(value)}
        </span>
      </BaseSliderPrimitive.Root>
    );
  }
);

SliderComfortable.displayName = "SliderComfortable";

function SliderValue({ className, ...props }) {
  return (
    <BaseSliderPrimitive.Value
      className={cn("flex justify-end text-sm", className)}
      data-slot="slider-value"
      {...props}
    />
  );
}

function SliderValueText({ label, value }: { label?: string; value: string }) {
  return (
    <span className="min-w-10 shrink-0 text-muted-foreground tabular-nums">
      {label ? `${label}: ` : null}
      {value}
    </span>
  );
}

export {
  Slider,
  SliderComfortable,
  SliderPrimitive,
  SliderValue,
  type SliderComfortableProps,
  type SliderProps,
  type SliderValue,
  type ValuePosition,
};
