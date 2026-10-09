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
      className={cn(
        "group relative flex h-(--tab-height) max-w-44 shrink-0",
        className
      )}
    >
      <Button
        className={cn(
          "h-full w-full min-w-0 justify-start sm:h-full",
          active
            ? "bg-(--workspace-tab-bg-active) text-(--workspace-tab-text-active) hover:bg-(--workspace-tab-bg-active)"
            : "bg-(--workspace-tab-bg) text-(--workspace-tab-text) hover:bg-(--workspace-tab-bg-hover)"
        )}
        onClick={onSelect}
        size="chrome"
        title={title}
        variant="ghost"
      >
        <span className="grid size-(--chrome-icon) shrink-0 place-items-center">
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
          // Centers the close button over the status dot slot.
          className="absolute top-1/2 left-[calc(var(--menu-item-px)+(var(--chrome-icon)-var(--field-icon-button))/2)] z-10 -translate-y-1/2 opacity-0 pointer-coarse:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
          size="icon-field"
          variant="ghost"
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
};
