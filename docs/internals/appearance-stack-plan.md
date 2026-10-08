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
   - Rendering changes only for documents that interleaved a group's children
     with other nodes. It ships first because stage 3 relies on it.
3. **Engine-owned render tree and isolated groups.** Narrowed after its
   architecture review to what opacity needs:
   - `editor.getRenderTree()` with always-present group and artboard layers,
     shells, and dense surfaces; ancestry-aware expansion for edits.
   - Layer `div`s with CSS opacity; leaf and surface art carry own opacity only.
   - Text-edit preview painted in its node's shell.
   - Hierarchical export with one `<g opacity>` per translucent container.
4. **Linear gradients (1.10).** Paint union, paint boxes and glyph layout
   matrices, userSpace defs, kind/angle/stop commands, a gradient ramp and
   stops panel, stop colors in selection colors, and a field-targeted
   selection-color preview.
5. **Stroke alignment (1.11).** SVG-native inside (clip) and outside (mask)
   strokes from one engine element tree shared by canvas and export,
   open-contour fallback, sided reaches for frames and hit testing, an Align
   control, and the stroke-width scrub gate. Offset geometry is a non-goal.
6. **Drop shadow on nodes and groups (1.12).**
   - Effects list and one branched filter graph per effect owner.
   - Stationary artboard clip layers, so group shadows clip to the artboard.
   - Group filter ink widened to follow previews; moving presentation layers
     only if the shadow drag gate needs them.
   - Vector-container and group effects, including resize and baked
     group-transform scaling.
   - Deferred: exact-raster presentation expanded by effect support.

The schema version bumps at each stage that widens it.

## Performance Scenarios

Scene: 200 shape and text nodes in a `4500 × 5400` artboard. Styled variants
give each node a linear fill, a center stroke, a 10-unit outside stroke, and a
drop shadow.

| Scenario | Gate |
| --- | --- |
| `appearance-viewport-200-plain` (pinch), `appearance-pan-200-plain`, `appearance-zoom-stops-200-plain` | baselines for the gates below |
| `appearance-viewport-200-*`, `appearance-pan-200-*`, `appearance-zoom-stops-200-*` (hard and blur 24 variants) | p95 ≤ 1.25 × the matching plain workload's p95; max frame ≤ 1.25 × its max |
| `appearance-dragging-200-plain` | baseline |
| `appearance-dragging-200` | p95 ≤ 1.1 × plain p95; slow frames ≤ 2 × plain; `renderCanvasNode` ≤ 5 during the drag |
| `appearance-shadow-scrub` | p95 ≤ 8.33 ms; ≤ 1 node-art render per frame, including color preview |
| `appearance-nested-groups-viewport-200`, `-pan-200`, `-dragging-200` | 200 nodes in 20 stacks of three nested 60% groups; pinch, pan, and a drag of all 20 stacks. Gate: viewport p95 ≤ 1.25 × the opacity-1 twin (`appearance-nested-groups-opaque-*`); drag ≤ 1.1 × the same scene at opacity 1 (isolation cost only) |
| `appearance-shadowed-groups` | 20 shadowed groups of 10 nodes. Variants: whole-group drag (gate p95 ≤ 1.1 × plain drag p95) and single-child drag inside a group (records the per-frame group re-filter cost; gate p95 ≤ 16.7 ms) |
| `appearance-representation-thresholds` | groups crossing the dense thresholds (300↔301 leaves, 24↔25 leaves plus area); nested drill-in; opacity and effect toggles; hidden-child insertion. Gate: no frame > 50 ms and no resident raster remount |
| `appearance-max-stack` | 20 nodes with 8/8/4 stacks and blur 500, zoomed 1% → 6400% → 1%; max frame ≤ 100 ms; export SVG + PNG latency recorded |
| `appearance-stroke-scrub-*`, `appearance-stroke-type-text-500-warped` (each with a `-center` twin) | Every frame sets a new width on an inside and an outside stroke (or types one character), on one of 200 nodes, all 200, and 500-glyph flat, circle, and arch text. Gate: aligned p95 ≤ 1.25 × the center twin for the single-node, flat, circle, and typing scenarios; all-200 and arch text recorded |

Viewport workloads use the ladder `[1, 0.5, 0.35, 0.21, 0.1, 0.05, 0.01]`:
the pinch zooms continuously down and back up (landing on 1% at the middle
frame) with a small screen-space wobble, the pan translates at a fixed 21%,
and the zoom stops jump to each stop and dwell. Setups assert the viewer,
engine camera, and projected stage at sampled frames.

Absolute 8.33 ms gates don't apply to drags: the plain 200-node drag already
runs at p95 16.7 ms. Drag gates are therefore relative to the plain control.

### Stage 0 Baseline (2026-10-07)

> **Invalid for the viewport workload (corrected 2026-10-08).** The viewport
> loop wrote engine viewport state without moving the viewer, so these
> viewport columns timed a stationary camera. The go decision does not rest
> on them; see "Corrected Viewport Measurements" below.

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

