import { cva } from "class-variance-authority";
import { XIcon } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Title bar tabs: flat full-height segments with a hairline divider on both
// sides (neighbors overlap theirs by 1px). The active tab takes the canvas
// background and covers the bar's bottom hairline, so it reads as part of the
// document below. Tokens live in the "Title bar" blocks of styles/global.css.
const tabVariants = cva(
  "group text-(length:--chrome-text) relative flex h-full border-(--tab-divider) border-x",
  {
    defaultVariants: {
      active: false,
      size: "default",
    },
    variants: {
      active: {
        false: "text-(--tab-fg) hover:bg-(--tab-bg-hover)",
        true: "z-[1] bg-(--designer-bg) font-medium text-(--tab-fg-active)",
      },
      size: {
        // Content-fit: padding, title, and the reserved status slot,
        // clamped; overflow shrinks tabs toward the min before scrolling.
        // Text tabs always follow another tab; -ml-px shares the divider.
        default: "-ml-px min-w-(--tab-min-width) max-w-(--tab-max-width)",
        icon: "aspect-square shrink-0",
      },
    },
  }
);

const triggerClassName =
  "flex h-full w-full min-w-0 cursor-pointer items-center outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset";

interface TabState {
  active: boolean;
  dirty: boolean;
}

const TabContext = createContext<TabState>({ active: false, dirty: false });

export const Tab = ({
  active = false,
  children,
  dirty = false,
  size = "default",
}: {
  active?: boolean;
  children: ReactNode;
  dirty?: boolean;
  size?: "default" | "icon";
}) => {
  return (
    <TabContext.Provider value={{ active, dirty }}>
      <div
        className={tabVariants({ active, size })}
        data-active={active || undefined}
        data-dirty={dirty || undefined}
        data-slot="tab"
      >
        {children}
      </div>
    </TabContext.Provider>
  );
};

// A text tab's select target. The right padding reserves the status slot, so
// the title never moves when the slot swaps the dirty dot for the close button.
export const TabTrigger = ({
  children,
  onSelect,
}: {
  children: string;
  onSelect: () => void;
}) => {
  const { active } = useContext(TabContext);

  return (
    <button
      aria-current={active ? "page" : undefined}
      className={cn(
        triggerClassName,
        "pr-[calc(var(--tab-px)+var(--tab-slot)+var(--tab-slot-gap))] pl-(--tab-px)"
      )}
      data-slot="tab-trigger"
      onClick={onSelect}
      title={children}
      type="button"
    >
      <span className="truncate" data-slot="tab-title">
        {children}
      </span>
    </button>
  );
};

// A pinned icon-only tab's select target, labeled by a tooltip.
export const TabIconTrigger = ({
  children,
  label,
  onSelect,
}: {
  children: ReactNode;
  label: string;
  onSelect: () => void;
}) => {
  const { active } = useContext(TabContext);
  const trigger = (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={cn(
        triggerClassName,
        "justify-center [&_svg]:size-(--tab-icon)"
      )}
      data-slot="tab-trigger"
      onClick={onSelect}
      type="button"
    >
      {children}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
};

// The status slot right of the title: the unsaved-changes dot, swapped for
// the close button on hover, keyboard focus, or a clean active tab.
export const TabClose = ({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) => {
  const { active, dirty } = useContext(TabContext);
  const closeAlwaysVisible = active && !dirty;

  return (
    <span
      className="absolute inset-y-0 right-(--tab-px) grid w-(--tab-slot) place-items-center"
      data-slot="tab-status"
    >
      <Button
        aria-label={label}
        className={cn(
          "peer col-start-1 row-start-1 size-(--tab-slot) text-(--tab-fg) hover:bg-(--tab-bg-hover) hover:text-(--tab-fg-active)",
          closeAlwaysVisible
            ? "opacity-100"
            : "opacity-0 pointer-coarse:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
        )}
        data-slot="tab-close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        size="icon-field"
        variant="ghost"
      >
        <XIcon />
      </Button>
      {dirty ? (
        <span
          className={cn(
            "pointer-events-none col-start-1 row-start-1 size-(--tab-dirty-dot) rounded-full pointer-coarse:opacity-0 group-hover:opacity-0 peer-focus-visible:opacity-0",
            active ? "bg-(--tab-dirty-active)" : "bg-(--tab-dirty)"
          )}
          data-slot="tab-dirty-dot"
        />
      ) : null}
    </span>
  );
};
