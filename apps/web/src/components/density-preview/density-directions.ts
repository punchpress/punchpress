// Dev-only density exploration. Each direction pairs a token set (the
// `[data-density]` blocks in global.css) with the few structural choices
// tokens cannot express. Once a direction is picked, its tokens become the
// :root defaults, its layout becomes constants, and this folder goes away.

export interface DensityLayout {
  // Collapse chevrons on section headers.
  collapsibleSections: boolean;
  // Left label column, or labels drawn inside scrub and text fields.
  labels: "left" | "inline";
  // Layer settings (paint kind, stroke align/cap/join, shadow offsets)
  // inline beneath the row, or in a settings popover off the row.
  layerDetails: "inline" | "popover";
  // Related scalar fields (X/Y, W/H, size/tracking) share one row.
  pairs: boolean;
}

export const DENSITY_DIRECTIONS = [
  {
    description: "Today's panel",
    id: "current",
    label: "Current",
    layout: {
      collapsibleSections: false,
      layerDetails: "inline",
      labels: "left",
      pairs: false,
    },
  },
  {
    description: "Same structure, tighter tokens",
    id: "compact",
    label: "Compact",
    layout: {
      collapsibleSections: false,
      layerDetails: "inline",
      labels: "left",
      pairs: false,
    },
  },
  {
    description: "Inline labels, paired fields, settings popovers",
    id: "inspector",
    label: "Inspector",
    layout: {
      collapsibleSections: true,
      layerDetails: "popover",
      labels: "inline",
      pairs: true,
    },
  },
  {
    description: "Label/value list, flat controls, caps headers",
    id: "pro",
    label: "Pro",
    layout: {
      collapsibleSections: true,
      layerDetails: "popover",
      labels: "left",
      pairs: true,
    },
  },
] as const satisfies readonly {
  description: string;
  id: string;
  label: string;
  layout: DensityLayout;
}[];

export type DensityId = (typeof DENSITY_DIRECTIONS)[number]["id"];
