---
summary: Defines the staged architecture plan for making dense imported vector artwork responsive without mutating SVG-derived document nodes.
read_when:
  - optimizing SVG import, vector rendering, dense group interaction, or layer tree performance
  - changing compiled vector render surfaces, culling, interaction quality, or dense imported SVG editing
  - comparing PunchPress vector rendering architecture against tldraw-style canvas rendering patterns
---

# Vector Render Performance Plan

PunchPress keeps imported SVG contents editable and faithful while making normal
canvas interaction fast. Dense SVG imports may produce thousands of path nodes;
preserving those nodes does not require mounting or updating every child as an
independent interactive canvas object during ordinary pan, drag, and selection.

## Measurement Contract

Use the shared performance panel and benchmark runner as the source of truth.

- Manual inspection: open the performance panel with `Cmd+Shift+P`.
- Automated run:

  ```sh
  bun run perf:json <benchmark-id>
  ```

- Flame-span run:

  ```sh
  bun run perf:flame <benchmark-id>
  ```

Dense SVG performance work tracks:

- import or setup time
- frame summary: FPS, p50, p95, max frame, slow frame count
- editor node count and selected node count
- mounted canvas wrapper count
- mounted layer row count
- rendered SVG path count
- slow-frame diagnostics when max or p95 frames regress

Compare results from the same machine, browser mode, fixture, and benchmark
options. Do not treat one-off local numbers as universal thresholds.

## Optimization Loop

Each optimization moves through the same loop:

1. Run the dense SVG benchmark and save the baseline artifact.
2. Implement one architecture change.
3. Add or update an e2e or editor-contract test for unchanged behavior.
4. Rerun the dense SVG benchmark with the same options.
5. Inspect slow-frame diagnostics when the result is ambiguous.
6. Keep the change only if the correctness test passes and the performance
   result is understood.

## Architectural Direction

The durable document model remains unchanged:

- imported paths stay as editable path nodes
- vector or group containers preserve hierarchy and object-level selection
- simplification is an explicit user command, not automatic import behavior

The normal render path has four distinct surfaces:

- document surface: saved nodes and editable path data
- render surface: engine-owned compiled SVG-ready output
- interaction surface: object-level hit, selection, transform, and drag behavior
- edit surface: focused vector path editing for individual child paths

React paints stable render surfaces. The engine owns tree queries, geometry,
transform, and render derivations.

## Stages

### 1. Large SVG Baseline

Add benchmarks that load the large SVG fixture, wait for the canvas to settle,
and measure deterministic drag and viewport passes through the existing
performance controller. Keep a real held-drag Playwright benchmark for the
mouse path because synthetic pointer-event dispatch can miss product-level
interaction issues.

Status: implemented for `large-svg-pointer-drag`, `large-svg-viewport`, and the
Playwright `large-svg-held-drag.spec.ts` check.

### 2. Tree And Visibility Indexes

Keep editor tree queries cached so large imported hierarchies do not repeatedly
scan the full node list for child, descendant, layer, or selection queries.

Dense containers remain collapsed in expensive UI surfaces by default while
preserving children in the document model.

Status: implemented with cached editor tree queries, dense layer collapse, and
cached selection bounds for stable base frames. Dense drag preview membership is
indexed so selection bounds do not recheck large selections with O(n²) array
membership during every frame.

### 3. Renderable Container Surface

Normal canvas mode treats a dense imported vector as one renderable container.
Child paths remain editable document nodes, but they do not each mount as
separate interactive canvas wrappers unless the user focuses into vector edit
mode.

This mirrors the useful part of tldraw's architecture: move and position a
stable wrapper cheaply, while avoiding unnecessary rerenders of expensive shape
contents. Large render surfaces use one compiled inline SVG in normal mode so
viewport pan and zoom do not fan out through per-path canvas wrappers.

Status: implemented for dense imported groups and large multi-path groups in
normal canvas mode. The large SVG fixture keeps editable child paths in the
document while mounting one canvas wrapper in normal mode. Large
moderate-complexity SVGs may also use this path when their painted bounds are
large enough that per-path SVG rendering becomes the bottleneck.

### 4. Engine-Owned Render Derivation

Move dense SVG render assembly out of ad hoc React recursion and into an
engine-owned render derivation with stable identity and invalidation based on
node content changes.

The compiled surface is derived state. It is not saved, and it does not rewrite
the imported SVG-derived paths.

Status: pending. A safe version must avoid recomputing dense group signatures
or base frames during active drag/viewport interactions.

### 5. Spatial Culling

Add a spatial index for renderable objects and use it for viewport culling,
hit-test candidate narrowing, and overlay queries.

Culling does not help when every path in a dense SVG is visible, but it prevents
large documents from paying for offscreen artwork.

### 6. Interaction Quality Mode

During pan, zoom, or object drag, dense vectors may render through a lower-cost
proxy or cached surface. When the interaction stops, the full vector surface
returns.

This is a render strategy only. It must not mutate nodes or simplify paths.

Status: partially implemented. Live pan and zoom position is held outside the
main editor store during viewport interactions so viewport movement does not fan
out through panels. Dense and large groups render one compiled inline SVG
surface in normal canvas mode, and drag preview targets the visible surface
instead of expanding every descendant into the per-frame preview set.

## Current Reference Results

Measured on May 22, 2026 against
`large-svg.svg` on this workstation.

| Benchmark | Before | Current |
| --- | --- | --- |
| Large SVG pointer drag | p50 8.3ms, p95 9.3ms, max 325.0ms, slow 5/160, 149 canvas nodes | p50 8.3ms, p95 9.3ms, max 225.5ms, slow 4/160, 1 inline SVG surface |
| Large SVG viewport | p50 100.0ms, p95 175.1ms, max 275.0ms, slow 159/160 | p50 8.3ms, p95 9.3ms, max 166.8ms, slow 5/160 |
| Large SVG held drag | invalid baseline: hit the layer panel, p95 66.7ms | corrected canvas target: p50 8.3ms, p95 9.3ms, slow 2/334 |

Remaining work: move dense group render assembly out of React recursion and into
an engine-owned compiled surface, make aggregate resize use a root preview with
one commit at gesture end, then add spatial culling for larger documents.

## Non-Goals

- Do not automatically simplify SVG path contents during import.
- Do not make Paper the normal canvas render path.
- Do not hide child paths from focused vector editing.
- Do not add performance thresholds to CI until the benchmark is stable enough
  to distinguish real regressions from local noise.

## Success Criteria

- Dense SVG import completes without a long unusable stall.
- Dragging the imported SVG has no visible interaction lag on the reference
  fixture.
- Panning with the imported SVG on canvas stays near frame budget, with any
  slow frames explainable by benchmark artifacts.
- The layer panel and canvas do not mount thousands of interactive wrappers for
  one dense imported object in normal mode.
- The user can still enter vector editing and access the imported paths.
