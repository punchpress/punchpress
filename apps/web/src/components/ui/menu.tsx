"use client";

import { Menu as BaseMenuPrimitive } from "@base-ui/react/menu";
import {
  ArrowBigUpDashIcon,
  CheckIcon,
  ChevronRightIcon,
  CommandIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const MenuPrimitive = BaseMenuPrimitive;

// Shared by `Menu` and `ContextMenu` so both read the chrome tokens in
// global.css: 24px rows, 12px text, 14px icons, 4px item radius.
const menuPopupClassName =
  "relative flex not-[class*='w-']:min-w-(--menu-min-width) origin-(--transform-origin) rounded-(--menu-radius) border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--menu-radius)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]";

const menuViewportClassName =
  "max-h-(--available-height) w-full overflow-y-auto p-(--menu-pad)";

const menuRowClassName =
  "text-(length:--chrome-text) min-h-(--menu-item-height) cursor-default select-none items-center gap-2 rounded-(--chrome-radius) py-0.5 text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64";

// Inset rows start where an icon row's label starts.
const menuInsetClassName =
  "data-inset:ps-[calc(var(--menu-item-px)+var(--chrome-icon)+--spacing(2))]";

const menuItemClassName = cn(
  menuRowClassName,
  menuInsetClassName,
  "flex px-(--menu-item-px) data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive-foreground data-[variant=destructive]:text-destructive-foreground [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-(--chrome-icon) [&>svg]:pointer-events-none [&>svg]:shrink-0"
);

const menuSubTriggerClassName = cn(
  menuItemClassName,
  "data-popup-open:bg-accent data-popup-open:text-accent-foreground"
);

const menuCheckableItemClassName = cn(
  menuRowClassName,
  "grid in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] ps-(--menu-item-px) [&_svg:not([class*='size-'])]:size-(--chrome-icon) [&_svg]:pointer-events-none [&_svg]:shrink-0"
);

const menuIndicatorColumnsClassName =
  "grid-cols-[var(--chrome-icon)_1fr] pe-[calc(var(--menu-item-px)*2)]";

const menuGroupLabelClassName = cn(
  menuInsetClassName,
  "text-(length:--section-title-text) flex h-(--menu-item-height) items-center px-(--menu-item-px) font-semibold text-(--section-title-color) tracking-(--section-title-tracking) [text-transform:var(--section-title-case)]"
);

const menuSeparatorClassName =
  "mx-(--menu-item-px) my-(--menu-pad) h-px bg-border";

const menuShortcutClassName =
  "text-(length:--chrome-text-sm) ms-auto inline-flex items-center gap-0.5 ps-4 text-muted-foreground leading-none";

const MenuCreateHandle = BaseMenuPrimitive.createHandle;

const Menu = BaseMenuPrimitive.Root;

const MenuPortal = BaseMenuPrimitive.Portal;

function MenuTrigger({ className, children, ...props }) {
  return (
    <BaseMenuPrimitive.Trigger
      className={className}
      data-slot="menu-trigger"
      {...props}
    >
      {children}
    </BaseMenuPrimitive.Trigger>
  );
}

function MenuPopup({
  children,
  className,
  sideOffset = 4,
  align = "center",
  alignOffset,
  side = "bottom",
  anchor,
  ...props
}) {
  return (
    <BaseMenuPrimitive.Portal>
      <BaseMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50"
        data-slot="menu-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <BaseMenuPrimitive.Popup
          className={cn(menuPopupClassName, className)}
          data-slot="menu-popup"
          {...props}
        >
          <div className={menuViewportClassName}>{children}</div>
        </BaseMenuPrimitive.Popup>
      </BaseMenuPrimitive.Positioner>
    </BaseMenuPrimitive.Portal>
  );
}

function MenuGroup(props) {
  return <BaseMenuPrimitive.Group data-slot="menu-group" {...props} />;
}

function MenuItem({ className, inset, variant = "default", ...props }) {
  return (
    <BaseMenuPrimitive.Item
      className={cn(menuItemClassName, className)}
      data-inset={inset}
      data-slot="menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

function MenuCheckboxItem({
  className,
  children,
  checked,
  variant = "default",
  ...props
}) {
  return (
    <BaseMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        menuCheckableItemClassName,
        variant === "switch"
          ? "grid-cols-[1fr_auto] gap-4 pe-(--menu-item-px)"
          : menuIndicatorColumnsClassName,
        className
      )}
      data-slot="menu-checkbox-item"
      {...props}
    >
      {variant === "switch" ? (
        <>
          <span className="col-start-1">{children}</span>
          <BaseMenuPrimitive.CheckboxItemIndicator
            className="inset-shadow-[0_1px_--theme(--color-black/4%)] inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(3)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64"
            keepMounted
          >
            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s]" />
          </BaseMenuPrimitive.CheckboxItemIndicator>
        </>
      ) : (
        <>
          <BaseMenuPrimitive.CheckboxItemIndicator className="col-start-1">
            <CheckIcon aria-hidden="true" />
          </BaseMenuPrimitive.CheckboxItemIndicator>
          <span className="col-start-2">{children}</span>
        </>
      )}
    </BaseMenuPrimitive.CheckboxItem>
  );
}

