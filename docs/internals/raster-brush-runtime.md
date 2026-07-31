---
summary: Captures the finite resident Canvas2D Raster path, brush runtime boundary, and typed working-presentation invariants.
read_when:
  - changing resident Raster canvases, Canvas2D Stroke application, dirty regions, or cancel rollback
  - changing raster brush working surfaces, tiled stroke commit, dirty-tile scheduling, or raster LOD behavior
  - debugging huge brush strokes that flash, shift, disappear, seam, or lag during pointerup, zoom, or pan
  - comparing PunchPress raster behavior against tldraw, MyPaint, Krita, or PhotoDemon-style rendering pipelines
---

# Raster Brush Runtime

## Finite Canvas2D Path

Existing single-payload Raster nodes prepare one resident browser canvas through
an injected Raster runtime. That canvas decodes the hydrated source once,
implements the engine `RasterSurface` contract, and remains the node's presented
surface across Stroke begin, pointer movement, commit, and cancel.

- Canvas-entry strokes reuse the single selected eligible Raster target, so
  placement-preserved selection and explicit reselection share the same finite
  resident surface.
- Hard Round uses native Canvas2D paths when its settings preserve continuous
  path semantics. Smoothing changes path geometry; it does not force the
  standard opaque round brush through per-pixel Dab compositing. Native
  smoothing emits bounded geometry per input segment, independent of Dab
  spacing, so an extreme low-zoom pointer move cannot create tens of thousands
  of path vertices.
- Soft, transformed, sampled, scattered, and jittered tips use cached Canvas2D
  tip canvases and deterministic Dab stamping.
- Large, tiled, cropped, and not-yet-resident Rasters use the same path-or-Dab
  decision through their working canvas or tile surface. A Hard Round path
  clipped by its finite Raster plane stays entirely native; the surface owns
  the edge and no boundary Dabs are generated. Other writable polygons clip
  native runs to their safe interior and advance a canonical Dab generator
  alongside the path, rejecting interior centers before materializing Dabs.
  Only Dabs whose tips intersect the writable boundary reach the pixel
  compositor. Touching an edge never drops the valid interior segment, replays
  prior points, or permanently changes the rest of the held stroke to Dab
  compositing.
- Eraser uses the same Dabs with `destination-out`.
- Each Dab batch captures its affected pixel rectangle through native
  `drawImage`; cancel replays those patches in reverse.
- Commit returns the union pixel dirty region. It does not encode or replace the
  node source.
- Pointer movement does not use JavaScript pixel loops, `getImageData`,
  `putImageData`, or encoded-image handoff.
- Magnified exact-sample projections subscribe directly to resident canvases
  and working-tile mutations, then coalesce backing refreshes to one per
  animation frame.
- Connected working-tile canvases mutate without React notification. A newly
  touched tile publishes one structural update synchronously so its canvas is
  mounted for the same presentation frame.

Target creation, empty-layer materialization, tiled Raster behavior, history
deltas, persistence, and export remain outside this resident-surface path.

The raster brush runtime is a working-surface system:

| Surface | Owns |
| --- | --- |
| Stroke session | Sampled points, brush settings, target node, dirty region, history mark, and commit lifetime. |
| Working surface | Pixel mutation, dirty tile ownership, tile gutters, visible tile/canvas buffers, and commit payloads. |
| Working presentation | Per-node ordered groups, stable identity, lifecycle phase, node-local matrix, visible content, and durable replacement identity. |
| Raster renderer | Committed image/tile rendering, working-presentation rendering, viewport culling, LOD projection, and typed replacement acknowledgement. |
| Brush cursor | Tool footprint chrome only. It does not own stroke pixels. |

Pointer moves retain the browser's coalesced samples and write them into the
authoritative in-memory raster surface in order. The renderer draws that same
surface while the stroke is active and while async persistence is catching up.
Pointerup finalizes the dirty surface into document assets and creates one
history entry. There is no SVG/vector live-stroke overlay or path replay. Tiled
persistence records the exact replacement resources on the working group. The
renderer derives one atomic choice per group: keep its working pixels, or show
all drawable replacement resources and acknowledge that exact commit.

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
- Native built-ins are immutable data. Each tool owns an independent temporary
  settings copy and deterministic seed.
- Pointer moves mutate the working raster surface directly.
- Brush placement retains coalesced pointer samples instead of replacing a
  curved input run with its last event for the presentation frame.
- Paint strokes use tiled working surfaces when the raster is large or visually
  over-dense. Density is based on raster pixels per visible screen pixel, not a
  fixed zoom number.
- Frame-child surface selection measures the stable Frame-local writable plane,
  not the Raster's current tight content bounds. A large writable plane starts
  on sparse working tiles so distant same-stroke input does not reallocate and
  copy a growing monolithic canvas.
- Existing Raster payloads stay anchored when a stroke commits. Content bounds
  expand only when paint reaches writable transparent space.
