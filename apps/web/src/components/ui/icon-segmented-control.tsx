"use client";

import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";

import { cn } from "@/lib/utils";

function IconSegmentedControl({ className, variant = "filled", ...props }) {
  return (
    <BaseToggleGroup
      className={cn(
        "grid gap-0.5 rounded-xl p-0.5",
        variant === "filled" && "bg-muted/55",
        className
      )}
      data-slot="icon-segmented-control"
      {...props}
    />
  );
}

function IconSegmentedControlItem({ className, ...props }) {
  return (
    <BaseToggle
      className={cn(
        "inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-lg border border-transparent p-0 text-foreground outline-none transition-[border-color,background-color] hover:bg-accent focus-visible:border-ring disabled:pointer-events-none disabled:opacity-64 data-pressed:bg-muted dark:data-pressed:bg-input/32 dark:hover:bg-input/64 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg]:pointer-events-none [&_svg]:size-5.5 [&_svg]:shrink-0",
        className
      )}
      data-slot="icon-segmented-control-item"
      {...props}
    />
  );
}

export { IconSegmentedControl, IconSegmentedControlItem };
