"use client";

import { cn } from "@/lib/utils";

export function InputGroup({ className, ...props }) {
  return (
    <div
      className={cn(
        "relative inline-flex h-8.5 w-full min-w-0 items-center rounded-lg border border-[var(--control-border)] bg-[var(--control-surface)] text-base text-foreground transition-[border-color,background-color] hover:border-[var(--control-border-hover)] hover:bg-[var(--control-surface-hover)] has-focus-visible:border-[var(--control-border-focus)] has-disabled:opacity-64 sm:h-7.5 sm:text-sm",
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
        "pointer-events-none flex shrink-0 items-center ps-[calc(--spacing(3)-1px)] pe-2 text-muted-foreground [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4",
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
        "h-full min-w-0 flex-1 rounded-[inherit] bg-transparent pe-[calc(--spacing(3)-1px)] leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground sm:leading-7.5 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
        className
      )}
      data-slot="input-group-input"
      {...props}
    />
  );
}
