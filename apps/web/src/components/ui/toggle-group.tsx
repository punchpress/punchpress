"use client";

import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";

import { cn } from "@/lib/utils";
import { toggleVariants } from "./toggle";

function ToggleGroup({ className, ...props }) {
  return (
    <BaseToggleGroup
      className={cn("flex items-center gap-1", className)}
      data-slot="toggle-group"
      {...props}
    />
  );
}

function Toggle({ className, variant, size, ...props }) {
  return (
    <BaseToggle
      className={cn(toggleVariants({ className, size, variant }))}
      data-slot="toggle"
      {...props}
    />
  );
}

export { Toggle, ToggleGroup };
