"use client";

import { Popover } from "@base-ui/react/popover";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@/editor-react/use-editor";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { formatStorageValue, parseColorValue } from "./color-picker-value";

interface ColorPickerFieldProps {
  className?: string;
  onChange: (value: string) => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
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

const CHECKERBOARD_STYLE = {
  backgroundColor: "var(--color-white)",
  backgroundImage:
    "conic-gradient(var(--color-neutral-200) 0 25%, var(--color-white) 0 50%, var(--color-neutral-200) 0 75%, var(--color-white) 0)",
  backgroundSize: "8px 8px",
} as const;

const HASH_PREFIX_REGEX = /^#/;

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const to2Hex = (value: number) =>
  Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

const trimHashPrefix = (input: string) => input.replace(HASH_PREFIX_REGEX, "");

const getHexDraftValue = (input: string | null | undefined) => {
  const parsed = parseColorValue(input);

  if (!parsed) {
    return trimHashPrefix(input ?? "");
  }

  return `${to2Hex(parsed.r)}${to2Hex(parsed.g)}${to2Hex(parsed.b)}`;
};

const getOpacityDraftValue = (input: string | null | undefined) => {
  const parsed = parseColorValue(input);

  if (!parsed) {
    return "100";
  }

  return String(Math.round(parsed.a * 100));
};

const formatColorWithOpacity = (colorInput: string, opacityInput: string) => {
  const parsed = parseColorValue(colorInput);
  const opacity = clampPercent(Number.parseFloat(opacityInput));

  if (!(parsed && Number.isFinite(opacity))) {
    return null;
  }

  return formatStorageValue({
    ...parsed,
    a: opacity / 100,
  });
};

const selectInputText = (event) => {
  event.currentTarget.select();
};

const ColorPickerField = ({
  className,
  onChange,
  onInteractionEnd,
  onInteractionStart,
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
  const historyMarkRef = useRef<unknown>(null);
  const selectionBeforePopupInteractionRef = useRef<string[]>([]);
  const [hexDraftValue, setHexDraftValue] = useState(getHexDraftValue(value));
  const [opacityDraftValue, setOpacityDraftValue] = useState(
    getOpacityDraftValue(value)
  );
  const [open, setOpenState] = useState(openStateEntry.open);

  const beginHistoryStep = useCallback(() => {
    if (historyMarkRef.current) {
      return;
    }

    historyMarkRef.current = editor.markHistoryStep("change color");
    onInteractionStart?.();
  }, [editor, onInteractionStart]);

  const commitHistoryStep = useCallback(() => {
    if (!historyMarkRef.current) {
      return;
    }

    onInteractionEnd?.();
    editor.commitHistoryStep(historyMarkRef.current);
    historyMarkRef.current = null;
  }, [editor, onInteractionEnd]);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        beginHistoryStep();
      } else {
        commitHistoryStep();
      }

      openStateEntry.open = nextOpen;
      setOpenState(nextOpen);
    },
    [beginHistoryStep, commitHistoryStep, openStateEntry]
  );

  useEffect(() => {
    setHexDraftValue(getHexDraftValue(value));
    setOpacityDraftValue(getOpacityDraftValue(value));
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
      commitHistoryStep();

      openStateEntry.resetTimeoutId = window.setTimeout(() => {
        openStateEntry.open = false;
        openStateEntry.resetTimeoutId = null;
      }, 0);
    };
  }, [commitHistoryStep, openStateEntry]);

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
  }, [open, setOpen]);

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
        document.removeEventListener(
          "pointerup",
          handleSuppressedPointerUp,
          true
        );
        return;
      }

      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
      pointerEvent.stopImmediatePropagation();
      document.removeEventListener(
        "pointerup",
        handleSuppressedPointerUp,
        true
      );
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
      window.removeEventListener(
        "pointercancel",
        handlePointerInteractionEnd,
        true
      );
      window.removeEventListener(
        "pointerup",
        handlePointerInteractionEnd,
        true
      );
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
        <ColorValueTrigger
          hexDraftValue={hexDraftValue}
          onChange={onChange}
          opacityDraftValue={opacityDraftValue}
          placeholder={placeholder}
          setHexDraftValue={setHexDraftValue}
          setOpacityDraftValue={setOpacityDraftValue}
          value={value}
        />
        <Popover.Portal>
          <Popover.Positioner
            align="start"
            className="z-50"
            side="bottom"
            sideOffset={6}
          >
            <Popover.Popup
              className="w-[19.5rem] origin-(--transform-origin) rounded-2xl border bg-popover p-3 text-popover-foreground shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-150 data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0"
              initialFocus={false}
              onPointerDownCapture={handlePopupPointerDownCapture}
              ref={popupRef}
            >
              <ColorPicker
                className="border-0 p-0 shadow-none"
                defaultValue="#ffffff"
                onValueChange={(_, parsed) =>
                  onChange(formatStorageValue(parsed))
                }
                value={value}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

