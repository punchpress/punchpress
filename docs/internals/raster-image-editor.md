---
summary: Defines Brush and Eraser ownership across action bar state, empty-layer materialization, image nodes, document assets, raster working surfaces, history, and export.
read_when:
  - changing Brush or Eraser tool state, brush options, stroke commits, or empty-layer raster materialization
  - deciding whether brush state belongs in the engine, schema, raster renderer, worker, action bar, or export pipeline
  - debugging brush commits, working-surface pixels, history entries, asset forks, or layer source-kind materialization
---

# Raster Image Editor

The raster image editor starts as the backend for Brush and Eraser. Durable
source data and tool policy live in the engine and schema. Browser-specific
canvas buffers render through the raster renderer.

## Layers

| Layer | Owns |
| --- | --- |
| Schema | Image node fields, empty layer source kind, document asset records, and package references. |
| Engine | Active raster tool state, target resolution, working-surface mutation, history boundaries, and asset reference updates. |
| React renderer | Brush cursor chrome plus committed and active raster working-surface rendering. |
| Raster worker | Decode, encode, and brush stroke application when work moves off the main thread. |
| Export | Format-specific compositing, alpha preservation, and flattening. |

Tiled and non-editable canvas rendering do not instantiate the resident
Canvas2D adapter. Eligible single-payload Raster nodes do so because their
presented canvas is also the live editing surface.

## Implementation Boundaries

- Raster canvas rendering lives under
  `apps/web/src/components/canvas/raster/`. The generic canvas node renderer
  delegates image and tiled-image rendering there instead of owning culling,
  tile DOM, or over-dense projection.
- PunchPress computes each Raster's logical screen footprint per intrinsic
  source pixel. Chromium performs viewport sampling: either-axis
  minification stays smooth, while both axes at `2` or more screen pixels use
  pixel-preserving sampling for image elements, resident canvases, exact tiles,
  preview canvases, and live working surfaces. The footprint follows the
  transform chain of the Raster's current render surface, including transient
  aggregate-resize scale exactly once.
- Full-resolution source selection begins at the same `2` px magnification
  threshold, before the `5` px pixel-grid threshold. Crossing the grid
  threshold therefore changes only the overlay, and a visible grid never uses
  a low-resolution Raster preview.
- Browser raster primitives live behind the brush runtime seam. Canvas creation,
  image decode, frame scheduling, and render-ready events are runtime services;
  brush policy calls the seam instead of reaching directly for DOM globals.
- Brush target selection lives in the brush target resolver. It reads the
  persistent active layer, asks node capabilities for source kind, then locks a
  finite Raster or Frame without inspecting pixels under the pointer.
- Pointer-down creates a deferred gesture. Surface resolution, layer
  materialization, pixel allocation, and the history mark wait until the
  gesture first intersects the locked finite target.
- The stroke session owns sampled points, dirty bounds, working-surface
  mutation, commit scheduling, and history completion for one active stroke.

### Resident Canvas2D Surface

The browser injects a Canvas2D Raster resolver when it constructs `Editor`.
React prepares existing, single-payload image nodes and mounts the adapter's
stable canvas in the node render tree. The engine resolves that surface by
finite target id, pixel dimensions, and optional writable bounds; it does not
import DOM or Canvas types. The resident presentation stays mounted when Crop
changes the visible frame around its base pixels.

The initial resident path supports Hard Round paint and alpha-subtractive
Eraser only. Stroke commit reports dirty pixels synchronously and releases the
tool without PNG encoding. Source replacement, dirty-region history,
autosave/package persistence, presets, and tiled-runtime cutover belong to
their owning follow-up layers.

## Durable Model

Image nodes reference raster assets instead of storing image bytes inline.

```ts
type ImageNode = {
  type: "image";
  assetId: string;
  width: number;
  height: number;
};
```

Pixel content belongs to a raster asset. A raster asset may be a single image
payload or a tiled payload. Active working surfaces are runtime buffers and are
not saved directly.

## Tool Interaction

The engine owns active raster tool identity, mutable tool options, target
resolution, and commit target.

```ts
type BrushToolState = {
  tool: "brush";
  brushColor: string;
  brushOpacity: number;
  brushSize: number;
  hardness: number;
  spacing: number;
};

type BrushInteraction = {
  nodeId: string;
  tool: "brush" | "eraser";
};
```

React reads this state and renders the matching action bar affordance, tool
options in the properties panel, cursor, and active working raster surface.
Pointer movement mutates the working surface directly. Active strokes do not
rewrite durable node geometry. Pointerup finalizes dirty working pixels into
assets and creates one history entry.

Brush and Eraser remember separate option sets. Switching between `b` and `e`
restores each tool's own size, opacity, hardness, and spacing. Brush color is
stored with Brush settings; Eraser ignores color.

## Brush Engine

Brush strokes use one brush engine. The stroke engine owns sampled pointer
points, spacing, radius, hardness, opacity, dab coverage, dirty bounds, and
buffer mutation.

Brush paints the active color into covered pixels using brush opacity and
hardness. Eraser uses the same sampled dabs and coverage math, but reduces
pixel alpha instead of adding color.

Hardness uses a smooth radial dab mask. `100%` hardness is a solid circle with
a one-pixel antialias edge. Lower hardness values reduce the solid center,
soften the edge, lower peak dab coverage, and sample the stroke more densely so
soft brushes do not reveal individual stamp rings.

Paint and erase compositing accumulates in float RGBA during the active stroke.
The canvas byte buffer is the output projection. Repeated low-alpha soft dabs
therefore follow source-over math instead of depending on sub-byte rounding.

## Target Resolution And Layer Materialization

