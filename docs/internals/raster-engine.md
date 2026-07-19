---
summary: Describes the raster engine architecture: sparse tile store, signed tile coordinates, compositor data flow, mipmap pyramid, lazy per-tile hydration, worker PNG encode and packaging, tile-delta history budgets, and the hot-tile eviction memory model.
read_when:
  - building or changing raster tools, tile storage, raster compositing, raster LOD, or raster undo
  - debugging wrong pixels, stale tiles, seams, missing zoom levels, or raster memory growth
  - deciding whether new raster behavior belongs in the tile store, compositor, session, or persistence layer
---

# Raster Engine

The raster engine gives every raster layer one canonical runtime pixel
representation and makes everything else a projection of it. Accepted in
[Raster tile store pipeline](../decisions/raster-tile-store-pipeline.md).

```text
            writes dabs                    samples tiles + pyramid
 Brush ───────────────► RasterTileStore ◄─────────────── Compositor ──► screen
 session                 (engine-owned,                   (one canvas
   │                      canonical pixels)                per surface)
   │ tile snapshots         │        ▲
   ▼                        │ encode │ hydrate / decode
 History                    ▼        │
 (tile deltas)           Asset store (encoded tile payloads)
                            │
                            ▼
                         .punch package (tiled raster assets)
```

Pixels flow down only at persistence time and up only at hydration time. The
screen never renders from encoded data, and encoding never blocks or alters
rendering. Pointerup is visually a no-op by construction.

## Tile Store

One store per raster node. The store is derived runtime state: hydrated from
assets, never serialized itself, safe to drop and rebuild.

- Sparse map keyed by signed `(col, row)`. Only painted tiles exist.
- A tile owns its decoded pixels while resident; evicted or not-yet-decoded
  tiles are hollow markers whose encoded payloads remain in the asset store.
- Tiles carry a small gutter so anti-aliased dabs overlap neighbors instead of
  baking seams into tile edges.
- Stroke-time float RGBA scratch buffers attach per touched tile and release at
  stroke end, so soft-brush accumulation follows source-over math instead of
  byte rounding.

### Coordinate Model

Tile space is anchored once per store, not per node bounds. The image node's
logical rect maps into tile space through a stable anchor offset held as node
metadata.

```text
 tile space (signed, never moves)            node metadata (moves freely)
 ┌────────┬────────┬────────┐
 │ -1,-1  │  0,-1  │  1,-1  │         anchor offset ── logical x/y/w/h
 ├────────┼────────┼────────┤                 │
 │ -1,0   │  0,0   │  1,0   │ ◄───────────────┘
 └────────┴────────┴────────┘
```

Painting past the left or top edge allocates negative tiles and updates node
metadata only. Pixel data, tile keys, pyramid entries, and asset refs never
rebase. This removes the class of bugs where in-flight render state and
rebased document state disagree mid-commit.

## Compositor

One always-screen-space compositing canvas per raster surface. The canvas
backing store is device resolution — viewport CSS px × `devicePixelRatio` —
and never represents world or local extents. It repaints from the tile store
when tiles dirty or the viewport changes:

1. Set one shared store→device-pixel transform on the context
   (zoom × DPR × node transform × anchor offset).
2. Pick the pyramid level closest to device resolution:
   effective scale = device px per store px, level =
   `clamp(floor(log2(1 / scale)), 0, max)`.
3. `drawImage` each viewport-intersecting tile at that level at its integer
   store coordinates through the shared transform.

Rules:

- The compositor reads tiles; it never owns or mutates pixels.
- Invalidation is coalesced: many dab writes produce one repaint per frame,
  and one settle event per completed action. Repaints redraw the full
  viewport; the device-resolution backing caps the cost regardless of zoom.
- A region with no decoded tile at the ideal level renders the nearest existing
  level and refines in place. Blank flashes are a bug, not a loading state.
- Per-tile DOM elements, image `load` tracking, and render acknowledgement
  events are forbidden; the compositor is synchronous with the store.
