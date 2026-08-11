---
summary: Defines Brush, Eraser, Crop, finite Raster targeting, resident Canvas ownership, history, persistence, and export.
read_when:
  - changing Brush, Eraser, Crop, Raster targeting, Frame clipping, content bounds, history, save, reopen, or export
  - deciding whether Raster behavior belongs in the engine, Canvas2D runtime, React renderer, schema, or file pipeline
---

# Raster Image Editor

Raster editing is a finite engine behavior backed in the browser by one stable
Canvas2D surface per resident Raster.

## Product Model

An image node references one Raster asset payload. Its `width` and `height`
describe visible content. A standalone Raster may retain a larger finite
`writable*` rectangle. A Frame child derives its writable plane and clip polygon
from the owning Frame, independent of tight content bounds.

Imported JPEG or PNG payloads decode at their orientation-corrected natural
integer dimensions. Node geometry and the resident Canvas use that same sample
plane; viewport fitting changes only the camera. Payloads remain unchanged
until edited. Current edited payloads use one alpha-capable PNG asset. There is
no tiled storage, runtime tile source model, or hidden original-source plane.

## Targeting

Brush resolves the active layer at pointer-down and keeps it for the Stroke.

| Active target | Result |
| --- | --- |
| Writable Raster | Mutate its resident surface. |
| Empty layer in a Frame | Materialize it as a Raster at first intersection. |
| Frame | Create one child Raster at first intersection. |
| Hidden, locked, incompatible, or empty document | Disabled no-op. |
| Eraser without a writable Raster | Disabled no-op. |

The deferred gesture clips segments before Dab generation. Exiting and
re-entering the target continues the same Stroke without replaying the off-plane
distance. Eraser never creates or expands content.

## Editing Plane

The runtime decodes the asset once into the Raster's full finite writable plane.
Brush uses source-over; Eraser uses destination-out. Native and sampled presets
share the engine Dab stream. Zoom affects presentation sampling and the pixel
grid only, never editing coordinates or authority.

Frame clipping is applied in resident-surface pixel coordinates. Brush-created
Frame children may grow tight content bounds after a Stroke; the Canvas and
Frame-local writable plane remain stable. Imported Frame children also retain
source pixels beyond that writable plane so those pixels can re-enter the Frame
during a live geometry transform. The stationary Frame shell remains the
visibility boundary. Crop changes the visible/writable rectangle and retains
source pixels according to Crop geometry.

The resident surface records its source bounds. Ordinary Image resize previews
through transformed geometry, then resamples the full retained plane once into
an integer-size detached Canvas. The runtime publishes geometry and the new
resident surface atomically. Crop offsets the source window without introducing
a resize scale. A later enlargement starts from that committed plane, so pixels
discarded by a prior shrink return only through Undo.

Only one resize may target a Raster. New resize, document load/reset, deletion,
Undo, or Redo cancels pending publication. Failure retains the old surface and
geometry. Brush and Eraser reject a Raster while its resize is pending.

## Commit, History, And Dirty State

Pointer release finalizes exact before/after dirty patches and commits one
history step. It performs no PNG encoding and does not swap render resources.
Canvas identity and pixels therefore remain stable across release.

Raster-only history revisions participate in document dirty state even when the
synchronous JSON snapshot still contains the last encoded `src`. Undo and Redo
apply pixel effects and geometry changes together. A Raster resize stores its
old/new surface swap with its geometry change as one step.

## Persistence And Export

`serializeDocumentAsync` snapshots resident Rasters before packaging or
Scratchpad persistence. Export also awaits resident snapshots before resolving
image sources. The snapshot preserves the complete retained Canvas and its
source/sample geometry; SVG export clips that payload to the node's visible
bounds. These consumers see the latest completed Stroke without placing encode
latency on pointer release. Active first Strokes serialize the pre-materialized
document until commit.

Inactive surfaces may encode and evict as a bounded cache lifecycle. Reopen or
activation lazily decodes the one saved payload into a new resident Canvas.

## Related

- [Image editing](../product/image-editing.md)
- [Raster brush runtime](raster-brush-runtime.md)
- [Punch package](../reference/punch-package.md)
- [Resident Canvas2D decision](../decisions/raster-resident-canvas-surface.md)
