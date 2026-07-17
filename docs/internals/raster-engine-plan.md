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
dab math, float accumulation, and gutters carry over from the current tile
surface.

Deletes: render-ready handshake, working-surface mount/retire, loaded-tile
tracking, pending-surface promotion, and the native-stroke fast path (all
strokes are dabs for now). Committed PNG encoding remains temporarily as a
persistence step behind the store. Per-tile DOM rendering, culling, and the
LOD preview remain only for never-brushed nodes.

Exit criteria: pointerup causes no visible change; repeated large strokes show
no flicker, shift, or cumulative degradation.

Status: implemented. Strokes paint a per-session buffer composited live over
the hydrated store; commit merges synchronously, then paint commits append
stroke-only tiles while erase and artboard-clipped commits flatten to a single
payload (fixing the old eraser's silent tile-overlay loss). Benchmarks vs the
pre-migration baseline: zero working-tile accumulation (was 68→360 over six
strokes), zero mounted tile-image DOM (was ~2000), viewport pass clean
(p95 8.8 ms, 0 slow frames). Known follow-up: first-contact hydration spike
(lazy hydration arrives with stage 5). The dab-path cost for large hard
brushes is resolved: fully-hard fully-opaque dabs take a solid fast path in
the store (analytic row spans, skip circle for the previous dab, coverage
math only on the antialias band), and the compositor resyncs tile canvases
through per-tile sync rects instead of full-tile `putImageData`. The
38400x25088 fixture (`raster-brush-stroke-huge`, 1500 px brush) dropped from
15 s to 0.7 s of dab time across four sweep strokes.

### 2. Pixels Out Of Document State

Replace `node.tileSources` data URLs with an asset store: nodes hold an asset
id plus a tile manifest (refs and rects); encoded bytes live outside node
state. Encode dirty tiles in a worker after each stroke and replace the tile's
payload — no overlay stacking. Save, export, and clipboard read the manifest.
Document load hydrates store tiles lazily.

Exit criteria: history snapshots and editor state contain no pixel data;
per-tile payloads stay single; package save/load round-trips.

Status: implemented, with three scope cuts. Tile manifests in node state are
src-less `{ref, x, y, width, height, col, row}` entries; encoded bytes live in
the editor-owned `RasterAssetStore` (`editor.rasterAssets`, append-only per
session so history entries always resolve, emptied only on document load).
Object URLs are lazily created and deduped by byte content, and hydration
decodes tiles through those shared URLs, so identical payloads cost one
browser decode however many tiles reference them. Save passes bytes through
`createPunchPackage(contents, { getAssetBytes })`; interchange forms
(hydrated package contents, clipboard payloads, legacy documents) carry tiles
as transport-only inline data URLs that `editor.loadDocument` absorbs into
the asset store, so the base `node.src` payload also stays inline unchanged
this stage. Scope cuts: per-tile payload replacement (commits kept
stroke-only append manifests — landed with stage 5a) and lazy load-time
hydration (absorption is eager, still stage 5b) deferred, and — unplanned —
commit encoding stays
synchronous `toDataURL` inside the existing budgeted chunks: every async
`toBlob`/`convertToBlob` variant tried (DOM canvas, OffscreenCanvas,
serialized, bounded in-flight, canvas pinned through the callback)
intermittently killed the Chromium renderer when several same-origin pages
encode large commits concurrently, which the raster e2e suite exercises
directly. Off-main-thread encoding lands with the stage 5 encode worker.
The asset store also defers the base64→byte decode side of that same
tradeoff: commits store the raw `toDataURL` string via `putDataUrl()` and
only decode to bytes lazily, on first `getBytes()`/`getObjectUrl()` access —
nothing needs decoded bytes at commit time (save/export are the first
consumers), so commit chunks pay encode cost only, not decode too.
Measured: a stroke commit's history-visible node snapshot serializes to
under 4 KB regardless of tile payload size (contract-tested);
`raster-brush-stroke-huge` is unchanged (fps 91→91, frame p50 8.3→8.3 ms,
p95 9.3→9.2 ms, encode chunk p95 9.6→9.8 ms with total encode-chunk time
411→394 ms, helped by native `Uint8Array.fromBase64/toBase64` fast paths).

### 3. Pyramid LOD

Maintain per-store mipmap levels updated incrementally when base tiles dirty,
frame-budgeted off the stroke path. The compositor samples the nearest level
when zoomed out and refines in place. Strokes always paint at full resolution.

Exit criteria: zoomed-out pan and zoom on the 100k fixture stay near frame
budget; no blank regions while levels refine.

Status: implemented (pulled ahead of stage 2 because the zoomed-out lag was
the user-visible pain). Tile writes mark per-level dirty coords in the store;
pyramid tiles (512 px per level, max level 8) build lazily on draw and rebuild
when their dirty coords are taken. The compositor picks
`floor(log2(1/scale))`. Stroke benchmark at 0.055 zoom: p95 42 → ~17-25 ms;
steady-state repaints draw ~9 level-4 tiles instead of ~1600 level-0 tiles.
Known follow-up (stage 5 family, alongside lazy hydration): the first paint
at a deep level builds the visible pyramid chain in one frame (~1-2 s on a
1600-tile layer); budget first builds or build deep levels directly from
level 0.

### 4. Tile-Delta Undo

Stroke sessions capture copy-on-first-touch snapshots of dirtied tiles. Undo
swaps tile contents back, invalidates affected pyramid levels, and repaints.
One history entry per stroke, sized by touched tiles.

Status: implemented. The editor-owned `RasterHistoryManager`
(`raster/raster-history.ts`) keeps a sidecar of per-commit deltas keyed by a
unique id the `HistoryManager` stamps on each pushed change (monotonic, never
reused — revision/index would collide across branch divergence). Capture runs
inside the commit merge's existing budgeted chunks: before
`mergeStrokeStoreTile` first writes a target tile, the about-to-be-written
sub-rect (intersection of the tile's physical extent with the stroke tile's
merged nominal rect — the syncRect math) is copied; tiles the merge creates
record a zero-fill marker instead of a buffer of zeros. The session's stroke
buffer moves to the manager instead of being dropped, so redo re-merges it
with the original anchors/mode — deterministic, byte-identical, and it keeps
the captured before-rects valid for the next undo. Undo writes before-rects
back, restores the pre-commit anchor (rebasing commits), and invalidates like
a merge (syncRects, tile/store revisions, pyramid dirt). `releaseAll()` is
gone from undo/redo: steps with a delta apply it surgically (the store
surface stays mounted — e2e-asserted); any other step that changed an image
node's pixel-relevant state releases only that node's entry
(rehydrate-on-contact), which is also the fallback past the depth cap of 20
retained raster steps (`RASTER_HISTORY_DEPTH`). Memory is accounted via the
`raster.history.bytes` perf counter: a step retains before-rect copies plus
the stroke buffer — measured ~2.0 MB for a 40 px/150 px e2e-scale stroke
(9 tile deltas), ~16 MB for a 200 px brush sweeping 1600 px, and ~218 MB per
1500 px sweep on the `raster-brush-stroke-huge` fixture (873 MB retained
across its four strokes; eviction returns the bytes). The cap is
count-based, so a bytes-based budget is a candidate follow-up for the
100k tier. Capture cost rides inside the budgeted merge chunks — ~13 ms
across a huge stroke's ~545 ms chunked merge (~2%) — and the benchmark is
unchanged vs stage 2: fps 91→90.8, frame p50 8.3→8.3 ms, p95 9.3→9.3 ms,
encode chunk p95 9.8→9.4 ms (total 394→401 ms), merge chunk p95 10.3 ms
still hugging the 8 ms budget with the same single-tile overshoot profile.

### 5. Eviction And Hydration

Budget hot decoded tiles. Cold tiles drop decoded bitmaps and keep encoded
payloads; scrolling or zooming rehydrates through the decode worker. Required
for the 100k px tier.

Status: partial — 5a (per-tile payload flattening) implemented; the encode
worker, lazy load-time hydration, and hot-tile eviction (5b) remain. Every
store-backed commit now leaves the node pure-tiled: a node whose manifest is
not in that shape (imported base `src`, legacy append overlays, or a reloaded
manifest whose grid drifted off the session's store tiling) migrates on its
next commit — every non-blank store tile encodes once inside the existing
budgeted commit chunks, the manifest rebuilds keyed by store tile, and
`src`/base fields drop. Pure nodes re-encode only the tiles the merge touched
and swap the matching entries, so manifest size is bounded by painted area
(contract-tested: constant across repeated same-region strokes,
erase-to-empty drops entries, zero-tile manifests save/load). Erase and
artboard-clipped commits share the path (clip commits crop-migrate within the
artboard rect); `commitFlatten`'s single-src shape is gone, and commits
serialize per node so encode chunks never interleave with the next stroke's
merge. Payloads cover the tile's physical (gutter-extended) extent — abutting
nominal-only payloads opened bright GPU seams in the committed-DOM fallback at
fractional zooms (sweep-caught) — but a tile whose nominal region is blank
gets no entry, so boundary-crossing strokes don't shed 2px sliver entries.
Scratchpad autosave now defers while raster work is pending
(`editor.hasPendingRasterWork()`): packaging is synchronous zip work and was
landing ~200 ms hitches mid-drag once src-less tiled documents became
saveable at all. Measured: `raster-brush-stroke-huge` fps 91→91.2, frame p50
8.3→8.3 ms, p95 9.3→10.1 ms, merge chunk p95 10.3→11.9 ms, encode chunk p95
9.4→9.8 ms with total encode-chunk time 401→685 ms (full-tile replace
payloads vs stroke-trimmed appends); manifest holds at 3675 entries across
all four strokes (was append-growth). Migration commit on a 12400×10800
opaque base: 550 tiles encode in ~950 ms of budgeted chunks (~1.7 ms/tile
uniform content) and the node emerges src-less. Known cost for 5b: the
benchmark's 3.9 s max frame is the now-functional scratchpad autosave
packaging a 3675-tile document at post-stroke idle — sync packaging (and the
first-contact hydration spike, ~2.1 s on the 550-tile base) moves off-thread
with the 5b worker family.

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
