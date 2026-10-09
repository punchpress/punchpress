"use client";

import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent font-medium text-base text-foreground outline-none transition-[border-color,background-color] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent focus-visible:border-ring disabled:pointer-events-none disabled:opacity-64 data-pressed:bg-input/64 data-pressed:text-accent-foreground sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "field",
    },
    variants: {
      size: {
        // `field` sizes follow the field tokens in global.css.
        field:
          "text-(length:--field-text) sm:text-(length:--field-text) h-(--field-height) min-w-(--field-height) rounded-(--field-radius) px-(--field-px) before:rounded-[calc(var(--field-radius)-1px)]",
        "icon-field":
          "size-(--field-icon-button) min-w-(--field-icon-button) rounded-(--field-radius) p-0 before:rounded-[calc(var(--field-radius)-1px)] [&_svg:not([class*='size-'])]:size-3.5 sm:[&_svg:not([class*='size-'])]:size-3.5",
        "icon-toolbar":
          "size-(--toolbar-button) min-w-(--toolbar-button) rounded-(--chrome-radius) p-0 before:rounded-[calc(var(--chrome-radius)-1px)] [&_svg:not([class*='size-'])]:size-(--toolbar-icon) sm:[&_svg:not([class*='size-'])]:size-(--toolbar-icon)",
      },
    },
  }
);

function Toggle({ className, size, ...props }) {
  return (
    <BaseToggle
      className={cn(toggleVariants({ className, size }))}
      data-slot="toggle"
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
