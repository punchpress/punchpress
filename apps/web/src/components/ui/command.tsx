"use client";

import { Dialog as BaseCommandDialogPrimitive } from "@base-ui/react/dialog";
import { SearchIcon } from "lucide-react";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteSeparator,
} from "@/components/ui/autocomplete";
import { cn } from "@/lib/utils";

const CommandDialogPrimitive = BaseCommandDialogPrimitive;

export const CommandDialog = CommandDialogPrimitive.Root;
export const CommandDialogPortal = CommandDialogPrimitive.Portal;
export const CommandCreateHandle = CommandDialogPrimitive.createHandle;

export function CommandDialogTrigger(props) {
  return (
    <CommandDialogPrimitive.Trigger
      data-slot="command-dialog-trigger"
      {...props}
    />
  );
}

export function CommandDialogBackdrop({ className, ...props }) {
  return (
    <CommandDialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      data-slot="command-dialog-backdrop"
      {...props}
    />
  );
}

export function CommandDialogViewport({ className, ...props }) {
  return (
    <CommandDialogPrimitive.Viewport
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center px-4 py-[max(--spacing(4),4vh)] sm:py-[8vh]",
        className
      )}
      data-slot="command-dialog-viewport"
      {...props}
    />
  );
}

export function CommandDialogPopup({
  className,
  children,
  portalProps,
  ...props
}) {
  return (
    <CommandDialogPortal {...portalProps}>
      <CommandDialogBackdrop />
      <CommandDialogViewport>
        <CommandDialogPrimitive.Popup
          className={cn(
            "relative row-start-2 flex max-h-[min(760px,calc(100vh-64px))] min-h-0 w-full min-w-0 max-w-4xl -translate-y-[calc(1.25rem*var(--nested-dialogs))] scale-[calc(1-0.1*var(--nested-dialogs))] flex-col rounded-2xl border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-0.1*var(--nested-dialogs))] shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:bg-muted/72 before:shadow-[0_1px_--theme(--color-black/4%)] data-nested:data-ending-style:translate-y-8 data-nested:data-starting-style:translate-y-8 data-nested-dialog-open:origin-top data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 **:data-[slot=scroll-area-viewport]:data-has-overflow-y:pe-1 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className
          )}
          data-slot="command-dialog-popup"
          {...props}
        >
          {children}
        </CommandDialogPrimitive.Popup>
      </CommandDialogViewport>
    </CommandDialogPortal>
  );
}

export function Command({
  autoHighlight = "always",
  keepHighlight = true,
  ...props
}) {
  return (
    <Autocomplete
      autoHighlight={autoHighlight}
      inline
      keepHighlight={keepHighlight}
      open
      {...props}
    />
  );
}

export function CommandInput({ className, placeholder, ...props }) {
  return (
    <div className="px-2.5 py-1.5">
      <AutocompleteInput
        autoFocus
        className={cn(
          "border-transparent! bg-transparent! shadow-none before:hidden has-focus-visible:ring-0",
          className
        )}
        placeholder={placeholder}
        size="lg"
        startAddon={<SearchIcon />}
        {...props}
      />
    </div>
  );
}

export function CommandList(props) {
  return <AutocompleteList {...props} />;
}

export function CommandEmpty({ className, ...props }) {
  return (
    <AutocompleteEmpty className={cn("not-empty:p-4", className)} {...props} />
  );
}

export function CommandPanel({ className, ...props }) {
  return (
    <div
      className={cn(
        "relative z-10 min-h-0 flex-1 border-border border-t",
        className
      )}
      data-slot="command-panel"
      {...props}
    />
  );
}

export function CommandGroup(props) {
  return <AutocompleteGroup {...props} />;
}

export function CommandGroupLabel(props) {
  return <AutocompleteGroupLabel {...props} />;
}

export function CommandCollection(props) {
  return <AutocompleteCollection {...props} />;
}

export function CommandItem({ className, ...props }) {
  return (
    <AutocompleteItem
      className={cn(
        "gap-3 rounded-lg px-3 py-2 data-highlighted:bg-muted sm:min-h-9",
        className
      )}
      {...props}
    />
  );
}

export function CommandSeparator(props) {
  return <AutocompleteSeparator {...props} />;
}

export function CommandShortcut({ className, ...props }) {
  return (
    <span
      className={cn("ms-auto text-muted-foreground text-xs", className)}
      data-slot="command-shortcut"
      {...props}
    />
  );
}

export function CommandFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "relative z-10 flex min-h-11 items-center justify-between gap-3 border-border border-t px-4 text-muted-foreground text-xs",
        className
      )}
      data-slot="command-footer"
      {...props}
    />
  );
}

export { CommandDialogPrimitive };
