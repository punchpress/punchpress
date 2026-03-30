"use client";

import { type HTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { useColorPicker } from "./color-picker-context";
import { CHECKERBOARD_STYLE, getOpaqueColor } from "./color-picker-utils";

interface ColorPickerSliderProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  max: number;
  min: number;
  onValueChange: (value: number) => void;
  value: number;
}

const SLIDER_THUMB_SIZE = 16;

const getSliderPercent = (value: number, min: number, max: number) => {
  if (max <= min) {
    return 0;
  }

  return ((value - min) / (max - min)) * 100;
};

const ColorPickerSlider = ({
  children,
  className,
  max,
  min,
  onValueChange,
  value,
  ...props
}: ColorPickerSliderProps) => {
  const thumbId = useId();
  const clampedValue = Math.min(max, Math.max(min, value));
  const percent = getSliderPercent(clampedValue, min, max);
  const halfThumbSize = SLIDER_THUMB_SIZE / 2;

  return (
    <div className={cn("w-full", className)} {...props}>
      <div className="relative h-4 w-full">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full border border-black/6 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.14)]">
          {children}
        </div>
        <div
          className="pointer-events-none absolute top-1/2 z-10 block size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-transparent shadow-[0_0_0_1px_rgb(0_0_0_/_0.24),0_1px_3px_rgb(0_0_0_/_0.2)]"
          style={{
            left: `clamp(${halfThumbSize}px, ${percent}%, calc(100% - ${halfThumbSize}px))`,
          }}
        />
        <input
          aria-labelledby={thumbId}
          className="absolute inset-0 z-20 m-0 h-full w-full appearance-none bg-transparent opacity-0"
          max={max}
          min={min}
          onChange={(event) =>
            onValueChange(Number.parseFloat(event.currentTarget.value))
          }
          step="any"
          type="range"
          value={clampedValue}
        />
      </div>
      <span className="sr-only" id={thumbId}>
        Color picker slider
      </span>
    </div>
  );
};

export const ColorPickerHue = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const { color, updateColor } = useColorPicker();

  return (
    <ColorPickerSlider
      className={className}
      max={360}
      min={0}
      onValueChange={(hue) => updateColor({ hue })}
      value={color.hue}
      {...props}
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]" />
    </ColorPickerSlider>
  );
};

export const ColorPickerAlpha = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const { color, updateColor } = useColorPicker();

  return (
    <ColorPickerSlider
      className={className}
      max={100}
      min={0}
      onValueChange={(alpha) => updateColor({ alpha })}
      value={color.alpha}
      {...props}
    >
      <div className="absolute inset-0" style={CHECKERBOARD_STYLE} />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, transparent, ${getOpaqueColor(
            color
          )})`,
        }}
      />
    </ColorPickerSlider>
  );
};
