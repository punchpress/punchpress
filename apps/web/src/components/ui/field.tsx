"use client";

import { Field as BaseFieldPrimitive } from "@base-ui/react/field";

import { cn } from "@/lib/utils";

const FieldPrimitive = BaseFieldPrimitive;

function Field({ className, ...props }) {
  return (
    <BaseFieldPrimitive.Root
      className={cn("flex flex-col items-start gap-2", className)}
      data-slot="field"
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }) {
  return (
    <BaseFieldPrimitive.Label
      className={cn(
        "inline-flex items-center gap-2 font-medium text-base/4.5 text-foreground sm:text-sm/4",
        className
      )}
      data-slot="field-label"
      {...props}
    />
  );
}

function FieldItem({ className, ...props }) {
  return (
    <BaseFieldPrimitive.Item
      className={cn("flex", className)}
      data-slot="field-item"
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }) {
  return (
    <BaseFieldPrimitive.Description
      className={cn("text-muted-foreground text-xs", className)}
      data-slot="field-description"
      {...props}
    />
  );
}

function FieldError({ className, ...props }) {
  return (
    <BaseFieldPrimitive.Error
      className={cn("text-destructive-foreground text-xs", className)}
      data-slot="field-error"
      {...props}
    />
  );
}

const FieldControl = BaseFieldPrimitive.Control;
const FieldValidity = BaseFieldPrimitive.Validity;

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldControl,
  FieldItem,
  FieldPrimitive,
  FieldValidity,
};