- Brush-created layers keep tight content bounds around painted pixels for
  selection, hit testing, and layer export.
- Frame-child Rasters derive writable bounds from the Frame, independent of
  content bounds and backing allocation. Their DOM presentation plane stays
  Frame-sized across strokes, so painting never resizes or repositions the
  live surface. The transparent part of that plane is not a selection hit
  target. Frame clipping remains authoritative when child content or
  transforms overflow.
- Standalone Rasters use a finite persisted writable canvas; only Crop changes
  its extent. Brush tips are clipped to that canvas before plane-expansion
  policy is evaluated, so an edge stroke cannot turn a standalone Raster into
  an expanding layer. Leaving and re-entering that canvas preserves canonical
  edge coverage without degrading later interior input.
- Eraser uses the same brush engine and clips to the existing raster plane. It
  does not expand a layer by erasing transparent space outside the current
  pixels.
- Input lifetime, durable commit readiness, and presentation readiness are
  separate. Each working group advances through `active`, `committing`, and
  `awaiting-presentation`; a typed `presentation-failed` state preserves
  working authority after bounded resource-decode failure.
- Every group keeps one stable id and sequence. Multiple groups for one Raster
  remain ordered and retire independently; no aggregate surface or synthetic
  joined id reconstructs their state. A newer full-node Canvas snapshot
  visually supersedes earlier layers because it already contains them. Once
  accepted as visual authority, it atomically retires its sequence prefix so a
  slower older group cannot reappear.
- A completed group remains retained until the renderer reports the exact
  `{ nodeId, groupId, commitId }`. Wrong, stale, duplicate, or out-of-order
  acknowledgements are harmless.
- Tiled replacement becomes presentable only when every resource id recorded
  for that commit is drawable and the viewport-selected representation for the
  exact committed revision is ready. At low zoom, the matching LOD preview
  builds invisibly and the renderer swaps directly from working pixels to that
  preview. At high zoom, exact tiles remain the replacement. The two
  representations never overlap, and neither may be absent.
- Presentation readiness is resource-driven. Timers, global DOM events,
  render-key parsing, and DOM inspection do not determine correctness.
- A follow-up Stroke locks its pointer-down Raster. Standalone Rasters that may
  rebase still wait for the earlier tiled commit's renderer handoff before
  resolving the next local coordinate plane. If replacement decode exhausts
  its bounded retries, the exact handoff enters `presentation-failed`; working
  pixels remain authoritative and queued input settles without painting from
  the undecodable durable source.
- Frame-child Rasters use the stable Frame-local writable plane. Their
  follow-up Stroke waits only for the earlier durable commit, then paints while
  the earlier working surface finishes its renderer handoff. Pointer samples
  received during a required wait are retained and replayed in order.
- Tile gutters are part of the tile surface contract. They prevent visual gaps
  between adjacent committed tile images and working tile canvases.
- Raster LOD previews are derived from committed raster/tile data. They do not
  own brush commit state.
- Raster LOD previews retire at the `2` logical-screen-pixel magnification
  threshold, before the automatic grid appears above `5` px. Crossing the grid
  threshold changes only the overlay; full-resolution committed samples remain
  mounted while it is visible.
- A Raster LOD preview may replace stable exact committed tiles. Its readiness
  is bound to the current preview key; stale preview completion cannot retire a
  working group. Newer active working groups remain mounted above the ready
  committed preview.

## Runtime Flow

1. Pointer down locks the active finite Raster or Frame in a deferred gesture.
2. Pointer movement outside that target performs no surface resolution or
   allocation.
3. First intersection opens one Stroke session and appends clipped, coalesced
   points into the working canvas or touched working tiles.
4. The engine publishes an ordered per-node working group with explicit
   matrix, bounds, canvas-or-tile content, phase, and stable identity.
5. Pointerup flushes remaining points, changes the group to `committing`, and
   starts durable commit.
6. Commit encodes dirty PNG tile sources or the dirty single raster payload,
   allocates the exact replacement commit and resource ids, publishes that
   handoff metadata, then publishes the durable node resources.
7. The renderer preloads those resources and derives the atomic working-or-
   replacement layer for every group without inspecting browser DOM.
8. Once every resource for one commit is drawable, React renders its
   replacement and sends `acknowledgeRasterPresentation` with the typed
   identity.
9. The engine retires that matching group, or its superseded sequence prefix
   when the match is a full-node authority. Undo/redo treats the durable Stroke
   as one history step and invalidates obsolete working presentations.

## Debug Capture

In development, raster brush activity records a bounded timeline on
`window.__PUNCHPRESS_RASTER_DEBUG__`. The capture includes brush session
events, tile commit transitions, typed presentation acknowledgements, raster DOM state,
and frame samples while a stroke or handoff is active. Use
`window.__PUNCHPRESS_RASTER_DEBUG__.clear()` before a repro and
`window.__PUNCHPRESS_RASTER_DEBUG__.snapshot()` after the repro to inspect the
timeline.
