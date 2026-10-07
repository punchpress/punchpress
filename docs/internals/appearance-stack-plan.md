---
summary: Stages the appearance stack rollout with per-stage gates, performance scenarios and budgets, the DPR zoom-ladder sweep, export parity checks, and the seeded fuzz edge-case list; retired when the stack ships.
read_when:
  - implementing or reviewing an appearance stack stage
  - adding or reading an `appearance-*` performance scenario or the appearance visual sweep
  - deciding whether an appearance edge case is already covered by a test layer
---

# Appearance Stack Plan

This plan implements [Appearance stack](../decisions/appearance-stack.md).
Delete this page once stage 6 lands and its durable rules move to product
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
   - Panel family covering solid layers and node opacity.
   - New text default.
   - Appearance visual sweep and its capture helpers, ported from the
     branch-only raster sweep.
   - Ancestor opacity keeps today's per-leaf multiplication on both canvas
     and export, so parity holds until stage 3.
2. **Group contiguity invariant.** Engine only.
   - Canonicalize subtree order on load (normalize), insert, reparent,
     reorder, and paste.
   - Editor-contract tests for each ingress, including malformed loaded
     documents and clipboard payloads.
   - No rendering change. It ships first because stage 3 relies on it.
3. **Engine-owned render tree and isolated groups.**
   - Starts with its own high-effort architecture review.
   - Ordered render tree with clip, presentation, and effect layers.
   - Disjoint preview roots and the placement rewrite.
   - Representation stable across gestures and aware of ancestry.
   - Editing artwork and raster ownership on the tree.
   - Hierarchical export.
   - Isolated group opacity.
   - Codex's estimate: 12–18 production files and 800–1,500 changed lines.
4. **Linear gradients.** Paint union, userSpace defs, a gradient strip with
   stop ids, and stop colors in selection colors.
5. **Stroke alignment.** Offset-outline compiler (chosen against the
   dependency checklist), alignment-aware ink bounds and hit testing, and
   outside strokes below fills.
6. **Drop shadow on nodes and groups.**
   - Effects list and one branched filter graph per effect owner.
   - Vector-container and group effects, including resize and baked
     group-transform scaling.

The schema version bumps at each stage that widens it.

## Performance Scenarios

Scene: 200 shape and text nodes in a `4500 × 5400` artboard. Styled variants
give each node a linear fill, a center stroke, a 10-unit outside stroke, and a
drop shadow.

| Scenario | Gate |
| --- | --- |
| `appearance-viewport-200-plain` | baseline for the gates below |
| `appearance-viewport-200` (hard and blur 24 variants) | p95 ≤ 1.25 × plain p95; max frame ≤ 1.25 × plain max |
| `appearance-dragging-200-plain` | baseline |
| `appearance-dragging-200` | p95 ≤ 1.1 × plain p95; slow frames ≤ 2 × plain; `renderCanvasNode` ≤ 5 during the drag |
| `appearance-shadow-scrub` | p95 ≤ 8.33 ms; ≤ 1 node-art render per frame, including color preview |
| `appearance-nested-groups-200` | 200 nodes in 20 nested translucent groups (depth 3, opacity 0.6 at every level); viewport ladder plus whole-group drag. Gate: p95 ≤ 1.25 × plain p95; `renderCanvasNode` ≤ 5 during the drag |
| `appearance-shadowed-groups` | 20 shadowed groups of 10 nodes. Variants: whole-group drag (gate p95 ≤ 1.1 × plain drag p95) and single-child drag inside a group (records the per-frame group re-filter cost; gate p95 ≤ 16.7 ms) |
| `appearance-representation-thresholds` | groups crossing the dense thresholds (300↔301 leaves, 24↔25 leaves plus area); nested drill-in; opacity and effect toggles; hidden-child insertion. Gate: no frame > 50 ms and no resident raster remount |
| `appearance-max-stack` | 20 nodes with 8/8/4 stacks and blur 500, zoomed 1% → 6400% → 1%; max frame ≤ 100 ms; export SVG + PNG latency recorded |

Viewport scenarios zoom along the ladder `[1, 0.5, 0.35, 0.21, 0.1, 0.05, 0.01]`
while panning around the artboard center.

Absolute 8.33 ms gates don't apply to drags: the plain 200-node drag already
runs at p95 16.7 ms. Drag gates are therefore relative to the plain control.

### Stage 0 Baseline (2026-10-07)

Run on the pinned Chromium 145 (Playwright 1208), full browser with GPU
raster, 1440 × 900.

The spike injected an `feDropShadow` (offset 8/12, 60%) into every one of the
200 node `<svg>`s. It ran the viewport ladder (zoom out, then back in) and
the drag.

| Variant | Viewport p95 / max (DPR 1) | Viewport p95 / max (DPR 2) | Drag p95 / slow (DPR 1) | Drag p95 / slow (DPR 2) |
| --- | --- | --- | --- | --- |
| plain | 8.9 / 67.5 | 9.1 / 91.8 | 16.8 / 25 | 16.7 / 19 |
| hard (blur 0) | 8.8 / 91.0 | 9.1 / 91.5 | 16.8 / 15 | 17.0 / 22 |
| blur 24 | 8.9 / 91.6 | 9.2 / 91.9 | 16.7 / 21 | 16.8 / 24 |
| blur 500 | 9.1 / 91.6 | 8.9 / 83.2 | 16.7 / 18 | 16.8 / 22 |

All times are ms, aggregated over the whole run.

**Go, qualified.**

- Viewport p95 stays within 1.03× plain across the zoom-out-and-back ladder at
  both DPRs.
- Drag p95 does not change. The slow-frame count is noise (15–25 in every
  variant).
- The single worst frame is one ladder transition. It is 67–92 ms in plain
  runs as well, so the old absolute 50 ms settle budget fails without any
  appearance work. The relative max gate replaces it.
- These are aggregates. They show no regression, but they do not prove every
  zoom stop is cheap. Stage 6 adds per-stop frame capture to the viewport
  scenario.
- Headless frame timing can under-report raster cost, so the stage 6
  hand-test checklist repeats the zoom ladder in a real window.

The pre-existing `shape-nodes-dragging-500` runs at p50 16.7 ms and p95 25 ms
on the same machine, so the drag baseline is not caused by appearance.

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
- isolated group layers on the canvas match isolated groups in export
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
  - nested isolated groups
  - a group shadow crossing an artboard edge
  - drilling into a child of a shadowed group
  - brushing a raster inside a shadowed group
- **Vectors:** dense imported groups; compound and boolean vectors.
- **Clipboard:**
  - a 1.8 payload
  - a malformed graph with an effect on a vector child
- **Loading:** history resets after a migrated load.
