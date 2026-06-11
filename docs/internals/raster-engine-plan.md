---
summary: Defines the staged migration from the working-surface/handoff raster runtime to the canonical tile store, single-canvas compositor, pyramid LOD, and tile-delta undo.
read_when:
  - implementing or sequencing raster tile store, compositor, raster LOD, raster undo, or raster asset storage work
  - debugging raster brush regressions during the tile-store migration
  - checking which raster pipeline stage is implemented before building on it
---

# Raster Engine Plan

Implements [Raster tile store pipeline](../decisions/raster-tile-store-pipeline.md).
The durable architecture lives in [Raster engine](raster-engine.md); this page
only sequences the migration and tracks stage status. Retire it when all
stages complete.

Raster layers must stay correct and responsive from small layers to 100k px
square. The plan replaces the working-surface/handoff runtime in stages; each
stage lands independently behind the existing brush and eraser behavior.

Interim states between stages may regress zoomed-out performance on very large
layers. That is accepted; all stages ship.

## Measurement Contract

Use the shared performance panel and benchmark runner as the source of truth
(see [Performance](performance.md) and
[performance tests](../reference/performance-tests.md)).

Raster work tracks:

- stroke frame summary during paint: FPS, p50, p95, max frame
- pointerup-to-stable cost: no visible content change, encode time off-thread
- repeated-stroke degradation: frame summary stability across 20+ strokes
- memory: decoded tile count, hot-tile bytes, history bytes per stroke
- zoom-out render cost at pyramid levels on 5k, 20k, and 100k fixtures

Existing repro: huge sweeping strokes on a 5000 px+ layer, watching for
post-mouseup flicker, prior-stroke flash, and shift. The
`window.__PUNCHPRESS_RASTER_DEBUG__` capture remains the stroke-event timeline
until the handoff events it records are deleted with stage 1.

## Verification

Before stage 1, triage the existing raster brush Playwright suite:

- **Behavior tests stay and gate every stage.** Tests that describe product
  contracts — strokes stay visible through release, no visual flash after
  release, prior strokes preserved, grow-left without pixel shift, undo/redo
  as one step, eraser and artboard clipping — must pass before stage 1 (they
  define the contract) and after each stage.
- **Mechanism tests are deleted with stage 1.** Tests that pin the
  working-surface runtime — render acknowledgement, stable paint windows,
  working-tile mounting, pending-surface promotion, LOD yielding — describe
  the implementation being removed.

New coverage follows the test-layer rule in
[testing](../operations/testing.md): the tile store, persistence manifest,
pyramid, and history are engine modules, so their behavior lands in
editor-contract tests written test-first per stage. Pixel assertions run
headless against the store's typed-array buffers; canvas stays behind the
brush runtime seam. Key contract-level invariants: painting reports identical
world-coordinate pixels after growth in any direction, pointerup leaves store
pixels unchanged, manifests replace per tile coordinate, undo round-trips
pixels, eviction plus rehydration preserves pixel identity.

Playwright keeps only browser truth: the retained behavior tests above plus
visual stability sampling around pointerup. Performance benchmarks are
baselined on the current runtime before stage 1 and compared at every stage
exit using the measurement contract above.

## Stages

### 1. Tile Store And Compositor

Move canonical stroke pixels into an engine-owned sparse tile store with signed
tile coordinates. Render each raster node through one compositing canvas that
draws visible store tiles per dirty-rect or viewport change. Brush and eraser
dab math, float accumulation, gutters, and the native-stroke fast path carry
over from the current tile surface.

Deletes: render-ready handshake, working-surface mount/retire, loaded-tile
tracking, per-tile DOM culling, pending-surface promotion, and the LOD preview
component. Committed PNG encoding remains temporarily as a persistence step
behind the store.

Exit criteria: pointerup causes no visible change; repeated large strokes show
no flicker, shift, or cumulative degradation.

Status: pending.

### 2. Pixels Out Of Document State

Replace `node.tileSources` data URLs with an asset store: nodes hold an asset
id plus a tile manifest (refs and rects); encoded bytes live outside node
state. Encode dirty tiles in a worker after each stroke and replace the tile's
payload — no overlay stacking. Save, export, and clipboard read the manifest.
Document load hydrates store tiles lazily.

Exit criteria: history snapshots and editor state contain no pixel data;
per-tile payloads stay single; package save/load round-trips.

Status: pending.

### 3. Pyramid LOD

Maintain per-store mipmap levels updated incrementally when base tiles dirty,
frame-budgeted off the stroke path. The compositor samples the nearest level
when zoomed out and refines in place. Strokes always paint at full resolution.

Exit criteria: zoomed-out pan and zoom on the 100k fixture stay near frame
budget; no blank regions while levels refine.

Status: pending.

### 4. Tile-Delta Undo

Stroke sessions capture copy-on-first-touch snapshots of dirtied tiles. Undo
swaps tile contents back, invalidates affected pyramid levels, and repaints.
One history entry per stroke, sized by touched tiles.

Status: pending.

### 5. Eviction And Hydration

Budget hot decoded tiles. Cold tiles drop decoded bitmaps and keep encoded
payloads; scrolling or zooming rehydrates through the decode worker. Required
for the 100k px tier.

Status: pending.

## Non-Goals

- No paint-at-reduced-resolution stroke preview.
- No WebGL compositor in the initial migration; it remains an upgrade behind
  the tile-store boundary.
- No change to brush/eraser product behavior, target resolution, or
  one-history-entry-per-stroke semantics.

## Success Criteria

- A huge sweeping stroke on a 5000 px+ layer never flickers, shifts, or
  disappears at or after pointerup.
- Twenty consecutive large strokes show stable frame summaries and bounded
  memory.
- 100k px square layers paint, pan, and zoom within frame budget with sparse
  allocation (only painted tiles exist, only visible tiles decoded).