- The surface canvas is plain HTML (never SVG foreignObject — it cannot
  direct-composite) portaled into the host-anchored raster surface layer:
  axis-aligned, exactly viewport-sized, one canvas per brushed node in
  document order. Mounting it inside the node shell with an inverse transform
  does not survive Blink: the paint cull is applied in shell-local space and
  truncates the surface at ~16384 px even when the element is composited.
- Tiles are never drawn at per-tile fractional destination rects. One shared
  context transform with integer store-space coordinates makes neighboring
  tile edges land on identical device pixels; per-tile rounding under GPU
  rasterization opens bright seam lines at tile boundaries.
- Level selection is device-pixel aware. Ignoring DPR undersamples on hi-DPI
  displays (one level too coarse) and widens seam artifacts.
- Sampling flips to nearest-neighbor at deep zoom-in: once a store pixel
  spans more than 2 CSS px (zoom > 2 on an unscaled node), smoothing turns
  off so pixels render as crisp squares, Photoshop-style. Smoothing stays on
  for downscale and mild upscale. The zoom range is `MIN_ZOOM`–`MAX_ZOOM`
  (0.01–64); the editor state and the viewer share the same ceiling constant
  so they can never diverge.

## Mipmap Pyramid

Each store maintains downscaled levels for zoomed-out display.

```text
 level 0   512px tiles   1:1   painting always happens here
 level 1   ↓ half        1:2
 level 2   ↓ half        1:4   compositor samples nearest level
 level n   ...                 until layer ≈ one tile
```

- Dirtying a level-0 tile queues its ancestor chain for downscale, processed
  frame-budgeted off the stroke path.
- Levels are display data only. Strokes, history, hit testing, and export read
  level 0.
- Broad regeneration is forbidden; updates propagate per dirty tile.

## Stroke Lifecycle

```text
 pointerdown ─ open session, resolve target, kick background hydration
 pointermove ─ sample → dab into the session stroke buffer
             │   dirty rects accumulate → compositor repaints next frame
 pointerup   ─ hydrate exactly the store tiles the merge touches (per-tile,
             │   from manifest payloads), then merge the stroke buffer into
             │   the store (budgeted chunks)
             │   first write of a store tile copies its before-rect (history)
             ├ record history delta (one entry per stroke)
             └ post dirty-tile pixels to the encode worker (no visual effect)
```

First contact on a cold layer never waits for full hydration: the session
kicks a background per-tile hydration stream (viewport-priority first) and
the commit merge awaits only its own touched tiles. Undo capture happens
after that per-tile hydration and before the merge write, so before-rects
always hold hydrated content. Only a migration commit — one that re-encodes
every non-blank tile — awaits the full stream.

Brush and Eraser are the same writer with different compositing (paint adds
color; erase reduces alpha and clips to the existing plane). Future raster
tools — smudge, fill, clone, filters, selection masks — are additional
readers/writers against the same store with the same invalidation and history
contract.

## Persistence Projection

The document never holds pixel bytes in node state. An image node carries a
tile manifest — src-less `{ref, x, y, width, height, col, row}` entries — and
the encoded bytes behind each ref live in the editor-owned raster asset store
(`editor.rasterAssets`). Asset-store entries are append-only for the session
(history entries reference refs, so undo always re-resolves) and are released
only when a new document loads.

- Every store-backed commit leaves the node **pure-tiled**: no inline base
  `src`, no base frame fields, and exactly one manifest entry per painted
  store tile — each entry the complete non-transparent content of its tile's
  physical (gutter-extended) rect. Adjacent payloads overlap by the gutter
  band on purpose: the committed-DOM fallback draws each payload as its own
  image, and abutting rects open bright GPU-rounding seams at fractional
  zooms (sweep-asserted). Manifest size is bounded by painted area, never
  stroke count, and every payload is self-complete — the precondition for
  tile eviction.
- A node not yet in that shape — an imported base image, a legacy
  append/overlay manifest, or a reloaded manifest whose grid no longer aligns
  with this session's store tiling — **migrates on its next commit**: every
  non-blank store tile encodes once inside the same frame-budgeted commit
  chunks, the manifest rebuilds wholesale, and `src`/base fields drop. Pure
  nodes re-encode only the tiles the commit's merge touched and swap the
  matching entries under fresh refs.
