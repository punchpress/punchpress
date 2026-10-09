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

## Chrome Density

Everything outside the inspector uses the same Pro scale through the
"Chrome density" tokens in `src/styles/global.css`: `--chrome-text` (12px),
`--chrome-text-sm` (11px), `--chrome-icon` (14px), `--chrome-radius` (4px) for
controls, and `--surface-radius` (8px) for floating surfaces.

- Menus, context menus, and the command menu share the class constants in
  `ui/menu.tsx`: 24px rows (`--menu-item-height`), `--menu-pad` popups, and
  group labels in the section-header style.
- `PopoverContent` pads with `--popover-pad`; `variant="flush"` drops it for
  popups with edge-to-edge sections. `PopoverTitle` is a section header.
- Tooltips are 20px, 11px text; dialogs use `--dialog-radius`, `--dialog-pad`,
  a 13px title, and `chrome` footer buttons.
- The tool dock and selection toolbar are the `Toolbar` primitives:
  `--toolbar-radius` surface, `--toolbar-pad`, and 28px `icon-toolbar` buttons
  (`toolbar` for text actions).
- Layers rows read `--layer-row-height`, `--layer-indent`, and `--layer-icon`.

Button sizes: `chrome` / `icon-chrome` (24px, the default), `toolbar` /
`icon-toolbar` (28px), `field` / `icon-field` (22px / 20px), and
`icon-tab` (a square, full-height title bar segment). Toggle has
`field`, `icon-field`, and `icon-toolbar`. `Input` has `chrome` (the default,
for search boxes in popovers and the command menu) and `field`. `SelectTrigger`,
`ScrubSlider`, `ColorPickerField`, and `IconSegmentedControlItem` only come in
`field`. These are the only sizes; add a token-backed size before reaching for
a one-off height.

## Title Bar and Tabs

The workspace tabs sit in a full-width 40px title bar (`DesignerTitleBar`):
the `--titlebar-bg` surface, a bottom hairline (`--titlebar-shadow`), and
content starting after the desktop traffic-light inset. Empty bar space drags
the desktop window; tab controls are `no-drag`.

Tabs are the `Tab` family in `ui/tab.tsx`: flat full-height segments, no
radius, split by `--tab-divider` hairlines (one also sits before the first
tab). Inactive tabs show the bar surface with `--tab-fg` text and a
`--tab-bg-hover` wash. The active tab takes `--designer-bg`, medium
`--tab-fg-active` text, and covers the bar's hairline so it joins the canvas.
Text tabs run `--tab-max-width` (200px) and shrink to `--tab-min-width`
(120px) before the strip scrolls; titles truncate and never set the width.
`TabClose` owns the status slot right of the title: the unsaved dot
(`--tab-dirty`), swapped for the close button on hover, keyboard focus, or a
clean active tab. The Scratchpad is a pinned icon tab (`size="icon"`,
`TabIconTrigger` with a tooltip); the new-tab button is `variant="tab"`
`size="icon-tab"`.

On desktop the shell sets `--titlebar-inset-top` (6px) so segment content
centers on the traffic lights (23px) instead of the bar (20px).

## UI Typography

The UI font is the platform face: SF Pro on macOS, Segoe UI Variable on
Windows (`--font-sans`, `--font-heading`), with `ui-monospace` for mono. The
app ships no UI web font. UI text also reads `--font-features` (OpenType
features, `normal`) and `--ui-tracking` from `:root`; `.canvas-surface`
resets both so document text keeps its own. Uppercase section headers track
at 0.04em. Numeric field values (`ScrubSlider`, field `Input`) use tabular
figures.

## Pane Containers

The Layers and Properties panes are flat floating cards over a full-window
canvas: 8px from the window edges and below the tab bar, an 8px radius, a
hairline border (9% black, 9% white in dark), an almost flat shadow, and 8px
panel padding. The tokens live in `styles/panel-container.css` on the shell
root (they derive from its `--desktop-*` chrome variables): `--pane-*` for
placement and the card, `--pane-hover` / `--pane-selected` for rows.
`DesignerPanel` places a pane slot and `DesignerPane` is the card; panes hide
below the md breakpoint. The canvas never moves or resizes with the panes.

Selected layer rows are a quiet accent tint (`--pane-selected`, 13% of the
accent over the pane surface, 24% in dark; `--pane-selected-hover` on hover)
under normal text and icons (`--pane-selected-foreground`). Hidden rows stay
dimmed when selected. Only the layers tree uses these tokens; the canvas
selection keeps the saturated accent.

## Migration Guidance

If you find older references to Radix UI in docs, examples, or dependencies, treat them as stale unless the source code proves otherwise.
The intended direction is:

- local `src/components/ui/*` ownership
- Base UI primitives and helpers
- COSS UI as the upstream source for new components