const ColorValueTrigger = ({
  hexDraftValue,
  onChange,
  opacityDraftValue,
  placeholder,
  setHexDraftValue,
  setOpacityDraftValue,
  value,
}: {
  hexDraftValue: string;
  onChange: (value: string) => void;
  opacityDraftValue: string;
  placeholder?: string;
  setHexDraftValue: (value: string) => void;
  setOpacityDraftValue: (value: string) => void;
  value?: string | null;
}) => {
  const commitHexDraft = (nextHex: string, nextOpacity = opacityDraftValue) => {
    const normalizedValue = formatColorWithOpacity(nextHex, nextOpacity);

    if (!normalizedValue) {
      setHexDraftValue(getHexDraftValue(value));
      return;
    }

    setHexDraftValue(getHexDraftValue(normalizedValue));
    setOpacityDraftValue(getOpacityDraftValue(normalizedValue));
    onChange(normalizedValue);
  };

  const commitOpacityDraft = (nextOpacity: string, nextHex = hexDraftValue) => {
    const normalizedValue = formatColorWithOpacity(nextHex, nextOpacity);

    if (!normalizedValue) {
      setOpacityDraftValue(getOpacityDraftValue(value));
      return;
    }

    setHexDraftValue(getHexDraftValue(normalizedValue));
    setOpacityDraftValue(getOpacityDraftValue(normalizedValue));
    onChange(normalizedValue);
  };

  const handleTextInputPointerDown = (event) => {
    event.stopPropagation();
  };

  const handleTextInputClick = (event) => {
    event.stopPropagation();
  };

  return (
    <Popover.Trigger
      className={cn(
        "relative inline-flex min-h-8.5 min-w-0 flex-1 cursor-pointer items-center rounded-lg border border-[var(--control-border)] bg-[var(--control-surface)] ps-1.5 text-base text-foreground outline-none transition-[border-color,background-color] hover:border-[var(--control-border-hover)] hover:bg-[var(--control-surface-hover)] focus-visible:border-[var(--control-border-focus)] data-popup-open:border-[var(--control-border-focus)] sm:min-h-7.5 sm:text-sm"
      )}
      nativeButton={false}
      render={<div />}
    >
      <span className="relative -ms-px size-5.5 shrink-0 overflow-hidden rounded-full shadow-[0_0_0_1px_rgb(0_0_0_/_0.12)] dark:shadow-[0_0_0_1px_rgb(255_255_255_/_0.14)]">
        <span className="absolute inset-0" style={CHECKERBOARD_STYLE} />
        <span
          className="absolute inset-0"
          style={{
            backgroundColor: value ?? "transparent",
          }}
        />
      </span>
      <input
        aria-label="Hex color"
        className="ms-2 min-w-0 flex-1 cursor-text bg-transparent p-0 outline-none"
        onBlur={(event) => commitHexDraft(event.currentTarget.value)}
        onChange={(event) => {
          const nextHex = trimHashPrefix(event.currentTarget.value);
          setHexDraftValue(nextHex);

          const normalizedValue = formatColorWithOpacity(
            nextHex,
            opacityDraftValue
          );
          if (normalizedValue) {
            onChange(normalizedValue);
          }
        }}
        onClick={handleTextInputClick}
        onFocus={selectInputText}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setHexDraftValue(getHexDraftValue(value));
            event.currentTarget.blur();
          }
        }}
        onPointerDown={handleTextInputPointerDown}
        placeholder={placeholder}
        spellCheck={false}
        value={hexDraftValue}
      />
      <span
        aria-hidden="true"
        className="ms-2 w-px self-stretch bg-[var(--control-border-hover)]"
      />
      <span className="flex shrink-0 items-center gap-1 px-2">
        <input
          aria-label="Color opacity"
          className="w-[3ch] cursor-text bg-transparent p-0 text-right tabular-nums outline-none"
          inputMode="numeric"
          onBlur={(event) => commitOpacityDraft(event.currentTarget.value)}
          onChange={(event) => {
            const nextOpacity = event.currentTarget.value.replace("%", "");
            setOpacityDraftValue(nextOpacity);

            const normalizedValue = formatColorWithOpacity(
              hexDraftValue,
              nextOpacity
            );
            if (normalizedValue) {
              onChange(normalizedValue);
            }
          }}
          onClick={handleTextInputClick}
          onFocus={selectInputText}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setOpacityDraftValue(getOpacityDraftValue(value));
              event.currentTarget.blur();
            }
          }}
          onPointerDown={handleTextInputPointerDown}
          value={opacityDraftValue}
        />
        <span className="select-none text-muted-foreground">%</span>
      </span>
    </Popover.Trigger>
  );
};

export { ColorPickerField };