- Erase commits ride the same path: a tile erased to zero alpha drops its
  manifest entry, and a fully-erased layer keeps a valid zero-tile manifest.
  Artboard-clipped commits crop the node to the artboard source rect and
  migrate within it; encoding always clamps to the node's legitimate plane
  region, so pixels a crop dropped never resurface in later manifests.
- Commits serialize per node: encode reads merged store tiles, so a later
  session's merge never interleaves with an earlier session's encode chunks
  on the same store.
- Tile encoding runs in a dedicated Web Worker with a pure-TS PNG codec
  (`raster-png.ts`: fixed Paeth filter + `CompressionStream` zlib) — no
  canvas APIs anywhere. Canvas encode premultiplies alpha (lossy for
  semi-transparent pixels), and the async canvas `toBlob`/`convertToBlob`
  family intermittently kills the Chromium renderer under concurrent
  large-commit load, so it stays banned. Commit chunks only copy the tile
  sub-rect and post it; the synchronous `toDataURL` path survives solely as
  the headless/worker-failure fallback.
- A commit registers its manifest refs immediately as PENDING asset
  entries; the worker bytes land asynchronously. `getBytes`/`getDataUrl`
  materialize a pending ref synchronously through the fallback encoder
  (first materialization wins; retained pixels for this are capped at
  64 MB), render paths simply see no object URL until the encode lands, and
  save flows call `rasterAssets.flush()` first so worker bytes are what
  persists. `editor.hasPendingRasterWork()` covers pending encodes.
- Packaging (zip + payload decode) runs in the app-side package worker
  (`punch-package-client.ts`): autosave and manual save resolve asset
  payloads on the main thread, then hand the serialized document to the
  worker via `createPunchPackage(contents, { getAssetBytes })` (see
  [Punch package](../reference/punch-package.md)); the schema package never
  reads editor internals. A sync fallback remains for headless runtimes.
- Interchange forms are self-contained: hydrated package contents and
  clipboard payloads carry tile pixels as transport-only inline `src` data
  URLs, which `editor.loadDocument` / paste absorb into the asset store
  (as-is, bytes decoded lazily) and strip before nodes reach editor state.
  Export inlines data URLs back out of the store so exported markup renders
  outside the session.
- Hydration is tile-major and lazy: `ensureHydrated` indexes every
  payload-covered tile as hollow and streams per-tile decodes in the
  background (viewport-priority first, frame-budgeted ~8 ms of sync work per
  rAF), while `ensureTilesHydrated` decodes exactly the tiles a merge is
  about to write. Engine-encoded PNG payloads decode through the byte-exact
  raw path (`decodePngRgba`); anything else takes browser image decode.
  Large multi-tile sources (imported photos) pre-rasterize once through
  `createImageBitmap` into a staging canvas — per-tile `drawImage` from a
  large image element re-decodes the whole source per call.
- Commit-time merge and encode chunks run on rAF cadence and pause entirely
  while any brush session has an active pointer stroke or un-flushed points,
  so a previous stroke's commit never hitches the next stroke's drag.
- Encode and decode timing have zero rendering consequences; the store is
  always ahead of the assets, never behind. Before full hydration the
  committed-DOM fallback renders beneath the store surface from a manifest
  FROZEN at store-entry creation (the surface draws every merged commit on
  top); at level 0 only merged tiles draw over it, and zoomed-out levels draw
  the pyramid.

## History

Undo state is tile-granular, modeled on Krita's memento system. Document
history restores node state (src-less manifests); the editor-owned
`RasterHistoryManager` sidecar restores the matching store pixels and anchor.

- Strokes paint a session stroke buffer, so committed store pixels change
  only at the commit merge. That merge is the capture point: before it first
  writes a target tile, the about-to-be-written sub-rect is copied
  (copy-on-first-write). Tiles the merge creates record a zero-fill marker
  instead of a buffer of zeros.
- One history entry per commit: the before sub-rects, the retained stroke
  buffer, the merge anchors/mode, and the entry anchor before/after (rebasing
  commits shift it).
