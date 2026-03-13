"use client";

import { type HTMLAttributes, memo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useColorPicker } from "./color-picker-context";

export const ColorPickerSelection = memo(
  ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { color, updateColor } = useColorPicker();

    const handlePointerUpdate = useCallback(
      (clientX: number, clientY: number) => {
        if (!containerRef.current) {
          return;
        }

        const bounds = containerRef.current.getBoundingClientRect();
        const saturation = ((clientX - bounds.left) / bounds.width) * 100;
        const value = (1 - (clientY - bounds.top) / bounds.height) * 100;

        updateColor({
          saturation,
          value,
        });
      },
      [updateColor]
    );

    return (
      <div
        className={cn(
          "relative aspect-square w-full cursor-crosshair overflow-hidden rounded-xl border shadow-xs/5",
          className
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          handlePointerUpdate(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) {
            return;
          }

          handlePointerUpdate(event.clientX, event.clientY);
        }}
        ref={containerRef}
        style={{
          background: `linear-gradient(to top, rgb(0 0 0), transparent), linear-gradient(to right, rgb(255 255 255), hsl(${color.hue} 100% 50%))`,
        }}
        {...props}
      >
        <div
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0_/_0.35)]"
          style={{
            left: `${color.saturation}%`,
            top: `${100 - color.value}%`,
          }}
        />
      </div>
    );
  }
);

ColorPickerSelection.displayName = "ColorPickerSelection";
