"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-[border-color,background-color] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:border-ring disabled:pointer-events-none disabled:opacity-64 sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "chrome",
      variant: "default",
    },
    variants: {
      size: {
        // `chrome` sizes follow the chrome tokens in global.css: menus,
        // dialogs, popovers, and panel headers.
        chrome:
          "text-(length:--chrome-text) sm:text-(length:--chrome-text) h-(--menu-item-height) gap-1.5 rounded-(--chrome-radius) px-(--menu-item-px) [&_svg:not([class*='size-'])]:size-(--chrome-icon) sm:[&_svg:not([class*='size-'])]:size-(--chrome-icon)",
        // `field` sizes follow the density tokens in global.css.
        field:
          "text-(length:--field-text) sm:text-(length:--field-text) h-(--field-height) gap-1 rounded-(--field-radius) px-(--field-px) [&_svg:not([class*='size-'])]:size-3.5 sm:[&_svg:not([class*='size-'])]:size-3.5",
        // Text actions that sit beside `icon-toolbar` buttons.
        toolbar:
          "text-(length:--chrome-text) sm:text-(length:--chrome-text) h-(--toolbar-button) gap-1.5 rounded-(--chrome-radius) px-(--menu-item-px) [&_svg:not([class*='size-'])]:size-(--chrome-icon) sm:[&_svg:not([class*='size-'])]:size-(--chrome-icon)",
        "icon-chrome":
          "size-(--menu-item-height) rounded-(--chrome-radius) [&_svg:not([class*='size-'])]:size-(--chrome-icon) sm:[&_svg:not([class*='size-'])]:size-(--chrome-icon)",
        "icon-field":
          "size-(--field-icon-button) rounded-(--field-radius) [&_svg:not([class*='size-'])]:size-3.5 sm:[&_svg:not([class*='size-'])]:size-3.5",
        "icon-toolbar":
          "size-(--toolbar-button) rounded-(--chrome-radius) [&_svg:not([class*='size-'])]:size-(--toolbar-icon) sm:[&_svg:not([class*='size-'])]:size-(--toolbar-icon)",
      },
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:bg-primary/90 data-pressed:bg-primary/90",
        "destructive-outline":
          "border-transparent bg-muted text-destructive-foreground hover:bg-destructive/4 data-pressed:bg-destructive/4 dark:bg-input/32",
        "destructive-soft":
          "border-destructive/18 bg-destructive/8 text-destructive-foreground hover:border-destructive/26 hover:bg-destructive/12 data-pressed:border-destructive/26 data-pressed:bg-destructive/12 dark:border-destructive/30 dark:bg-destructive/14 dark:data-pressed:bg-destructive/18 dark:hover:bg-destructive/18",
        ghost:
          "border-transparent text-foreground hover:bg-accent data-pressed:bg-accent",
        outline:
          "border-transparent bg-muted text-foreground hover:bg-accent data-pressed:bg-accent dark:bg-input/32 dark:data-pressed:bg-input/64 dark:hover:bg-input/64",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 data-pressed:bg-secondary/90 [:active,[data-pressed]]:bg-secondary/80",
      },
    },
  }
);

function Button({ className, variant, size, render, ...props }) {
  const typeValue = render ? undefined : "button";

  const defaultProps = {
    className: cn(buttonVariants({ className, size, variant })),
    "data-slot": "button",
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps(defaultProps, props),
    render,
  });
}

export { Button, buttonVariants };
