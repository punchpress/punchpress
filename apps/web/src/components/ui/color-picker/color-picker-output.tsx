"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OUTPUT_MODES, useColorPicker } from "./color-picker-context";
import { type ColorPickerMode, formatDisplayValue } from "./color-picker-utils";

const FormatInput = ({
  className,
  suffix,
  value,
}: {
  className?: string;
  suffix?: string;
  value: string;
}) => {
  return (
    <div className="relative min-w-0 flex-1">
      <Input
        className={cn("bg-secondary pe-7 text-xs shadow-none", className)}
        readOnly
        size="sm"
        value={value}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
};

export const ColorPickerOutput = ({
  className,
  ...props
}: ComponentProps<typeof SelectTrigger>) => {
  const { mode, setMode } = useColorPicker();

  return (
    <Select
      onValueChange={(value) => setMode(value as ColorPickerMode)}
      value={mode}
    >
      <SelectTrigger
        className={cn("min-w-0 shrink-0 text-xs", className)}
        size="sm"
        {...props}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OUTPUT_MODES.map((option) => (
          <SelectItem className="text-xs" key={option} value={option}>
            {option.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export const ColorPickerFormat = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const { color, mode } = useColorPicker();
  const displayValue = formatDisplayValue(color, mode);

  return (
    <div
      className={cn("flex min-w-0 flex-1 items-center gap-1.5", className)}
      {...props}
    >
      {displayValue.values.map((value) => (
        <FormatInput key={value} value={value} />
      ))}
      {displayValue.alpha ? (
        <FormatInput
          className="max-w-14"
          suffix="%"
          value={displayValue.alpha}
        />
      ) : null}
    </div>
  );
};
