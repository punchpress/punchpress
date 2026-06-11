---
summary: Captures the raster brush runtime architecture, reference-editor learnings, and the direct working-surface invariants for huge tiled strokes.
read_when:
  - changing raster brush working surfaces, tiled stroke commit, dirty-tile scheduling, or raster LOD behavior
  - debugging huge brush strokes that flash, shift, disappear, seam, or lag during pointerup, zoom, or pan
  - comparing PunchPress raster behavior against tldraw, MyPaint, Krita, or PhotoDemon-style rendering pipelines
---

# Raster Brush Runtime

This page describes the current working-surface runtime. The accepted
replacement is the [raster tile store pipeline](../decisions/raster-tile-store-pipeline.md),
migrated in stages by the [raster engine plan](raster-engine-plan.md). Do not
extend the working-surface handoff; build new raster behavior against the tile
store direction.

The raster brush runtime is a working-surface system:

| Surface | Owns |
| --- | --- |
| Stroke session | Sampled points, brush settings, target node, dirty region, history mark, and commit lifetime. |
| Working surface | Pixel mutation, dirty tile ownership, tile gutters, visible tile/canvas buffers, and commit payloads. |
| Raster renderer | Committed image/tile rendering, active working-surface rendering, viewport culling, LOD projection, and render-ready acknowledgement. |
| Brush cursor | Tool footprint chrome only. It does not own stroke pixels. |

Pointer moves write into the authoritative in-memory raster surface immediately.
The renderer draws that same surface while the stroke is active and while async
persistence is catching up. Pointerup finalizes the dirty surface into document
assets and creates one history entry. There is no SVG/vector live-stroke overlay
and no live-preview-to-raster handoff.

## Reference Findings

tldraw keeps transient drawing feedback in stable session records and renders
from those records until the tool intentionally retires them. The PunchPress
lesson is to keep active, completed, and retiring interaction state addressable
by one logical session identity instead of converting between unrelated visual
systems during pointerup.

libmypaint treats the brush as a producer of operations against a surface
interface. Its tiled surface batches operations per affected tile, processes the
dirty tile set, and reports invalidated rectangles at the end of an atomic
stroke. The PunchPress lesson is that dirty tiles are the natural edit unit.

Krita separates stroke jobs, paint devices, projections, level-of-detail work,
and tile-based undo transactions. Undo swaps old and new tile data rather than
replaying the brush. The PunchPress lesson is that durable commit, projection
invalidation, and working-surface lifetime are separate phases.

PhotoDemon uses a staged viewport pipeline: viewport-specific layer compositing
happens before final UI/tool chrome. The PunchPress lesson is that brush pixels
belong to raster surfaces, while cursor chrome belongs to the tool overlay.

## Invariants

- Brush content is always raster pixels. Brush and Eraser never author vector
  path data.
- Pointer moves mutate the working raster surface directly.
- Paint strokes use tiled working surfaces when the raster is large or visually
  over-dense. Density is based on raster pixels per visible screen pixel, not a
  fixed zoom number.
- Existing unclipped raster planes keep their intrinsic width, height,
  transform, rotation, and base frame when a stroke commits.
- Brush-created layers can start bounded around their first stroke.
- Artboard-child rasters clip to the artboard.
- Eraser uses the same brush engine and clips to the existing raster plane. It
  does not expand a layer by erasing transparent space outside the current
  pixels.
- Completed working surfaces remain mounted until the document has received
  updated tile sources and the raster renderer acknowledges that the matching
  committed render key has painted. The renderer waits for a short stable
  paint window after committed tile images load, because image `load` does not
  guarantee that a large SVG tile set is composited on screen. A time fallback
  only protects offscreen or unmounted renderer cases.
- Tile gutters are part of the tile surface contract. They prevent visual gaps
  between adjacent committed tile images and working tile canvases.
- Raster LOD previews are derived from committed raster/tile data. They do not
  own brush commit state.
- When a working surface exists for a raster node, that node's raster LOD
  preview yields and exact committed tiles remain mounted. The normal
  low-resolution projection resumes after the working surface retires.

## Runtime Flow

1. Pointer down resolves a raster target and opens one stroke session.
2. Pointer move appends points and flushes them into the working canvas or
   touched working tiles.
3. The raster renderer mounts the working canvas or working tiles inside the
   image node's normal render tree.
4. Pointerup flushes remaining points and starts commit.
5. Commit encodes dirty PNG tile sources or the dirty single raster payload.
6. The completed working surface stays visible until committed raster rendering
   acknowledges the matching render key.
7. The session retires and undo/redo treats the stroke as one history step.

## Debug Capture

In development, raster brush activity records a bounded timeline on
`window.__PUNCHPRESS_RASTER_DEBUG__`. The capture includes brush session
events, tile commit transitions, render-ready handoff events, raster DOM state,
and frame samples while a stroke or handoff is active. Use
`window.__PUNCHPRESS_RASTER_DEBUG__.clear()` before a repro and
`window.__PUNCHPRESS_RASTER_DEBUG__.snapshot()` after the repro to inspect the
timeline.
