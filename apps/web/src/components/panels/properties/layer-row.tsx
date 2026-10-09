import { HugeiconsIcon } from "@hugeicons/react";
import {
  DragDropVerticalIcon,
  SlidersHorizontalIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FieldLabelsProvider } from "./field-layout";

// Shared chrome for stacked layer rows (fills, strokes, effects):
// <LayerRow.Root>
//   <LayerRow.Header>
//     <LayerRow.DragHandle /> ...visibility, swatch...
//     <LayerRow.Settings title="Stroke">{details}</LayerRow.Settings>
//     ...remove...
//   </LayerRow.Header>
//   <LayerRow.Fields>{always-visible fields}</LayerRow.Fields>
// </LayerRow.Root>
// Secondary settings (paint kind, stroke style, shadow offsets) live in the
// Settings popover so each row stays one line.
const LayerRowRoot = ({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div className={cn("grid gap-(--field-gap)", className)} {...props}>
      {children}
    </div>
  );
};

const LayerRowHeader = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex min-w-0 items-center gap-1">{children}</div>;
};

const LayerRowDragHandle = (props: React.ComponentProps<"button">) => {
  return (
    <button
      className="flex w-(--field-handle-width) shrink-0 cursor-grab items-center justify-center text-foreground/40"
      type="button"
      {...props}
    >
      <HugeiconsIcon icon={DragDropVerticalIcon} size={14} />
    </button>
  );
};

// Fields indented under the swatch, past the handle and visibility toggle.
const LayerRowFields = ({ children }: { children?: React.ReactNode }) => {
  return children ? (
    <div className="grid gap-(--field-gap) ps-[calc(var(--field-handle-width)+var(--field-icon-button)+0.5rem)]">
      {children}
    </div>
  ) : null;
};

const LayerRowSettings = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => {
  // Opens beside the panel, level with the row, the way a docked inspector
  // hands off to a flyout.
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const anchor = useMemo(() => {
    return trigger
      ? {
          getBoundingClientRect: () => {
            const row = trigger.getBoundingClientRect();
            const panel = trigger
              .closest("[data-properties-panel]")
              ?.getBoundingClientRect();

            return panel
              ? new DOMRect(panel.left, row.top, panel.width, row.height)
              : row;
          },
        }
      : undefined;
  }, [trigger]);

  return (
    <Popover>
      <PopoverTrigger
        ref={setTrigger}
        render={
          <Button
            aria-label={`${title} settings`}
            size="icon-field"
            variant="ghost"
          />
        }
      >
        <HugeiconsIcon
          icon={SlidersHorizontalIcon}
          size={14}
          strokeWidth={1.8}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        anchor={anchor}
        className="max-h-(--available-height) w-64 overflow-y-auto p-3 [--field-label-width:56px]"
        side="left"
        sideOffset={8}
      >
        <FieldLabelsProvider labels="left">
          <div className="grid gap-(--field-gap)">
            <PopoverTitle className="text-(length:--section-title-text) mb-1">
              {title}
            </PopoverTitle>
            {children}
          </div>
        </FieldLabelsProvider>
      </PopoverContent>
    </Popover>
  );
};

export const LayerRow = {
  DragHandle: LayerRowDragHandle,
  Fields: LayerRowFields,
  Header: LayerRowHeader,
  Root: LayerRowRoot,
  Settings: LayerRowSettings,
};