Brush resolves the active layer once at pointer-down. Transform selection and
hover never retarget an active Stroke. Target resolution uses source-kind
capabilities instead of React branches on node type.

| Target kind | Behavior |
| --- | --- |
| Active writable Raster | Lock it for the Stroke; resolve its surface only after first intersection. |
| Active empty layer in a Frame | Materialize it after first Frame intersection. |
| Active Frame | Create one child Raster after first Frame intersection. |
| Empty document, incompatible, hidden, or locked active layer | Disabled cursor and no-op. |
| Eraser without an active writable Raster | Disabled cursor and no-op; Eraser never creates or materializes. |

An outside-only gesture does not open a working surface, materialize a node, or
create a history seam. After first intersection, all Dab and pixel work remains
clipped to the locked target.

## Pixel Buffers

- Active brush strokes decode the selected image's current raster asset into a
  working surface. Single payloads decode into one canvas; tiled and
  over-dense paint strokes mutate only touched 512 px logical tiles.
- Pointer moves update canvas or tile working buffers and the raster renderer
  displays those same buffers without per-frame PNG encoding.
- Pointerup encodes changed dirty tiles or the changed single raster payload and
  writes the updated asset record.
- Brush-created layers start as a bounded raster payload around the first dab.
- Paint strokes that leave a brush-created payload expand the canvas and pin
  existing pixels to the same world position.
- Existing unclipped raster layers preserve their raster plane when a stroke
  commits. Width, height, transform, base dimensions, and rotation remain node
  metadata; brush commits do not trim them to the latest alpha bounds.
- Raster payloads parented to a Frame are clipped before Dab generation and
  pixel work. Invisible off-Frame drag distance does not grow the backing
  bitmap or generate unbounded work.
- Eraser clips to the existing raster plane and does not grow the layer by
  erasing transparent space.
- Large-operation thresholds may move encode and decode into a worker without
  changing the engine API.

PNG is the default edited-raster payload because it is lossless, alpha-capable,
browser-native, and inspectable. Imported JPEG assets can remain in their
original payload until a pixel edit creates a new current raster asset.

## Tiled Runtime

Large raster layers use tiled package storage. The image node remains one
logical layer, while the raster asset manifest owns tile size, tile rects, and
tile refs. The renderer can draw hydrated tile sources directly, and the worker
can composite dirty regions without allocating or encoding the full layer.

Large or visually over-dense Brush paint strokes use a tiled runtime surface
immediately. Density is based on raster pixels per visible screen pixel, so a
layer shown very small can use dirty working tiles even when its committed
payload is a small single PNG. Each working tile stores a 2 px pixel gutter past
the logical tile edge, so anti-aliased brush pixels overlap adjacent tiles
instead of baking visible tile gaps into committed PNG data.

Hard, opaque strokes use the browser canvas stroke shortcut per tile
intersecting the stroke path. Soft, translucent, or spaced strokes use the same
dab coverage math as the normal Brush path, but with float RGBA buffers scoped
to each touched tile.

Dirty tile enumeration only returns existing touched tiles, so huge diagonal
strokes do not materialize the surrounding empty rectangle as a commit payload
or transient canvas. Large dirty-tile commits encode tile sources in
frame-budgeted chunks after pointerup instead of monopolizing one synchronous
release event. Completed working surfaces stay mounted while async tile commit
is pending, even when the user starts the next stroke, so prior pixels do not
blink out before committed tile sources appear.

Sparse tile commits append new tile overlays instead of replacing prior
overlays for the same tile coordinate. That preserves earlier strokes when a
later stroke touches the same tile. Commits trim each dirty tile to painted
pixels, expand the image node's logical width and height to cover all raster
planes, and rebase tile and base-image offsets when paint grows left or upward.
Selection frames, properties, rendering, hit testing, save/load, and export read
those same logical bounds.

Committed tiled rasters mount only the tile images intersecting the current
viewport plus padding. The document still owns every tile source; viewport
culling only reduces live DOM work during pan and zoom.

Visually over-dense tiled rasters render through a low-resolution canvas
projection instead of thousands of individual tile image elements. The
projection is based on raster-local image space rather than the viewport cull
window, so panning does not shift or resample committed strokes. Active working
surfaces disable the LOD projection until committed pixels have rendered.

## History

Brush strokes commit as one history step per completed stroke.

| Action | History step |
| --- | --- |
| Brush stroke | One asset update for the completed stroke. |
| Eraser stroke | One asset update for the completed stroke. |

Pointermove updates do not create history entries or replace document assets.
The first Stroke's target creation or empty-layer materialization and its
pixels share one logical change seam.

## Crop

Crop stores a transient node-local rectangle outside durable document state.
Commit adjusts the image node's logical width, height, base offsets, and
transform so retained source pixels stay at the same world position. Source
pixels and resident Canvas2D dimensions remain unchanged. Cancel discards the
session; a changed commit is one history step.

## Export

Export resolves image nodes in this order:

1. Load current raster asset.
2. Apply node transform, opacity, parent opacity, visibility, and artboard crop.
3. Encode or serialize for the requested output format.

Alpha-capable exports preserve transparency. JPEG export flattens transparent
pixels against the selected export background.

## Reference

libmypaint is the reference for dab generation, spacing, hardness, opacity, and
brush engine vocabulary. PunchPress does not adopt libmypaint as a runtime
dependency for the first Brush implementation.

## Related

- [Image editing](../product/image-editing.md)
- [Image nodes](../product/image-nodes.md)
- [Raster engine contracts](../reference/raster-engine-contracts.md)
- [Punch package](../reference/punch-package.md)
- [Export pipeline](export-pipeline.md)
