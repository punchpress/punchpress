"use client";

import { ContextMenu as BaseContextMenuPrimitive } from "@base-ui/react/context-menu";
import {
  ArrowBigUpDashIcon,
  CheckIcon,
  ChevronRightIcon,
  CommandIcon,
} from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const ContextMenuPrimitive = BaseContextMenuPrimitive;

const ContextMenu = BaseContextMenuPrimitive.Root;

const ContextMenuTrigger = forwardRef(function ContextMenuTrigger(
  { className, children, ...props },
  ref
) {
  return (
    <BaseContextMenuPrimitive.Trigger
      className={className}
      data-slot="context-menu-trigger"
      ref={ref}
      {...props}
    >
      {children}
    </BaseContextMenuPrimitive.Trigger>
  );
});

function ContextMenuPopup({
  children,
  className,
  sideOffset = 6,
  align = "start",
  ...props
}) {
  return (
    <BaseContextMenuPrimitive.Portal>
      <BaseContextMenuPrimitive.Positioner
        align={align}
        className="z-50"
        data-slot="context-menu-positioner"
        sideOffset={sideOffset}
      >
        <BaseContextMenuPrimitive.Popup
          className={cn(
            "relative flex not-[class*='w-']:min-w-[var(--menu-min-width)] origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className
          )}
          data-slot="context-menu-popup"
          {...props}
        >
          <div className="max-h-(--available-height) w-full overflow-y-auto p-1">
            {children}
          </div>
        </BaseContextMenuPrimitive.Popup>
      </BaseContextMenuPrimitive.Positioner>
    </BaseContextMenuPrimitive.Portal>
  );
}

function ContextMenuGroup(props) {
  return (
    <BaseContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  );
}

function ContextMenuItem({ className, inset, variant = "default", ...props }) {
  return (
    <BaseContextMenuPrimitive.Item
      className={cn(
        "flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:ps-8 data-[variant=destructive]:text-destructive-foreground data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

function ContextMenuRadioGroup(props) {
  return (
    <BaseContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  );
}

function ContextMenuRadioItem({ className, children, ...props }) {
  return (
    <BaseContextMenuPrimitive.RadioItem
      className={cn(
        "grid min-h-8 cursor-default grid-cols-[.75rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="context-menu-radio-item"
      {...props}
    >
      <BaseContextMenuPrimitive.RadioItemIndicator className="col-start-1 -ms-0.5">
        <CheckIcon aria-hidden="true" className="size-4.5 sm:size-4" />
      </BaseContextMenuPrimitive.RadioItemIndicator>
      <span className="col-start-2">{children}</span>
    </BaseContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuSeparator({ className, ...props }) {
  return (
    <BaseContextMenuPrimitive.Separator
      className={cn("mx-2 my-1 h-px bg-border", className)}
      data-slot="context-menu-separator"
      {...props}
    />
  );
}

function ContextMenuShortcut({ children, className, ...props }) {
  return (
    <kbd
      className={cn(
        "ms-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground/78 leading-none",
        className
      )}
      data-slot="context-menu-shortcut"
      {...props}
    >
      {typeof children === "string" ? renderShortcut(children) : children}
    </kbd>
  );
}

function ContextMenuSub(props) {
  return (
    <BaseContextMenuPrimitive.SubmenuRoot
      data-slot="context-menu-sub"
      {...props}
    />
  );
}

function ContextMenuSubTrigger({ className, inset, children, ...props }) {
  return (
    <BaseContextMenuPrimitive.SubmenuTrigger
      className={cn(
        "flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-popup-open:bg-accent data-inset:ps-8 data-highlighted:text-accent-foreground data-popup-open:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon className="ms-auto -me-0.5 opacity-80" />
    </BaseContextMenuPrimitive.SubmenuTrigger>
  );
}

function ContextMenuSubPopup({
  children,
  className,
  sideOffset = 0,
  align = "start",
  ...props
}) {
  return (
    <BaseContextMenuPrimitive.Portal>
      <BaseContextMenuPrimitive.Positioner
        align={align}
        className="z-50"
        data-slot="context-menu-sub-positioner"
        side="inline-end"
        sideOffset={sideOffset}
      >
        <BaseContextMenuPrimitive.Popup
          className={cn(
            "relative flex not-[class*='w-']:min-w-[var(--menu-min-width)] origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className
          )}
          data-slot="context-menu-sub-popup"
          {...props}
        >
          <div className="max-h-(--available-height) w-full overflow-y-auto p-1">
            {children}
          </div>
        </BaseContextMenuPrimitive.Popup>
      </BaseContextMenuPrimitive.Positioner>
    </BaseContextMenuPrimitive.Portal>
  );
}

const renderShortcut = (shortcut) => {
  const tokenCounts = new Map();

  return Array.from(shortcut).map((token) => {
    if (token === " ") {
      return null;
    }

    const occurrence = tokenCounts.get(token) ?? 0;
    tokenCounts.set(token, occurrence + 1);
    const key = `${token}-${occurrence}`;

    if (token === "⇧") {
      return (
        <ShortcutToken key={key} label="Shift">
          <ArrowBigUpDashIcon className="size-[11px] stroke-[2.2]" />
        </ShortcutToken>
      );
    }

    if (token === "⌘") {
      return (
        <ShortcutToken key={key} label="Command">
          <CommandIcon className="size-[11px] stroke-[2.1]" />
        </ShortcutToken>
      );
    }

    return (
      <span
        className="inline-flex min-w-[0.6rem] items-center justify-center font-medium font-sans uppercase"
        key={key}
      >
        {token}
      </span>
    );
  });
};

const ShortcutToken = ({ children, label }) => {
  return (
    <span
      aria-label={label}
      className="inline-flex min-w-[0.7rem] items-center justify-center"
      role="img"
    >
      {children}
    </span>
  );
};

export {
  ContextMenuPrimitive,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuPopup,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubPopup,
};
