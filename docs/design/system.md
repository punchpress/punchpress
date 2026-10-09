---
summary: Defines PunchPress UI component ownership, Base UI policy, COSS UI sourcing, and stale Radix guidance.
read_when:
  - adding or changing shared UI primitives, component wrappers, or feature-level controls
  - deciding whether to copy a COSS UI pattern, use Base UI directly, or extend a local component
  - finding old Radix guidance in docs, examples, dependencies, or copied component code
---

# Design System

## Summary

This repo uses a shadcn-style component system with local components in `src/components/ui/*`.
We copy components into the repo, own the implementation locally, and adapt them to the product as needed.

For shared UI primitives and component behavior, Base UI is the only foundation we use.
Radix UI is not part of the active design system and should not be introduced for new work.

## Source of Truth

New shared components should come from COSS UI first:

- Docs and component catalog: `https://coss.com/ui/`
- LLM index: `https://coss.com/ui/llms.txt`

COSS UI is built on Base UI and Tailwind CSS, which matches the component model already used in this repo.

## Working Rules

1. Prefer existing local components from `src/components/ui/*` over bespoke feature-level implementations.
2. When a shared component does not exist yet, start from the closest COSS UI component or pattern, then adapt it into `src/components/ui/*`.
3. Keep Base UI imports inside the shared UI layer whenever practical. Feature code should usually consume the local wrapper components instead.
4. Do not add Radix UI packages, Radix-based examples, or Radix-specific APIs for new shared UI work.
5. Keep styling aligned with the existing Tailwind and shadcn-style token usage in the repo.

## Field Density

Inspector controls take `size="field"` (`Input`, `SelectTrigger`, `ScrubSlider`,
`ColorPickerField`, `Toggle`, `IconSegmentedControlItem`, and `Button` `field` /
`icon-field`; `Toggle` also has `icon-field`). Field sizes read the `--field-*`,
`--panel-*`, and `--section-*` tokens in `src/styles/global.css`, so density
changes in one token block rather than per panel.

The density is "Pro": 22px rows, 4px radii, 11px text, a 68px left label
column, and small uppercase muted section headers that collapse. Icon
segmented controls run taller (`--field-segment-height`, 28px) so their glyphs
stay legible at `--field-segment-icon`.

Properties sections compose `Section`, `FieldRow`, and `FieldPair` from
`panels/properties/field-primitives.tsx`. `FieldPair` puts related scalars
(X/Y, W/H) on one row under its left label, labels the fields inline, and
takes an optional trailing `action` such as an aspect lock. Stacked fill,
stroke, and shadow rows use `panels/properties/layer-row.tsx`; their secondary
settings open in `LayerRow.Settings`, a popover beside the panel.

## UI Typography

UI text reads `--font-sans`, `--font-features` (OpenType features), and
`--ui-tracking` from `:root`; `.canvas-surface` resets features and tracking
so document text keeps its own. Numeric field values (`ScrubSlider`, field
`Input`) use tabular figures.

## Dev Previews

`src/components/dev-preview/` holds temporary A/B switches. Each preview sets
a `data-*` attribute on `<html>` that a token block styles, remembers the
choice in localStorage, and is pinned to its first option in production. Dev
builds show the switchers at the bottom left of the editor.

- UI font (`components/ui-font-preview/`, `styles/ui-font-preview.css`,
  Alt+Shift+F): Geist (default), Inter (`inter-ui`, the full upstream build
  with cv11 and ss01; Fontsource's Google build strips them), and the system
  stack. Once picked: move the winner's tokens into `:root`, delete the folder,
  the stylesheet and its import, `ui-font-preview.spec.ts`, and `inter-ui` if
  Inter lost.

## Migration Guidance

If you find older references to Radix UI in docs, examples, or dependencies, treat them as stale unless the source code proves otherwise.
The intended direction is:

- local `src/components/ui/*` ownership
- Base UI primitives and helpers
- COSS UI as the upstream source for new components
