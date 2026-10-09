"use client";

import { Popover as BasePopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

const Popover = BasePopoverPrimitive.Root;
const PopoverTrigger = BasePopoverPrimitive.Trigger;

function PopoverContent({
  align = "center",
  alignOffset,
  anchor,
  children,
  className,
  side = "bottom",
  sideOffset = 4,
  // `flush` drops the padding for popups with edge-to-edge sections.
  variant = "default",
  ...props
}) {
  return (
    <BasePopoverPrimitive.Portal>
      <BasePopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50"
        data-slot="popover-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <BasePopoverPrimitive.Popup
          className={cn(
            "text-(length:--chrome-text) relative origin-(--transform-origin) rounded-(--surface-radius) border bg-popover not-dark:bg-clip-padding p-(--popover-pad) text-popover-foreground shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--surface-radius)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            variant === "flush" && "p-0",
            className
          )}
          data-slot="popover-popup"
          {...props}
        >
          {children}
        </BasePopoverPrimitive.Popup>
      </BasePopoverPrimitive.Positioner>
    </BasePopoverPrimitive.Portal>
  );
}

function PopoverTitle({ className, ...props }) {
  return (
    <BasePopoverPrimitive.Title
      className={cn(
        "text-(length:--section-title-text) font-semibold text-(--section-title-color) tracking-(--section-title-tracking) [text-transform:var(--section-title-case)]",
        className
      )}
      data-slot="popover-title"
      {...props}
    />
  );
}

export { Popover, PopoverContent, PopoverTitle, PopoverTrigger };
