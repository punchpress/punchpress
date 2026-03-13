"use client";

import { PipetteIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useColorPicker } from "./color-picker-context";
import { parseColor } from "./color-picker-utils";

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

declare global {
  interface Window {
    EyeDropper?: EyeDropperConstructor;
  }
}

export const ColorPickerEyeDropper = ({
  className,
  onClick,
  ...props
}: ComponentProps<typeof Button>) => {
  const { updateColor } = useColorPicker();
  const isSupported =
    typeof window !== "undefined" && Boolean(window.EyeDropper);

  return (
    <Button
      className={cn("text-muted-foreground", className)}
      disabled={!isSupported}
      onClick={async (event) => {
        onClick?.(event);

        if (!window.EyeDropper) {
          return;
        }

        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open().catch(() => null);
        const nextColor = result ? parseColor(result.sRGBHex) : null;

        if (nextColor) {
          updateColor(nextColor);
        }
      }}
      size="icon-sm"
      type="button"
      variant="outline"
      {...props}
    >
      <PipetteIcon />
    </Button>
  );
};
