"use client";

import { Input as BaseInput } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

// `chrome` matches `chrome` buttons (menus, popovers, dialogs); `field`
// follows the density tokens in global.css, and its inline label offset comes
// from a properties FieldRow that draws its label inside the control.
const INPUT_SIZE_CLASSES = {
  chrome:
    "h-[calc(var(--menu-item-height)-2px)] px-(--menu-item-px) leading-[calc(var(--menu-item-height)-2px)]",
  field:
    "h-[calc(var(--field-height)-2px)] ps-[calc(var(--field-px)+var(--field-label-inset,0px))] pe-(--field-px) leading-[calc(var(--field-height)-2px)] tabular-nums",
};
const INPUT_CONTROL_SIZE_CLASSES = {
  chrome: "text-(length:--chrome-text) rounded-(--chrome-radius)",
  field: "text-(length:--field-text) rounded-(--field-radius)",
};

function Input({
  className,
  leading,
  size = "chrome",
  unstyled = false,
  nativeInput = false,
  ...props
}) {
  const inputClassName = cn(
    "w-full min-w-0 rounded-[inherit] outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground",
    INPUT_SIZE_CLASSES[size],
    leading && "ps-0",
    props.type === "search" &&
      "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
    props.type === "file" &&
      "text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm"
  );

  return (
    <span
      className={
        cn(
          !unstyled &&
            "relative inline-flex w-full border border-[var(--control-border)] bg-[var(--control-surface)] text-foreground transition-[border-color,background-color] hover:border-[var(--control-border-hover)] hover:bg-[var(--control-surface-hover)] has-focus-visible:has-aria-invalid:border-destructive has-aria-invalid:border-destructive/36 has-focus-visible:border-[var(--control-border-focus)] has-autofill:bg-foreground/4 has-disabled:opacity-64 has-disabled:hover:border-[var(--control-border)] dark:has-autofill:bg-foreground/8",
          !unstyled && INPUT_CONTROL_SIZE_CLASSES[size],
          className
        ) || undefined
      }
      data-size={size}
      data-slot="input-control"
    >
      {leading ? (
        <span
          className="pointer-events-none flex shrink-0 items-center ps-[calc(--spacing(3)-1px)] text-muted-foreground"
          data-slot="input-leading"
        >
          {leading}
        </span>
      ) : null}
      {nativeInput ? (
        <input className={inputClassName} data-slot="input" {...props} />
      ) : (
        <BaseInput className={inputClassName} data-slot="input" {...props} />
      )}
    </span>
  );
}

export { Input };
