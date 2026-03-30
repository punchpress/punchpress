"use client";

// Adapted from the Kibo UI color picker:
// https://www.kibo-ui.com/components/color-picker

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getCanvasCursorStyle } from "@/components/canvas/canvas-cursor-assets";
import {
  ColorPickerContext,
  type ColorPickerProps,
  useResolvedColor,
} from "./color-picker-context";
import { clampColor } from "./color-picker-utils";

const COLOR_PICKER_CURSOR_STYLE = getCanvasCursorStyle();

export const ColorPicker = ({
  children,
  className,
  defaultValue = "#FFFFFF",
  onValueChange,
  style,
  value,
  ...props
}: ColorPickerProps) => {
  const resolvedValue = useResolvedColor(value, defaultValue);
  const [color, setColor] = useState(resolvedValue);
  const [mode, setMode] = useState<ColorPickerMode>("hex");
  const colorRef = useRef(resolvedValue);

  useEffect(() => {
    colorRef.current = resolvedValue;
    setColor(resolvedValue);
  }, [resolvedValue]);

  const updateColor = useCallback(
    (changes: Partial<ColorPickerColor>) => {
      const nextColor = clampColor({
        ...colorRef.current,
        ...changes,
      });

      colorRef.current = nextColor;
      setColor(nextColor);
      onValueChange?.(nextColor);
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
        style={{
          ...COLOR_PICKER_CURSOR_STYLE,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    </ColorPickerContext.Provider>
  );
};
