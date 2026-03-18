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
            "relative origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
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

export { Popover, PopoverContent, PopoverTrigger };
