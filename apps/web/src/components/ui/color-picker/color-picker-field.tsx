"use client";

import { Popover } from "@base-ui/react/popover";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/editor-react/use-editor";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { ColorPickerEyeDropper } from "./color-picker-eye-dropper";
import { ColorPickerFormat, ColorPickerOutput } from "./color-picker-output";
import { ColorPickerSelection } from "./color-picker-selection";
import { ColorPickerAlpha, ColorPickerHue } from "./color-picker-sliders";
import {
  CHECKERBOARD_STYLE,
  formatStorageColor,
  parseColor,
} from "./color-picker-utils";

interface ColorPickerFieldProps {
  className?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  stateKey?: string;
  value?: string | null;
}

const colorPickerOpenState = new Map<
  string,
  { open: boolean; resetTimeoutId: number | null }
>();

const getColorPickerOpenEntry = (stateKey: string) => {
  let entry = colorPickerOpenState.get(stateKey);

  if (!entry) {
    entry = {
      open: false,
      resetTimeoutId: null,
    };
    colorPickerOpenState.set(stateKey, entry);
  }

  return entry;
};

const ColorPickerField = ({
  className,
  onChange,
  placeholder,
  stateKey = "default",
  value,
}: ColorPickerFieldProps) => {
  const editor = useEditor();
  const openStateEntry = getColorPickerOpenEntry(stateKey);
  const fieldRef = useRef<HTMLDivElement>(null);
  const isPopupDismissSuppressedRef = useRef(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupDismissSuppressionTimeoutRef = useRef<number | null>(null);
  const selectionBeforePopupInteractionRef = useRef<string[]>([]);
  const [draftValue, setDraftValue] = useState(value ?? "");
  const [open, setOpenState] = useState(openStateEntry.open);

  const setOpen = (nextOpen: boolean) => {
    openStateEntry.open = nextOpen;
    setOpenState(nextOpen);
  };

  useEffect(() => {
    setDraftValue(value ?? "");
  }, [value]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (openStateEntry.resetTimeoutId !== null) {
      window.clearTimeout(openStateEntry.resetTimeoutId);
      openStateEntry.resetTimeoutId = null;
    }

    return () => {
      openStateEntry.resetTimeoutId = window.setTimeout(() => {
        openStateEntry.open = false;
        openStateEntry.resetTimeoutId = null;
      }, 0);
    };
  }, [openStateEntry]);

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

  useEffect(() => {
    if (!(open && typeof document !== "undefined")) {
      return;
    }

    const body = document.body;
    const previousState = body.dataset.colorPickerOpen;

    body.dataset.colorPickerOpen = "true";

    return () => {
      if (previousState) {
        body.dataset.colorPickerOpen = previousState;
      } else {
        delete body.dataset.colorPickerOpen;
      }
    };
  }, [open]);

  const handlePopupPointerDownCapture = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (popupDismissSuppressionTimeoutRef.current !== null) {
      window.clearTimeout(popupDismissSuppressionTimeoutRef.current);
    }

    isPopupDismissSuppressedRef.current = true;
    selectionBeforePopupInteractionRef.current = [...editor.selectedNodeIds];

    const handleSuppressedPointerUp = (pointerEvent: PointerEvent) => {
      if (
        pointerEvent.target instanceof Node &&
        popupRef.current?.contains(pointerEvent.target)
      ) {
        document.removeEventListener("pointerup", handleSuppressedPointerUp, true);
        return;
      }

      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
      pointerEvent.stopImmediatePropagation();
      document.removeEventListener("pointerup", handleSuppressedPointerUp, true);
    };

    document.addEventListener("pointerup", handleSuppressedPointerUp, true);

    const handlePointerInteractionEnd = () => {
      const handleSuppressedClick = (clickEvent: MouseEvent) => {
        if (
          clickEvent.target instanceof Node &&
          popupRef.current?.contains(clickEvent.target)
        ) {
          document.removeEventListener("click", handleSuppressedClick, true);
          return;
        }

        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        clickEvent.stopImmediatePropagation();
        document.removeEventListener("click", handleSuppressedClick, true);
      };

      document.addEventListener("click", handleSuppressedClick, true);
      window.setTimeout(() => {
        if (
          editor.selectedNodeIds.length === 0 &&
          selectionBeforePopupInteractionRef.current.length > 0
        ) {
          editor.setSelectedNodes(selectionBeforePopupInteractionRef.current);
        }
      }, 0);
      popupDismissSuppressionTimeoutRef.current = window.setTimeout(() => {
        isPopupDismissSuppressedRef.current = false;
        popupDismissSuppressionTimeoutRef.current = null;
      }, 120);
      window.removeEventListener("pointercancel", handlePointerInteractionEnd, true);
      window.removeEventListener("pointerup", handlePointerInteractionEnd, true);
    };

    window.addEventListener("pointercancel", handlePointerInteractionEnd, true);
    window.addEventListener("pointerup", handlePointerInteractionEnd, true);
  };

  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      ref={fieldRef}
    >
      <Popover.Root
        modal
        onOpenChange={(nextOpen) => {
          if (!nextOpen && isPopupDismissSuppressedRef.current) {
            return;
          }

          setOpen(nextOpen);
        }}
        open={open}
      >
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
          {value ? (
            <span
              className="absolute inset-[1px] rounded-[calc(var(--radius-md)-2px)]"
              style={{
                backgroundColor: value,
              }}
            />
          ) : null}
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
              onPointerDownCapture={handlePopupPointerDownCapture}
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
        placeholder={placeholder}
        value={draftValue}
      />
    </div>
  );
};

export { ColorPickerField };
