"use client";

import { Input as BaseInputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

const InputPrimitive = BaseInputPrimitive;

function Input({
  className,
  leading,
  size = "default",
  unstyled = false,
  nativeInput = false,
  ...props
}) {
  const inputClassName = cn(
    "h-8.5 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground sm:h-7.5 sm:leading-7.5",
    leading && "ps-0",
    size === "sm" &&
      "h-7.5 px-[calc(--spacing(2.5)-1px)] leading-7.5 sm:h-6.5 sm:leading-6.5",
    size === "lg" && "h-9.5 leading-9.5 sm:h-8.5 sm:leading-8.5",
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
            "relative inline-flex w-full rounded-lg border border-[var(--control-border)] bg-[var(--control-surface)] text-base text-foreground transition-[border-color,background-color] hover:border-[var(--control-border-hover)] hover:bg-[var(--control-surface-hover)] has-focus-visible:has-aria-invalid:border-destructive has-aria-invalid:border-destructive/36 has-focus-visible:border-[var(--control-border-focus)] has-autofill:bg-foreground/4 has-disabled:opacity-64 has-disabled:hover:border-[var(--control-border)] sm:text-sm dark:has-autofill:bg-foreground/8",
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
        <input
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          {...props}
        />
      ) : (
        <BaseInputPrimitive
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          {...props}
        />
      )}
    </span>
  );
}

export { Input, InputPrimitive };
