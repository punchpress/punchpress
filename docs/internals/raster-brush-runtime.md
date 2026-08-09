---
summary: Defines the finite stable Canvas2D Raster runtime, direct Stroke mutation, exact patch history, and asynchronous output boundary.
read_when:
  - changing resident Raster canvases, Canvas2D Stroke application, dirty patches, Frame clipping, surface caching, or pointer-release behavior
  - debugging Raster strokes that lag, shift, flash, duplicate, disappear, or change identity across pointer release
---

# Raster Brush Runtime

The browser injects one Canvas2D runtime into `Editor`. A resident Raster owns
one full-resolution Canvas. That Canvas is both editing memory and the rendered
source, so there is no working-versus-committed presentation transition.

## Ownership

| Layer | Responsibility |
| --- | --- |
| Engine Stroke runtime | Finite target lock, input clipping, Dabs, one history boundary, and content-bound updates. |
| Canvas2D runtime | Stable surface identity, decode, direct mutation, exact dirty patches, presentation subscription, snapshot, and cache lifecycle. |
| React renderer | Mount the resident Canvas and select crisp or smoothed sampling from zoom. |
| File/export clients | Await an encoded snapshot of the latest committed revision. |

Brush and Eraser share one active runtime. A Stroke locks one target and one
settings snapshot. Pointer samples are preserved, clipped to the finite target,
and forwarded in order. An outside-only gesture allocates nothing.

## Surface Lifecycle

Existing Rasters lazily decode into a Canvas sized to their finite writable
plane. A Frame child uses the complete Frame-local plane even when its visible
content is tight. Newly painted content expands node content bounds and shifts
the resident presentation bounds while keeping existing pixels pinned.

`resolveSurface` returns the same Canvas-backed surface while the Raster is
resident. React does not replace an authoritative preparation with a smaller
content-only decode. Source changes invalidate stale records. Targets leaving
the mounted editor may be encoded and evicted once no history entry depends on
their resident identity; activation decodes them again. Document reset releases
all retained surfaces.

The existing finite dimension and area guard is the allocation limit. Workspace
size and viewport zoom never expand a Raster plane.

## Stroke And History

Each Dab batch mutates the resident Canvas directly and notifies presentation
subscribers. The Canvas adapter clips both bounds and transformed Frame polygons
in surface pixel coordinates.

For every changed rectangle the adapter captures Canvas copies immediately
before and after mutation. Commit composes those rectangles into one reversible
history effect. Undo applies before-patches in reverse order; Redo applies
after-patches in order. No full-plane clone, pixel readback, or image encoding
occurs on pointer release.

Cancel restores the before-patches and leaves no history step. A completed
Brush or Eraser gesture produces exactly one target and one history step.

## Presentation And Output

Pointer release is a visual no-op: the same Canvas object and pixels remain
mounted and authoritative. Low-zoom previews, if introduced, are disposable
projections of the resident revision and cannot accept edits or become durable
authority.

Save, Scratchpad autosave, reopen materialization, SVG export, and Frame export
use the asynchronous document/output path. That path snapshots the latest
committed retained Canvas and encodes away from pointer release. Persisted
sample dimensions remain distinct from resized document geometry, while SVG
clipping keeps output bounds tight. During an
active Stroke, exact rollback strips replace uncommitted pixels in the snapshot
copy; the visible authoritative Canvas is never rolled back for persistence.

## Related

- [Raster image editor](raster-image-editor.md)
- [Raster engine contracts](../reference/raster-engine-contracts.md)
- [Resident Canvas2D decision](../decisions/raster-resident-canvas-surface.md)
- [Performance tests](../reference/performance-tests.md)
