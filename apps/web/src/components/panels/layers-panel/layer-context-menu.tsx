import { ContextMenu } from "@base-ui/react/context-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

export const LAYER_SHORTCUTS = {
  duplicate: "\u2318J",
  bringToFront: "]",
  group: "\u2318G",
  sendToBack: "[",
  ungroup: "\u21e7\u2318G",
};

export const LayerGlyph = ({ icon, size = 18, strokeWidth = 1.8 }) => {
  return (
    <HugeiconsIcon
      color="currentColor"
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
    />
  );
};

export const LayerContextMenuPopup = ({
  children,
  className,
  sideOffset = 6,
  align = "start",
  ...props
}) => {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner
        align={align}
        className="z-50"
        sideOffset={sideOffset}
      >
        <ContextMenu.Popup
          className={cn(
            "relative flex min-w-[var(--menu-min-width)] origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className
          )}
          {...props}
        >
          <div className="max-h-(--available-height) w-full overflow-y-auto p-1">
            {children}
          </div>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
};

export const LayerContextMenuItem = ({ className, ...props }) => {
  return (
    <ContextMenu.Item
      className={cn(
        "flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
};

export const LayerContextMenuSeparator = ({ className, ...props }) => {
  return (
    <ContextMenu.Separator
      className={cn("mx-2 my-1 h-px bg-border", className)}
      {...props}
    />
  );
};