### Stage 3 Measurements (2026-10-07)

> The two viewport rows timed a stationary camera and are invalid; see
> "Corrected Viewport Measurements". The drag rows ran at the initial 100%
> zoom, not 21%, because setup never moved the viewer.

| Scenario | p50 / p95 / max (ms) |
| --- | --- |
| viewport plain | 8.3 / 9.1 / 66.7 |
| viewport, nested 60% groups | 8.3 / 9.0 / 75.0 |
| drag plain (leaf selection) | 8.3 / 16.7 / 33.3 |
| drag nested groups, 60% | 33.3 / 40.7 / 58.4 |
| drag nested groups, opacity 1 | 33.3 / 41.7 / 50.0 |
| drag nested groups, before stage 3 | 33.4 / 41.7 / 50.0 |

Isolation adds no measurable cost. Dragging 20 selected group stacks is slow
(p50 33 ms) on the code before stage 3 too; that predates appearance work. The
`perf/group-drag` fix (cached tree queries, engine-owned
`editor.getPreviewPlacementNodeIds`) brings `nested-groups-dragging-200` to
p50 8.4 / p95 16.7 ms, level with the leaf control.

### Stage 5 Stroke Scrub (2026-10-07)

DPR 1, dev build, ms. Aligned strokes: one inside and one outside per node;
the twin uses two center strokes.

| Scenario | Aligned p50 / p95 / max | Center p50 / p95 / max | p95 ratio |
| --- | --- | --- | --- |
| scrub one of 200 | 33.3 / 41.7 / 108.7 | 33.1 / 34.1 / 100.8 | 1.22 (0.97 on an earlier run) |
| scrub all 200 | 133.4 / 241.7 / 258.4 | 91.6 / 183.3 / 200.5 | 1.32 |
| scrub 500-glyph flat text | 41.7 / 83.5 / 109.1 | 40.8 / 75.7 / 101.0 | 1.10 |
| scrub 500-glyph circle text | 50.0 / 91.8 / 108.8 | 41.6 / 75.0 / 100.2 | 1.22 |
| scrub 500-glyph arch text | 25.0 / 49.9 / 58.4 | 16.7 / 33.2 / 42.5 | 1.50 |
| type into 500-glyph arch text | 24.9 / 41.7 / 50.6 | 16.7 / 41.1 / 50.7 | 1.01 |

- The gate holds. Repeated glyphs share one clip and one mask (keyed by
  outline); before that, flat and circle text ran 2.2× their twins. Arch text
  is one merged outline, so its single mask spans the whole text.
- Painting aligned objects costs about 0.5 ms per frame in the one-of-200
  profile. Neither alignment meets an absolute 8.33 ms budget: every node
  update re-runs app-wide work (store selectors, the node context menu state,
  including a shape-to-path conversion check, a full node-map rebuild per
  selection-target query, and canvas cursor assets). That predates stage 5
  and is tracked separately.

### Stage 6 Drop Shadows (2026-10-07)

> The viewport and max-stack rows timed a stationary camera, and every drag
> row ran at 100% instead of 21%; all are invalid. The headless shell used
> here rasterizes on the CPU, which also inflates drag frames: at the real
> 21% the whole-group drag runs avg 17 / p95 25 ms there and 8.3 / 9 ms with
> GPU raster. See "Corrected Viewport Measurements".

DPR 1, dev build, ms (p50 / p95 / max).

| Scenario | Shadowed | Control | Gate |
| --- | --- | --- | --- |
| viewport 200, hard 8/8 | 8.3 / 9.0 / 66.7 | plain 8.3 / 9.1 / 66.8 | pass (0.99×, 1.0×) |
| viewport 200, blur 24 | 8.3 / 9.0 / 66.7 | plain 8.3 / 9.1 / 66.8 | pass |
| dragging 200, blur 24 | 8.4 / 17.1 / 33.1 | plain 8.4 / 16.8 / 33.3 | pass (1.02×) |
| shadow scrub, one of 200 | 25.0 / 33.5 / 100 | stroke-width scrub 25.0 / 33.5 / 100 | fails 8.33 absolute; identical to its control (per-update overhead, tracked separately) |
| shadowed groups, whole-group drag | 16.5 / 17.0–17.2 / 25–58 | plain 8.3 / 16.7 / 25 | pass on p95 (1.02–1.03×); p50 doubles |
| shadowed groups, child drag | 8.4 / 16.8 / 25 | plain 8.3 / 9.1 / 33 | at the 16.7 gate (+0.1, one vsync); 20–23 slow frames vs 3–5 |
| max stack, 1% → 6400% → 1% | 8.3 / 8.9 / 25.0 | — | pass (max ≤ 100) |
| max stack export | about 17 ms including two trailing frames | — | recorded |

- Group drags first ran 1.5× on p95: every composited layer re-rendered on
  every preview frame, and group shadows used SVG `url()` filters. Layers now
  subscribe only when composited, cached per preview revision, and a single
  group shadow uses CSS `drop-shadow()`.
