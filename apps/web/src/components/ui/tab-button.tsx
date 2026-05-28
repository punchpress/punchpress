import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TabButton = ({
  active,
  children,
  className,
  closable,
  dirty,
  onClose,
  onSelect,
  title,
}) => {
  return (
    <div
      className={cn("group relative h-8 max-w-44 shrink-0 sm:h-7", className)}
    >
      <Button
        className="h-full w-full min-w-0 justify-start"
        onClick={onSelect}
        size="sm"
        title={title}
        variant={active ? "secondary" : "ghost"}
      >
        <span className="grid size-4 shrink-0 place-items-center">
          <span
            className={cn(
              "size-1.5 rounded-full bg-muted-foreground/40",
              dirty && "bg-primary",
              closable && "group-hover:opacity-0"
            )}
          />
        </span>
        <span className="truncate">{children}</span>
      </Button>

      {closable ? (
        <Button
          aria-label={`Close ${title}`}
          className="absolute top-1/2 left-[5px] z-10 -translate-y-1/2 opacity-0 pointer-coarse:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
          size="icon-xs"
          variant="ghost"
        >
          <XIcon className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
};
