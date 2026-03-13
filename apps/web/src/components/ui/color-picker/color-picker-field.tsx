"use client";

import { Popover } from "@base-ui/react/popover";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ColorPicker,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "./color-picker";
import {
  CHECKERBOARD_STYLE,
  formatStorageColor,
  parseColor,
} from "./color-picker-utils";

interface ColorPickerFieldProps {
  className?: string;
  onChange: (value: string) => void;
  value?: string | null;
}

const ColorPickerField = ({
  className,
  onChange,
  value,
}: ColorPickerFieldProps) => {
  const fieldRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [draftValue, setDraftValue] = useState(value ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDraftValue(value ?? "");
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (
        popupRef.current?.contains(event.target) ||
        fieldRef.current?.contains(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open]);

  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      ref={fieldRef}
    >
      <Popover.Root modal onOpenChange={setOpen} open={open}>
        <Popover.Trigger
          className={cn(
            buttonVariants({
              size: "icon-sm",
              variant: "outline",
            }),
            "relative overflow-hidden rounded-md border-input p-0"
          )}
        >
          <span className="absolute inset-0" style={CHECKERBOARD_STYLE} />
          <span
            className="absolute inset-[1px] rounded-[calc(var(--radius-md)-2px)]"
            style={{
              backgroundColor: value ?? "#ffffff",
            }}
          />
          <span className="sr-only">Choose color</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            align="start"
            className="z-50"
            side="bottom"
            sideOffset={6}
          >
            <Popover.Popup
              className="w-72 origin-(--transform-origin) rounded-2xl border bg-popover p-3 text-popover-foreground shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-150 data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0"
              initialFocus={false}
              ref={popupRef}
            >
              <ColorPicker
                defaultValue="#ffffff"
                onValueChange={(nextColor) =>
                  onChange(formatStorageColor(nextColor))
                }
                value={value}
              >
                <ColorPickerSelection />
                <div className="flex items-center gap-3">
                  <ColorPickerEyeDropper />
                  <div className="grid min-w-0 flex-1 gap-2">
                    <ColorPickerHue />
                    <ColorPickerAlpha />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ColorPickerOutput />
                  <ColorPickerFormat />
                </div>
              </ColorPicker>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <Input
        nativeInput
        onBlur={(event) => {
          const nextColor = parseColor(event.target.value);

          if (!nextColor) {
            setDraftValue(value ?? "");
            return;
          }

          const normalizedValue = formatStorageColor(nextColor);
          setDraftValue(normalizedValue);
          onChange(normalizedValue);
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          const nextColor = parseColor(nextValue);

          setDraftValue(nextValue);

          if (nextColor) {
            onChange(formatStorageColor(nextColor));
          }
        }}
        value={draftValue}
      />
    </div>
  );
};

export { ColorPickerField };