- A whole-group drag still re-filters each shadowed group every frame, since
  children move under a stationary layer. Moving presentation layers would
  make it compositor-only; deferred because the p95 gate holds.

### Corrected Viewport Measurements (2026-10-08)

Production build (`--prod`), full Chromium with GPU raster
(`--browser chromium`), 1280 × 720, after the camera publication rework.
Two runs each; ms as avg / p95 / max, then frames over 16.7 ms and over one
120 Hz interval, out of 283 (pinch), 242 (pan, max stack), or 146 (stops).

| Scenario, DPR 1 | avg / p95 / max | slow / missed 120 Hz | vs plain p95 | Gate |
| --- | --- | --- | --- | --- |
| pinch, plain | 11.2–11.4 / 16.8 / 17.6 | 38–42 / 99–103 | 1.0× | baseline |
| pinch, hard shadow | 23.1–23.6 / 41.6 / 49.9 | 184–186 / 227–228 | 2.5× | **fails** 1.25× |
| pinch, blur 24 | 35.5–35.7 / 58.3 / 66.7 | 230–235 / 261–263 | 3.5× | **fails** 1.25× |
| pinch, nested 60% groups | 11.9–12.8 / 17.1–25.0 / 33.3 | 53–65 / 114–130 | 1.0–1.5× opaque twin | borderline |
| pinch, nested opaque twin | 11.6 / 17.0 / 25.0 | 44–58 / 110–111 | 1.0× | control |
| pan at 21%, every variant | 8.3 / 8.9–9.3 / 9.4 | 0 / 0 | 1.0× | pass |
| zoom stops, plain and blur 24 | 8.3 / 9.3 / 9.4–16.6 | 0 / 0–2 | 1.0× | pass; `zoomStop.settleMs` p50 16.7 |
| max stack 1% → 6400% | 17.1–20.9 / 25–33 / 42 | 119–154 / 168–192 | — | pass (max ≤ 100) |
| large SVG pan and mixed pan/zoom | 8.3 / 9.0 / 9.3 | 0 / 0 | — | — |
| drags at 21% (plain, shadowed whole and child, plain twins) | 8.3 / 8.6–9.2 / 9.4 | 0 / 0 | 1.0× | pass |

DPR 2 matches DPR 1 within noise: pinch plain 12.1 / 17.3, hard 24.4–24.9 /
41.7, blur 24 36.3–38.3 / 58.3–59.0, nested 13.0 / 25.0, max stack max 49.

- **Shadows are not free on viewport.** Translation and discrete stops cost
  nothing, but a continuous pinch re-rasterizes every shadow filter at each
  scale. The GPU thread is 95% busy for blur 24, against 87% for plain; the
  main thread stays near 4 ms per frame. Shadowed pinch fails the 1.25× gate
  by 2.5–3.5×. Fixing it means rasterizing less per scale step (for example a
  temporary cached-scale raster during pinch), which is a product tradeoff
  and has not been made.
- **Plain pinch is GPU-bound too.** Every durable shell is its own
  composited layer (`translate3d`), and all 200 re-raster per frame. Before
  the camera rework the main thread spent about 5.4 ms per frame (rAF 2.8,
  JavaScript 1.8, async 1.2); after, 3.8 ms (rAF 0.7, JavaScript 0.5, async
  0.25), with no store write, Canvas render, or placement pass per frame.
  Frame time did not move because GPU raster sets it. 2D shell transforms
  bring plain pinch to 8.3 / 9.0 with no missed 120 Hz frames, but a section
  drag on the 4,000-leaf group fixture then rises from 20 to 139 ms per
  frame (overlap promotion), so layer policy waits for moving presentation
  layers.
- The earlier dev headless-shell numbers (plain pinch avg 15–25, large SVG
  12–16, whole-group drag 17) come from CPU raster in that browser; they
  reproduce unchanged after the rework. Use `--browser chromium` for
  raster-sensitive gates.

## Browser Checks

- **Visual sweep** (`appearance-visual-sweep.spec.ts`): DPR 2 and DPR 1, the
  same ladder, decoded in-page. Asserts:
  - the shadow band is present and unclipped
  - outside and inside strokes have full width on their side, a translucent
    fill hides the outside stroke's inner half, holes follow even-odd and
    nonzero, open paths stroke on center, miter vs round corners, gradient
    rings, a 50% group, and stroked circle and arch text
    (`stroke-alignment-sweep.spec.ts`); the antialiased edge seam is the only
    accepted artifact
  - gradient luminance is monotonic
  - results are identical after serialize → reload
- **Export parity:** a canvas screenshot at DPR 1 and 100% zoom against
  `renderSvgToPngBlob`, within a per-channel tolerance. Overlapping
  translucent siblings are included.
- **Shadow sweep** (`drop-shadow-sweep.spec.ts`): hard, blurred, and rotated
  leaf shadows, a 50% shadowed group, and a group shadow clipped at the
  artboard edge, at DPR 2 and 1 down the ladder, after reload, and in export.
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
- paint box ⊆ selection frame ⊆ ink bounds, for visible paint
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
