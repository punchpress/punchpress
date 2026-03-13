"use client";

// Adapted from the Kibo UI color picker:
// https://www.kibo-ui.com/components/color-picker

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ColorPickerContext,
  type ColorPickerProps,
  useResolvedColor,
} from "./color-picker-context";
import { clampColor } from "./color-picker-utils";

export const ColorPicker = ({
  children,
  className,
  defaultValue = "#FFFFFF",
  onValueChange,
  value,
  ...props
}: ColorPickerProps) => {
  const resolvedValue = useResolvedColor(value, defaultValue);
  const [color, setColor] = useState(resolvedValue);
  const [mode, setMode] = useState<ColorPickerMode>("hex");

  useEffect(() => {
    setColor(resolvedValue);
  }, [resolvedValue]);

  const updateColor = useCallback(
    (changes: Partial<ColorPickerColor>) => {
      setColor((currentColor) => {
        const nextColor = clampColor({
          ...currentColor,
          ...changes,
        });

        onValueChange?.(nextColor);
        return nextColor;
      });
    },
    [onValueChange]
  );

  return (
    <ColorPickerContext.Provider
      value={{
        color,
        mode,
        setMode,
        updateColor,
      }}
    >
      <div
        className={cn("flex w-full flex-col gap-3", className)}
        data-slot="color-picker"
        {...props}
      >
        {children}
      </div>
    </ColorPickerContext.Provider>
  );
};
