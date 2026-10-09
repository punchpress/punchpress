import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared anatomy for layer rows, contour rows, and the drag ghost:
// <LayerTreeRowParts.Root depth state>
//   <LayerTreeRowParts.Disclosure /> or <LayerTreeRowParts.Spacer />
//   <LayerTreeRowParts.Icon>{node icon}</LayerTreeRowParts.Icon>
//   <LayerTreeRowParts.Label>{name}</LayerTreeRowParts.Label>
//   <LayerTreeRowParts.Action /> trailing affordances
// </LayerTreeRowParts.Root>
// Root publishes its state as data attributes so parts tone themselves.
type LayerRowState = "hovered" | "idle" | "selected";

const LayerTreeRowRoot = ({
  className,
  depth = 0,
  muted = false,
  state = "idle",
  style,
  ...props
}: React.ComponentProps<"div"> & {
  depth?: number;
  muted?: boolean;
  state?: LayerRowState;
}) => {
  return (
    <div
      className={cn(
        "group/layer-row text-(length:--chrome-text-sm) box-border flex h-(--layer-row-height) w-full min-w-0 items-center gap-1 overflow-hidden rounded-(--chrome-radius) pe-[calc((var(--layer-row-height)-var(--field-icon-button))/2)]",
        state === "selected" && "bg-(--canvas-selected) text-white",
        state === "hovered" && "bg-(--surface-hover)",
        className
      )}
      data-layer-depth={depth}
      data-muted={muted && state !== "selected" ? "" : undefined}
      data-selected={state === "selected" ? "" : undefined}
      style={{
        paddingInlineStart: `calc(var(--field-gap) + ${depth} * var(--layer-indent))`,
        ...style,
      }}
      {...props}
    />
  );
};

const LayerTreeRowDisclosure = ({
  expanded,
  ...props
}: React.ComponentProps<"button"> & { expanded: boolean }) => {
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <button
      aria-label={expanded ? "Collapse container" : "Expand container"}
      className="inline-flex h-full w-(--layer-indent) shrink-0 items-center justify-center text-muted-foreground outline-none group-data-selected/layer-row:text-white/72"
      type="button"
      {...props}
    >
      <Chevron className="size-3" strokeWidth={2} />
    </button>
  );
};

// Holds the disclosure column on rows without children so icons align.
const LayerTreeRowSpacer = ({ className }: { className?: string }) => {
  return (
    <span
      aria-hidden="true"
      className={cn("w-(--layer-indent) shrink-0", className)}
    />
  );
};

const LayerTreeRowIcon = ({
  className,
  ...props
}: React.ComponentProps<"span">) => {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-(--layer-icon) shrink-0 items-center justify-center text-foreground/58 group-data-muted/layer-row:text-foreground/34 group-data-selected/layer-row:text-white/78",
        className
      )}
      {...props}
    />
  );
};

const LayerTreeRowLabel = ({
  className,
  ...props
}: React.ComponentProps<"span">) => {
  return (
    <span
      className={cn(
        "min-w-0 truncate whitespace-nowrap font-[450] group-data-muted/layer-row:text-foreground/55",
        className
      )}
      {...props}
    />
  );
};

// Trailing affordance (visibility). Shows on row hover, keyboard focus, or
// when `pinned` because its value is non-default.
const LayerTreeRowAction = ({
  className,
  pinned = false,
  ...props
}: React.ComponentProps<typeof Button> & { pinned?: boolean }) => {
  return (
    <Button
      className={cn(
        "ms-auto text-foreground/42 hover:text-foreground group-data-selected/layer-row:text-white/72 group-data-selected/layer-row:hover:bg-white/16 group-data-selected/layer-row:hover:text-white",
        !pinned &&
          "opacity-0 focus-visible:opacity-100 group-hover/layer-row:opacity-100",
        className
      )}
      size="icon-field"
      tabIndex={-1}
      type="button"
      variant="ghost"
      {...props}
    />
  );
};

export const LayerTreeRowParts = {
  Action: LayerTreeRowAction,
  Disclosure: LayerTreeRowDisclosure,
  Icon: LayerTreeRowIcon,
  Label: LayerTreeRowLabel,
  Root: LayerTreeRowRoot,
  Spacer: LayerTreeRowSpacer,
};
