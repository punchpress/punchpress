import { Separator as BaseSeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "@/lib/utils";

const SeparatorPrimitive = BaseSeparatorPrimitive;

function Separator({ className, orientation = "horizontal", ...props }) {
  return (
    <BaseSeparatorPrimitive
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
        className
      )}
      data-slot="separator"
      orientation={orientation}
      {...props}
    />
  );
}

export { Separator, SeparatorPrimitive };
