"use client";

import { Slider as BaseSlider } from "@base-ui/react/slider";
import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { useColorPicker } from "./color-picker-context";
import { CHECKERBOARD_STYLE, getOpaqueColor } from "./color-picker-utils";

interface ColorPickerSliderProps {
  children?: ReactNode;
  className?: string;
  max: number;
  min: number;
  onValueChange: (value: number) => void;
  value: number;
}

const ColorPickerSlider = ({
  children,
  className,
  max,
  min,
  onValueChange,
  value,
}: ColorPickerSliderProps) => {
  const thumbId = useId();

  return (
    <BaseSlider.Root
      className={cn("data-[orientation=horizontal]:w-full", className)}
      max={max}
      min={min}
      onValueChange={(nextValue) => onValueChange(nextValue[0] ?? min)}
      thumbAlignment="edge"
      value={[value]}
    >
      <BaseSlider.Control className="flex touch-none select-none data-[orientation=horizontal]:w-full">
        <BaseSlider.Track className="relative h-3 w-full grow overflow-hidden rounded-full border border-black/6 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.14)]">
          {children}
          <BaseSlider.Indicator className="bg-transparent" />
          <BaseSlider.Thumb
            aria-labelledby={thumbId}
            className="block size-4 shrink-0 rounded-full border border-white bg-transparent shadow-[0_0_0_1px_rgb(0_0_0_/_0.24),0_1px_3px_rgb(0_0_0_/_0.2)] outline-none has-focus-visible:ring-[3px] has-focus-visible:ring-ring/24"
            index={0}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
      <span className="sr-only" id={thumbId}>
        Color picker slider
      </span>
    </BaseSlider.Root>
  );
};

export const ColorPickerHue = ({
  className,
  ...props
}: Omit<
  ComponentProps<typeof BaseSlider.Root>,
  "children" | "max" | "min"
>) => {
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
}: Omit<
  ComponentProps<typeof BaseSlider.Root>,
  "children" | "max" | "min"
>) => {
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
