"use client";

import { ContextMenu as BaseContextMenuPrimitive } from "@base-ui/react/context-menu";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { forwardRef } from "react";
import {
  menuCheckableItemClassName,
  menuIndicatorColumnsClassName,
  menuItemClassName,
  menuPopupClassName,
  menuSeparatorClassName,
  menuShortcutClassName,
  menuSubTriggerClassName,
  menuViewportClassName,
  renderMenuShortcut,
} from "@/components/ui/menu";
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
          className={cn(menuPopupClassName, className)}
          data-slot="context-menu-popup"
          {...props}
        >
          <div className={menuViewportClassName}>{children}</div>
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
      className={cn(menuItemClassName, className)}
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
        menuCheckableItemClassName,
        menuIndicatorColumnsClassName,
        className
      )}
      data-slot="context-menu-radio-item"
      {...props}
    >
      <BaseContextMenuPrimitive.RadioItemIndicator className="col-start-1">
        <CheckIcon aria-hidden="true" />
      </BaseContextMenuPrimitive.RadioItemIndicator>
      <span className="col-start-2">{children}</span>
    </BaseContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuSeparator({ className, ...props }) {
  return (
    <BaseContextMenuPrimitive.Separator
      className={cn(menuSeparatorClassName, className)}
      data-slot="context-menu-separator"
      {...props}
    />
  );
}

function ContextMenuShortcut({ children, className, ...props }) {
  return (
    <kbd
      className={cn(menuShortcutClassName, className)}
      data-slot="context-menu-shortcut"
      {...props}
    >
      {typeof children === "string" ? renderMenuShortcut(children) : children}
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
      className={cn(menuSubTriggerClassName, className)}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon className="ms-auto" />
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
          className={cn(menuPopupClassName, className)}
          data-slot="context-menu-sub-popup"
          {...props}
        >
          <div className={menuViewportClassName}>{children}</div>
        </BaseContextMenuPrimitive.Popup>
      </BaseContextMenuPrimitive.Positioner>
    </BaseContextMenuPrimitive.Portal>
  );
}

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