- Undo writes the before sub-rects back and restores the prior anchor. Redo
  re-merges the retained stroke buffer with the original anchors — the merge
  is deterministic over restored inputs, so redo is byte-identical and the
  captured sub-rects stay valid for the next undo. Interactive strokes are
  never replayed.
- Both directions invalidate exactly like a merge: tile syncRects and
  revisions, pyramid dirty coords, store revision and dirty bounds. The store
  surface stays mounted through undo/redo.
- Entries are keyed by a unique id stamped on each pushed document change
  (monotonic, never reused, immune to undo/redo branch divergence).
- History size scales with touched tiles, not layer size, and is capped
  twice: the most recent 20 raster commits (`RASTER_HISTORY_DEPTH`) and
  256 MB of retained bytes (`RASTER_HISTORY_BYTES_BUDGET`), evicting oldest
  first (`raster.history.bytes` tracks retained bytes). Undoing a step whose
  delta was evicted, whose target tiles went hollow, or any non-brush step
  that changed an image node's pixel-relevant state releases only that
  node's store entry and falls back to committed rendering until the next
  brush contact rehydrates.

## Memory Model

Decoded tiles are the dominant cost (a 512 px RGBA tile ≈ 1 MB).

| Tile state | Holds | Transition |
| --- | --- | --- |
| Resident | Decoded pixels (+ float scratch during a stroke) | Recently written, hydrated, or composited |
| Hollow | Nothing decoded; `{col, row, evicted}` marker only | Never decoded yet, or evicted under budget pressure |
| Persisted | Encoded payload in the asset store | Always, once committed |

- A global budget of **384 MB** (`RASTER_HOT_TILE_BUDGET_BYTES`) bounds
  decoded level-0 bytes across every registered committed store. Every tile
  lookup stamps a monotonic use tick; enforcement evicts least-recently-used
  tiles in rAF-budgeted chunks until under budget.
- Never evicted: tiles of a node with an unmerged stroke buffer, and tiles
  of a store with a commit (merge or encode) queued or running. A pinned
  store can carry the total past the budget until its commit settles.
- Eviction pre-builds the tile's level-1 pyramid ancestor while pixels are
  resident, then drops the pixels (buffers recycle through a bounded pool).
  The tile's self-complete manifest payload is the recovery source.
- The compositor meeting a hollow tile at level 0 enqueues an async per-tile
  rehydration (frame-budgeted queue) and draws the nearest resident pyramid
  ancestor meanwhile; blank flashes are a bug, not a loading state. The
  raw-PNG rehydration path restores the exact pre-eviction bytes, so it does
  not re-dirty the pyramid.
- Pyramid rebuilds are themselves budgeted per draw pass: past the budget a
  stale tile serves its previous canvas and refines over following frames,
  so a whole-layer merge never lands a multi-second repaint.
- Undo/redo apply their tile deltas only when every target tile is resident;
  a hollow target falls back to releasing the node's store entry.
- Retained history bytes have their own **256 MB** budget (see History).
- Sparse allocation plus eviction is the 100k px story: only painted tiles
  exist, only useful tiles are decoded, and zoomed-out views read small
  pyramid levels instead of level-0 data.

## Invariants

- One canonical pixel representation per raster node: the tile store.
- The screen always renders from the store; encoded assets are never a render
  source.
- A committed node is pure-tiled: one self-complete payload per painted store
  tile, replaced per tile on commit — manifests never stack overlays.
- Pointerup changes nothing visually.
- Tile keys and pixel data never rebase; growth is metadata-only.
- Painting is always full resolution; LOD is display-side decimation.
- One history entry per stroke, sized by touched tiles.
- Encoding, decoding, and pyramid maintenance run off the stroke hot path.

## Related

- [Raster tile store pipeline](../decisions/raster-tile-store-pipeline.md)
- [Raster image editor](raster-image-editor.md) — tool policy and target resolution
- [Punch package](../reference/punch-package.md) — tiled raster asset format
- [Export pipeline](export-pipeline.md)
