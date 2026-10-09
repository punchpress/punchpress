import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { useState } from "react";
import { ColorPickerField } from "@/components/ui/color-picker/color-picker-field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FieldLabelsProvider, useFieldLayout } from "./field-layout";

const LABEL_CLASS =
  "select-none truncate text-(length:--field-label-text) text-sidebar-foreground/72 leading-normal sm:text-(length:--field-label-text) sm:leading-normal";
const LABELED_GRID =
  "grid grid-cols-[var(--field-label-width)_minmax(0,1fr)] items-center";

// One inspector section: a header with an optional actions slot (add
// buttons), then rows. Sections divide themselves from the one above.
export const Section = ({
  actions,
  children,
  className,
  title,
  ...props
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  title?: string;
} & React.ComponentProps<"section">) => {
  const { collapsibleSections } = useFieldLayout();
  const [open, setOpen] = useState(true);
  const isOpen = open || !collapsibleSections;

  return (
    <section
      className={cn(
        "border-border border-t py-(--section-py) first:border-t-0 first:pt-0 last:pb-0",
        className
      )}
      {...props}
    >
      {title ? (
        <div
          className={cn(
            "flex min-h-(--section-header-height) items-center justify-between gap-2",
            isOpen && "mb-(--section-title-gap)"
          )}
        >
          <h3 className="text-(length:--section-title-text) min-w-0 font-semibold text-(--section-title-color) tracking-(--section-title-tracking) [text-transform:var(--section-title-case)]">
            {collapsibleSections ? (
              <button
                aria-expanded={isOpen}
                className="-ms-1 flex cursor-pointer items-center gap-0.5 rounded-sm ps-1 pe-1.5 outline-none [text-transform:inherit] hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => setOpen(!isOpen)}
                type="button"
              >
                {title}
                <HugeiconsIcon
                  className={cn("opacity-60", !isOpen && "-rotate-90")}
                  icon={ArrowDown01Icon}
                  size={12}
                  strokeWidth={2}
                />
              </button>
            ) : (
              title
            )}
          </h3>
          {actions ? (
            <div className="flex items-center gap-0.5">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {isOpen ? <div className="grid gap-(--field-gap)">{children}</div> : null}
    </section>
  );
};

// A labeled control. Left labels sit in a fixed column; inline labels draw
// inside scrub and text fields (their value or text clears the label) and
// stay hidden for self-describing controls like selects and swatches.
export const FieldRow = ({
  children,
  className,
  label,
  labelClassName,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  labelClassName?: string;
}) => {
  const { labels } = useFieldLayout();

  if (labels === "inline") {
    return (
      <div
        className={cn("group/field relative min-w-0", className)}
        data-slot="field-row"
        style={
          {
            "--field-label-inset": `calc(${label.length}ch + 0.375rem)`,
            "--field-track-start":
              "calc(var(--field-px) + var(--field-label-inset))",
          } as React.CSSProperties
        }
      >
        <Label className="text-(length:--field-text) sm:text-(length:--field-text) pointer-events-none absolute inset-y-0 start-[calc(var(--field-px)+1px)] z-20 hidden select-none font-normal text-muted-foreground group-has-[[data-slot=input]]/field:flex group-has-[[data-slot=scrub-slider]]/field:flex">
          {label}
        </Label>
        {children}
      </div>
    );
  }

  return (
    <div className={cn(LABELED_GRID, className)} data-slot="field-row">
      <Label className={cn(LABEL_CLASS, labelClassName)}>{label}</Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
};

// Related scalar rows (X/Y, W/H) that share one line when the density pairs
// fields; otherwise they stack as ordinary rows. Paired rows always label
// inline, under the pair's own label when labels sit on the left.
export const FieldPair = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => {
  const { labels, pairs } = useFieldLayout();

  if (!pairs) {
    return children;
  }

  const grid = (
    <FieldLabelsProvider labels="inline">
      <div className="grid min-w-0 grid-cols-2 gap-(--field-gap)">
        {children}
      </div>
    </FieldLabelsProvider>
  );

  if (labels === "inline") {
    return grid;
  }

  return (
    <div className={LABELED_GRID}>
      <Label className={LABEL_CLASS}>{label}</Label>
      {grid}
    </div>
  );
};

export const ColorField = ({
  onChange,
  onInteractionEnd,
  onInteractionStart,
  placeholder,
  stateKey,
  value,
}) => {
  return (
    <ColorPickerField
      onChange={onChange}
      onInteractionEnd={onInteractionEnd}
      onInteractionStart={onInteractionStart}
      placeholder={placeholder}
      size="field"
      stateKey={stateKey}
      value={value}
    />
  );
};
