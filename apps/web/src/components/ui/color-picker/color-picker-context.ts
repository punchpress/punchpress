"use client";

import { createContext, type HTMLAttributes, useContext, useMemo } from "react";
import {
  type ColorPickerColor,
  type ColorPickerMode,
  DEFAULT_COLOR,
  parseColor,
} from "./color-picker-utils";

interface ColorPickerContextValue {
  color: ColorPickerColor;
  mode: ColorPickerMode;
  setMode: (mode: ColorPickerMode) => void;
  updateColor: (changes: Partial<ColorPickerColor>) => void;
}

export interface ColorPickerProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  onValueChange?: (value: ColorPickerColor) => void;
  value?: string | null;
}

const ColorPickerContext = createContext<ColorPickerContextValue | null>(null);

export const OUTPUT_MODES: ColorPickerMode[] = ["hex", "rgb", "css", "hsl"];

export const useColorPicker = () => {
  const context = useContext(ColorPickerContext);

  if (!context) {
    throw new Error(
      "Color picker components must be rendered inside ColorPicker."
    );
  }

  return context;
};

export const useResolvedColor = (
  value?: string | null,
  defaultValue?: string
) => {
  return useMemo(() => {
    return parseColor(value) ?? parseColor(defaultValue) ?? DEFAULT_COLOR;
  }, [defaultValue, value]);
};

export { ColorPickerContext };
