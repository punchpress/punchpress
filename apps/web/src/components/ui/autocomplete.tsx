"use client";

import { Autocomplete as BaseAutocompletePrimitive } from "@base-ui/react/autocomplete";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const AutocompletePrimitive = BaseAutocompletePrimitive;

export const Autocomplete = AutocompletePrimitive.Root;

export function AutocompleteInput({ className, startAddon, ...props }) {
  return (
    <AutocompletePrimitive.InputGroup
      className="relative not-has-[>*.w-full]:w-fit w-full text-foreground has-disabled:opacity-64"
      data-slot="autocomplete-input-group"
    >
      {startAddon ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-px z-10 flex items-center ps-(--menu-item-px) opacity-80 [&_svg:not([class*='size-'])]:size-(--chrome-icon)"
          data-slot="autocomplete-start-addon"
        >
          {startAddon}
        </div>
      ) : null}
      <AutocompletePrimitive.Input
        className={cn(
          startAddon &&
            "*:data-[slot=autocomplete-input]:ps-[calc(var(--menu-item-px)+var(--chrome-icon)+--spacing(1.5))]",
          className
        )}
        data-slot="autocomplete-input"
        render={<Input nativeInput />}
        {...props}
      />
    </AutocompletePrimitive.InputGroup>
  );
}

export function AutocompleteItem({ className, children, ...props }) {
  return (
    <AutocompletePrimitive.Item
      className={cn(
        "text-(length:--chrome-text) flex min-h-(--menu-item-height) cursor-default select-none items-center gap-2 rounded-(--chrome-radius) px-(--menu-item-px) py-0.5 outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 [&>svg:not([class*='size-'])]:size-(--chrome-icon) [&>svg]:pointer-events-none [&>svg]:shrink-0",
        className
      )}
      data-slot="autocomplete-item"
      {...props}
    >
      {children}
    </AutocompletePrimitive.Item>
  );
}

export function AutocompleteSeparator({ className, ...props }) {
  return (
    <AutocompletePrimitive.Separator
      className={cn(
        "mx-(--menu-item-px) my-(--menu-pad) h-px bg-border last:hidden",
        className
      )}
      data-slot="autocomplete-separator"
      {...props}
    />
  );
}

export function AutocompleteGroup({ className, ...props }) {
  return (
    <AutocompletePrimitive.Group
      className={cn("[[role=group]+&]:mt-(--menu-pad)", className)}
      data-slot="autocomplete-group"
      {...props}
    />
  );
}

export function AutocompleteGroupLabel({ className, ...props }) {
  return (
    <AutocompletePrimitive.GroupLabel
      className={cn(
        "text-(length:--section-title-text) flex h-(--menu-item-height) items-center px-(--menu-item-px) font-semibold text-(--section-title-color) tracking-(--section-title-tracking) [text-transform:var(--section-title-case)]",
        className
      )}
      data-slot="autocomplete-group-label"
      {...props}
    />
  );
}

export function AutocompleteEmpty({ className, ...props }) {
  return (
    <AutocompletePrimitive.Empty
      className={cn(
        "text-(length:--chrome-text) not-empty:p-2 text-center text-muted-foreground",
        className
      )}
      data-slot="autocomplete-empty"
      {...props}
    />
  );
}

export function AutocompleteList({ className, ...props }) {
  return (
    <ScrollArea scrollbarGutter scrollFade>
      <AutocompletePrimitive.List
        className={cn(
          "not-empty:scroll-py-(--menu-pad) not-empty:p-(--menu-pad) in-data-has-overflow-y:pe-3",
          className
        )}
        data-slot="autocomplete-list"
        {...props}
      />
    </ScrollArea>
  );
}

export function AutocompleteCollection(props) {
  return (
    <AutocompletePrimitive.Collection
      data-slot="autocomplete-collection"
      {...props}
    />
  );
}

export const useAutocompleteFilter = AutocompletePrimitive.useFilter;
