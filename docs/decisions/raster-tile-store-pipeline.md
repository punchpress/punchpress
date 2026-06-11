---
summary: Records the raster pipeline decision: one canonical in-memory tile store rendered through a single compositing canvas, with PNG encoding demoted to persistence-only.
read_when:
  - changing raster brush, eraser, tile storage, raster rendering, raster LOD, or raster undo
  - debugging raster strokes that flash, shift, or lag at commit, or raster memory growth on large layers
  - deciding where new raster tools (smudge, fill, clone, filters) read and write pixels
---

# Raster Tile Store Pipeline

Status: Accepted
Date: 2026-06-10

## Context

The first raster brush runtime rendered committed pixels as SVG `<image>`
elements with base64 PNG data URLs, while active strokes painted into canvas
working surfaces. Every stroke required a handoff between those substrates at
pointerup, guarded by a render-ready handshake (image `load` events plus a
stable-frame window). The handshake was heuristic: browsers report `load`
before SVG images are rasterized, mounted images never re-fire `load` after the
loaded-tile tracker reset, the LOD preview unmounted at pointerdown, and
commit-time rebasing shifted pending working surfaces. At large layer sizes
this produced strokes that blinked out after mouseup, prior strokes that
flashed and shifted, and pending surfaces that accumulated without retiring.

Structural limits compounded the races: tile overlays appended per stroke and
never flattened, pixel data lived as base64 strings inside node state and
history snapshots, and the LOD preview rebuilt from every tile on every commit.

Reference engines do not have this failure class. Krita, MyPaint, GEGL, and
Drawpile all paint strokes directly into the canonical tile store and render
the screen from that same store every frame; encoding and compression exist
only in persistence and swap subsystems. Figma and Drawpile both measured and
rejected retained DOM/scene-graph rendering for raster content in the browser.
Krita's Instant Preview demonstrates the cost of computing strokes at reduced
resolution (end-of-stroke popping); GEGL and deep-zoom viewers demonstrate the
alternative: paint at full resolution, display through an incrementally
maintained mipmap pyramid.

## Decision

Raster pixels have one canonical runtime representation: an engine-owned sparse
tile store per raster node.

| Layer | Ownership |
| --- | --- |
| Durable document | Image node metadata plus an asset manifest of encoded tile payloads, referenced by id. No pixel bytes or data URLs in node state. |
| Tile store (derived runtime state) | Sparse map of decoded tiles keyed by signed tile coordinates, plus a per-store mipmap pyramid. Hydrated from assets on demand, never serialized directly. |
| Compositor | One canvas per raster surface, repainted from the tile store on dirty-rect or viewport change. No per-tile DOM elements. |
| Brush session (transient) | Stroke sampling, dab writes into store tiles, copy-on-first-touch tile snapshots for history, one coalesced invalidation per stroke. |

Rules:

- Brush, Eraser, and all future raster tools mutate tile-store pixels directly.
  The screen renders from the same tiles; pointerup is visually a no-op.
- Encoding (PNG or equivalent) is persistence-only, runs off the stroke path,
  and replaces the affected tile's payload. Tile overlays do not stack.
- Tile coordinates are signed. Growing a layer left or up allocates negative
  tiles and updates node metadata; pixel data and tile keys never rebase.
- LOD renders from pyramid levels updated incrementally per dirty tile.
  Strokes always paint at full resolution.
- Undo stores per-stroke tile deltas (before-tiles for touched tiles), not node
  snapshots containing pixel data.
- The compositor starts as a 2D canvas. WebGL tile atlasing is a permitted
  upgrade behind the same tile-store boundary.

## Rejected Alternatives

- **Patching the render-ready handshake.** No browser API reports when an SVG
  image is composited; any handoff between canvases and async-decoding DOM
  images stays racy. Removed instead of improved.
- **Per-tile DOM/SVG rendering.** Rejected by direct experience here and by
  Figma and Drawpile's published measurements for raster workloads.
- **Paint-at-LOD (Krita Instant Preview model).** Trades commit flicker for
  end-of-stroke popping and per-brush opt-outs. Display-side decimation only.
- **WebGL-first compositor.** Premature; a 2D-canvas compositor handles the
  viewport tile count comfortably and keeps the migration reviewable.

## Consequences

- The render-ready handshake, working-surface mount/retire lifecycle,
  loaded-tile tracking, per-tile viewport DOM culling, and the rebuild-on-commit
  preview canvas are deleted. Commit-time flicker and shift are structurally
  impossible rather than mitigated.
- Memory becomes boundable: one decoded payload per tile coordinate, history
  size proportional to touched tiles, eviction of cold decoded tiles with
  rehydration from encoded assets.
- New raster tools are readers/writers against one store instead of new
  surface-handoff choreography.
- Hot decoded tiles cost real memory (~1 MB per 512 px RGBA tile), so large
  fully painted layers require an explicit hot-tile budget and eviction.
- Save, export, and clipboard read the asset manifest instead of
  `node.tileSources` data URLs and migrate with the schema change.

## Related

- [Vector render surface pipeline](vector-render-surface-pipeline.md) — the
  same durable/derived/transient layering applied to vector artwork.
- [Raster engine](../internals/raster-engine.md) — the architecture in depth.
- [Raster engine plan](../internals/raster-engine-plan.md) — staged migration.
