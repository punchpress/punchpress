"use client";

import { Toolbar as BaseToolbarPrimitive } from "@base-ui/react/toolbar";

import { cn } from "@/lib/utils";

const ToolbarPrimitive = BaseToolbarPrimitive;

function Toolbar({ className, ...props }) {
  return (
    <BaseToolbarPrimitive.Root
      className={cn(
        "relative flex items-center gap-(--toolbar-pad) rounded-(--toolbar-radius) border bg-card not-dark:bg-clip-padding p-(--toolbar-pad) text-card-foreground",
        className
      )}
      data-slot="toolbar"
      {...props}
    />
  );
}

function ToolbarButton({ className, ...props }) {
  return (
    <BaseToolbarPrimitive.Button
      className={cn(className)}
      data-slot="toolbar-button"
      {...props}
    />
  );
}

function ToolbarLink({ className, ...props }) {
  return (
    <BaseToolbarPrimitive.Link
      className={cn(className)}
      data-slot="toolbar-link"
      {...props}
    />
  );
}

function ToolbarInput({ className, ...props }) {
  return (
    <BaseToolbarPrimitive.Input
      className={cn(className)}
      data-slot="toolbar-input"
      {...props}
    />
  );
}

function ToolbarGroup({ className, ...props }) {
  return (
    <BaseToolbarPrimitive.Group
      className={cn("flex items-center gap-px", className)}
      data-slot="toolbar-group"
      {...props}
    />
  );
}

function ToolbarSeparator({ className, ...props }) {
  return (
    <BaseToolbarPrimitive.Separator
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:my-(--toolbar-pad) data-[orientation=vertical]:my-(--toolbar-pad) data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
        className
      )}
      data-slot="toolbar-separator"
      {...props}
    />
  );
}

export {
  Toolbar,
  ToolbarButton,
  ToolbarInput,
  ToolbarGroup,
  ToolbarLink,
  ToolbarSeparator,
  ToolbarPrimitive,
};
