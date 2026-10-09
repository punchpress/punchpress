"use client";

import { cn } from "@/lib/utils";

// Sized to the chrome tokens so it lines up with `chrome` buttons.
export function InputGroup({ className, ...props }) {
  return (
    <div
      className={cn(
        "text-(length:--chrome-text) relative inline-flex h-(--menu-item-height) w-full min-w-0 items-center rounded-(--chrome-radius) border border-[var(--control-border)] bg-[var(--control-surface)] text-foreground transition-[border-color,background-color] hover:border-[var(--control-border-hover)] hover:bg-[var(--control-surface-hover)] has-focus-visible:border-[var(--control-border-focus)] has-disabled:opacity-64",
        className
      )}
      data-slot="input-group"
      {...props}
    />
  );
}

export function InputGroupAddon({ className, ...props }) {
  return (
    <div
      className={cn(
        "pointer-events-none flex shrink-0 items-center ps-(--menu-item-px) pe-1.5 text-muted-foreground [&_svg:not([class*='size-'])]:size-(--chrome-icon)",
        className
      )}
      data-slot="input-group-addon"
      {...props}
    />
  );
}

export function InputGroupInput({ className, ...props }) {
  return (
    <input
      className={cn(
        "h-full min-w-0 flex-1 rounded-[inherit] bg-transparent pe-(--menu-item-px) outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
        className
      )}
      data-slot="input-group-input"
      {...props}
    />
  );
}