function MenuRadioGroup(props) {
  return (
    <BaseMenuPrimitive.RadioGroup data-slot="menu-radio-group" {...props} />
  );
}

function MenuRadioItem({ className, children, ...props }) {
  return (
    <BaseMenuPrimitive.RadioItem
      className={cn(
        menuCheckableItemClassName,
        menuIndicatorColumnsClassName,
        className
      )}
      data-slot="menu-radio-item"
      {...props}
    >
      <BaseMenuPrimitive.RadioItemIndicator className="col-start-1">
        <CheckIcon aria-hidden="true" />
      </BaseMenuPrimitive.RadioItemIndicator>
      <span className="col-start-2">{children}</span>
    </BaseMenuPrimitive.RadioItem>
  );
}

function MenuGroupLabel({ className, inset, ...props }) {
  return (
    <BaseMenuPrimitive.GroupLabel
      className={cn(menuGroupLabelClassName, className)}
      data-inset={inset}
      data-slot="menu-label"
      {...props}
    />
  );
}

function MenuSeparator({ className, ...props }) {
  return (
    <BaseMenuPrimitive.Separator
      className={cn(menuSeparatorClassName, className)}
      data-slot="menu-separator"
      {...props}
    />
  );
}

function MenuShortcut({ children, className, ...props }) {
  return (
    <kbd
      className={cn(menuShortcutClassName, className)}
      data-slot="menu-shortcut"
      {...props}
    >
      {typeof children === "string" ? renderMenuShortcut(children) : children}
    </kbd>
  );
}

function MenuSub(props) {
  return <BaseMenuPrimitive.SubmenuRoot data-slot="menu-sub" {...props} />;
}

function MenuSubTrigger({ className, inset, children, ...props }) {
  return (
    <BaseMenuPrimitive.SubmenuTrigger
      className={cn(menuSubTriggerClassName, className)}
      data-inset={inset}
      data-slot="menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon className="ms-auto" />
    </BaseMenuPrimitive.SubmenuTrigger>
  );
}

function MenuSubPopup({
  className,
  sideOffset = 0,
  alignOffset,
  align = "start",
  ...props
}) {
  // Lines the first submenu item up with its trigger: `--menu-pad` (4px) plus
  // the 1px popup border. Base UI takes pixels here, not CSS lengths.
  const defaultAlignOffset = align === "center" ? undefined : -5;

  return (
    <MenuPopup
      align={align}
      alignOffset={alignOffset ?? defaultAlignOffset}
      className={className}
      data-slot="menu-sub-content"
      side="inline-end"
      sideOffset={sideOffset}
      {...props}
    />
  );
}

const renderMenuShortcut = (shortcut) => {
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
          <ArrowBigUpDashIcon className="size-(--chrome-text-sm) stroke-[2.2]" />
        </ShortcutToken>
      );
    }

    if (token === "⌘") {
      return (
        <ShortcutToken key={key} label="Command">
          <CommandIcon className="size-(--chrome-text-sm) stroke-[2.1]" />
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
  MenuCreateHandle,
  MenuCreateHandle as DropdownMenuCreateHandle,
  Menu,
  Menu as DropdownMenu,
  MenuPortal,
  MenuPortal as DropdownMenuPortal,
  MenuTrigger,
  MenuTrigger as DropdownMenuTrigger,
  MenuPopup,
  MenuPopup as DropdownMenuContent,
  MenuGroup,
  MenuGroup as DropdownMenuGroup,
  MenuItem,
  MenuItem as DropdownMenuItem,
  MenuCheckboxItem,
  MenuCheckboxItem as DropdownMenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioGroup as DropdownMenuRadioGroup,
  MenuRadioItem,
  MenuRadioItem as DropdownMenuRadioItem,
  MenuGroupLabel,
  MenuGroupLabel as DropdownMenuLabel,
  MenuSeparator,
  MenuSeparator as DropdownMenuSeparator,
  MenuShortcut,
  MenuShortcut as DropdownMenuShortcut,
  MenuSub,
  MenuSub as DropdownMenuSub,
  MenuSubTrigger,
  MenuSubTrigger as DropdownMenuSubTrigger,
  MenuSubPopup,
  MenuSubPopup as DropdownMenuSubContent,
  MenuPrimitive,
  menuIndicatorColumnsClassName,
  menuCheckableItemClassName,
  menuItemClassName,
  menuPopupClassName,
  menuSeparatorClassName,
  menuShortcutClassName,
  menuSubTriggerClassName,
  menuViewportClassName,
  renderMenuShortcut,
};
