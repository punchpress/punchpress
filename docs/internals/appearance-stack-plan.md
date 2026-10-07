---
summary: Stages the appearance stack rollout with per-stage gates, performance scenarios and budgets, the DPR zoom-ladder sweep, export parity checks, and the seeded fuzz edge-case list; retired when the stack ships.
read_when:
  - implementing or reviewing an appearance stack stage
  - adding or reading an `appearance-*` performance scenario or the appearance visual sweep
  - deciding whether an appearance edge case is already covered by a test layer
---

# Appearance Stack Plan

This plan implements [Appearance stack](../decisions/appearance-stack.md).
Delete this page once stage 4 lands and its durable rules move to product
and reference docs.

## Stage Gates

Every stage goes through the same sequence:

1. A high-effort Codex architecture review against the decision.
2. Tests written first.
3. Gates:
   - `bun run check`
   - `bun run typecheck`
   - targeted `bun run test:editor`
   - targeted Playwright
   - the appearance sweep
   - `perf:json` for the `appearance-*` scenarios
4. A medium-effort Codex code review of the diff before commit.

## Stages

0. **Baseline and spike.**
   - Build the scene builder (`appearance-benchmark-scene.ts`) and the
     `appearance-*-plain` scenarios.
   - Add the sweep capture helpers.
   - Run a throwaway spike that injects SVG filter shadows (hard, blur 24,
     blur 500) into all 200 nodes. Zoom both down the ladder and back up, at
     DPR 1 and 2.
   - **Go/no-go:** the filtered scene must stay within the viewport budget
     below. If it fails, design the settle-raster fallback before stage 1.
1. **Schema 1.9 and solid stacks.**
   - Color parser, migration and normalizer changes, clipboard upgrade, and
     the vector-child effect validator.
   - Commands, with descriptors deleted.
   - Paint removed from geometry.
   - The plan drives the canvas, the edit preview, dense surfaces, and export.
   - Flattened opacity (A1).
   - The panel family covering solid layers and node opacity.
   - The new text default.
2. **Linear gradients (1.10).** Paint union, userSpace defs, a gradient strip
   with stop ids, and stop colors in selection colors.
3. **Stroke alignment (1.11).** The offset-outline compiler, chosen against
   the dependency checklist; alignment-aware ink bounds and hits; outside
   strokes painted below fills (A2).
4. **Drop shadow (1.12).** The effects list, the filter plan, and vector
   container effects with resize scaling.

## Performance Scenarios

Scene: 200 shape and text nodes in a `4500 × 5400` artboard. Styled variants
give each node a linear fill, a center stroke, a 10-unit outside stroke, and a
drop shadow.

| Scenario | Gate |
| --- | --- |
| `appearance-viewport-200-plain` | baseline for the gates below |
| `appearance-viewport-200` (hard and blur 24 variants) | p95 ≤ 1.25 × plain p95; max settle frame ≤ 50 ms |
| `appearance-dragging-200-plain` | baseline |
| `appearance-dragging-200` | p95 ≤ 8.33 ms; `renderCanvasNode` ≤ 5 during the drag |
| `appearance-shadow-scrub` | p95 ≤ 8.33 ms; ≤ 1 node-art render per frame, including color preview |
| `appearance-max-stack` | 20 nodes with 8/8/4 stacks and blur 500, zoomed 1% → 6400% → 1%; max frame ≤ 100 ms; export SVG + PNG latency recorded |

Viewport scenarios zoom along the ladder `[1, 0.5, 0.35, 0.21, 0.1, 0.05, 0.01]`
while panning around the artboard center.

## Browser Checks

- **Visual sweep** (`appearance-visual-sweep.spec.ts`): DPR 2 and DPR 1, the
  same ladder, decoded in-page. Asserts:
  - the shadow band is present and unclipped
  - outside and inside strokes have full width with no background hairline
    on dark grounds
  - gradient luminance is monotonic
  - results are identical after serialize → reload
- **Export parity:** a canvas screenshot at DPR 1 and 100% zoom against
  `renderSvgToPngBlob`, within a per-channel tolerance. Overlapping
  translucent siblings are included.
- **Panel and hit specs:**
  - layer add, reorder, toggle, and remove; a scrub is one undo step
  - a control closes when its layer disappears
  - clicking a shadow selects nothing

## Fuzz

Seeded command sequences in the engine. After every step, check:

- the document validates
- undo restores the exact prior document
- every export ref resolves
- paint box ⊆ selection frame ⊆ ink bounds
- no vector child has effects

A short seeded Playwright walk over the panel also runs.

Edge cases:

- **Stroke and shadow values:**
  - width 0, 0.01, and 1000
  - blur 0 and 500
  - offset ±5000
  - blank or negative drafts
- **Layer state:** zero alpha; every layer disabled; full stacks.
- **Gradients:**
  - duplicate or unsorted stops
  - `start === end`
  - a box that collapses on one axis
- **Text:**
  - empty, warped, or tight-tracking text
  - a font that is not loaded
  - inline editing
- **Path geometry:**
  - mixed open and closed contours
  - evenodd holes with inside strokes
  - acute miters and square caps
- **Transforms:** rotated, flipped, and non-uniformly scaled nodes, including
  during shadow scrubs; group resize per family.
- **Opacity and visibility:**
  - hidden ancestors
  - translucent overlapping siblings
- **Vectors:** dense imported groups; compound and boolean vectors.
- **Clipboard:**
  - a 1.8 payload
  - a malformed graph with an effect on a vector child
- **Loading:** history resets after a migrated load.
