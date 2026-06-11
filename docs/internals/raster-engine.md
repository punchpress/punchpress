---
summary: Describes the raster engine architecture: sparse tile store, signed tile coordinates, compositor data flow, mipmap pyramid, stroke lifecycle, persistence projection, tile-delta history, and the hot/cold tile memory model.
read_when:
  - building or changing raster tools, tile storage, raster compositing, raster LOD, or raster undo
  - debugging wrong pixels, stale tiles, seams, missing zoom levels, or raster memory growth
  - deciding whether new raster behavior belongs in the tile store, compositor, session, or persistence layer
---

# Raster Engine

The raster engine gives every raster layer one canonical runtime pixel
representation and makes everything else a projection of it. Accepted in
[Raster tile store pipeline](../decisions/raster-tile-store-pipeline.md);
migration sequencing lives in the ephemeral
[raster engine plan](raster-engine-plan.md).

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
- A tile owns its decoded pixels: a canvas while hot, an `ImageBitmap` when
  cooling, or nothing when evicted (encoded payload remains in the asset
  store).
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

One compositing canvas per raster surface, mounted once in the node's render
tree. It repaints from the tile store when tiles dirty or the viewport changes:

1. Resolve the visible tile range for the current viewport and zoom.
2. Pick the pyramid level closest to screen resolution.
3. `drawImage` each visible tile at that level, clipped to the dirty rect
   during strokes.

Rules:

- The compositor reads tiles; it never owns or mutates pixels.
- Invalidation is coalesced: many dab writes produce one dirty-rect repaint per
  frame, and one settle event per completed action.
- A region with no decoded tile at the ideal level renders the nearest existing
  level and refines in place. Blank flashes are a bug, not a loading state.
- Per-tile DOM elements, image `load` tracking, and render acknowledgement
  events are forbidden; the compositor is synchronous with the store.

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
 pointerdown ─ open session, resolve target, mark history
 pointermove ─ sample → dab into store tiles
             │   first touch of a tile copies its before-pixels (history)
             │   dirty rects accumulate → compositor repaints next frame
 pointerup   ─ finalize history delta (one entry per stroke)
             └ queue dirty tiles for worker encode (no visual effect)
```

Brush and Eraser are the same writer with different compositing (paint adds
color; erase reduces alpha and clips to the existing plane). Future raster
tools — smudge, fill, clone, filters, selection masks — are additional
readers/writers against the same store with the same invalidation and history
contract.

## Persistence Projection

The document never holds pixel bytes in node state. An image node references a
raster asset; the asset owns a tile manifest.

- After a stroke, dirty tiles encode in a worker and **replace** that tile
  coordinate's payload in the manifest. Payloads do not stack per stroke.
- Save writes manifest payloads into the package's tiled raster layout (see
  [Punch package](../reference/punch-package.md)).
- Load hydrates the store lazily: decode the tiles the viewport needs first,
  the rest on demand.
- Encode and decode timing have zero rendering consequences; the store is
  always ahead of the assets, never behind.

## History

Undo state is tile-granular, modeled on Krita's memento system:

- A stroke session snapshots each touched tile once, before its first dab.
- The history entry is the set of (tile key, before-pixels, after-pixels)
  pairs plus node metadata changes.
- Undo/redo swaps tile contents, invalidates affected pyramid levels, and
  repaints. Strokes are never replayed.
- History size scales with touched tiles, not layer size.

## Memory Model

Decoded tiles are the dominant cost (a 512 px RGBA tile ≈ 1 MB).

| Tile state | Holds | Transition |
| --- | --- | --- |
| Hot | Canvas (+ float scratch during a stroke) | Recently painted or visible |
| Cold | ImageBitmap or nothing decoded | Evicted under budget pressure |
| Persisted | Encoded payload in the asset store | Always, once committed |

- A global hot-tile budget bounds decoded bytes; eviction prefers offscreen,
  least-recently-used tiles.
- Evicted tiles rehydrate through the decode worker when the viewport returns.
- Sparse allocation plus eviction is the 100k px story: only painted tiles
  exist, only useful tiles are decoded, and zoomed-out views read small
  pyramid levels instead of level-0 data.

## Invariants

- One canonical pixel representation per raster node: the tile store.
- The screen always renders from the store; encoded assets are never a render
  source.
- Pointerup changes nothing visually.
- Tile keys and pixel data never rebase; growth is metadata-only.
- Painting is always full resolution; LOD is display-side decimation.
- One history entry per stroke, sized by touched tiles.
- Encoding, decoding, and pyramid maintenance run off the stroke hot path.

## Related

- [Raster tile store pipeline](../decisions/raster-tile-store-pipeline.md)
- [Raster engine plan](raster-engine-plan.md) — staged migration, retires when complete
- [Raster image editor](raster-image-editor.md) — tool policy and target resolution
- [Punch package](../reference/punch-package.md) — tiled raster asset format
- [Export pipeline](export-pipeline.md)
