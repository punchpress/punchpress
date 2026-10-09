import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }) {
  return (
    <kbd
      className={cn(
        "text-(length:--chrome-text-sm) pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded-(--chrome-radius) bg-muted px-1 font-medium font-sans text-muted-foreground [&_svg:not([class*='size-'])]:size-(--chrome-text-sm)",
        className
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

export function KbdGroup({ className, ...props }) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}
