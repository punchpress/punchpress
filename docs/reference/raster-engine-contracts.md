---
summary: Defines finite Raster Stroke inputs, Dabs, targets, surface sessions, commits, native presets, and fidelity fixtures.
read_when:
  - implementing Brush or Eraser Stroke generation, Raster surface adapters, dirty-region commits, or cancellation
  - adding native Brush presets or changing document-space smoothing and Dab spacing
  - extending Raster fidelity fixtures or comparing generated Dabs across adapters
---

# Raster Engine Contracts

The engine owns finite Raster Stroke semantics. Host renderers implement pixel
mutation behind `RasterSurface`; engine code does not depend on DOM, Canvas2D,
WebGPU, encoded images, package storage, or Workspace dimensions.

## Coordinates And Targets

- Stroke points, Dab centers, Dab size, and target bounds use document units.
- Stroke points require finite coordinates. Invalid append batches fail before
  mutating generator state.
- Spacing and smoothing settings are size multipliers. Their derived distances
  are document-space distances.
- Effective Dab spacing has a one-document-unit floor. Hard tips use the full
  size-scaled spacing; softer tips reduce it toward one quarter so their falloff
  does not reveal stamp rings. A zero spacing setting uses the floor.
- A `RasterTarget` locks one finite target id, document bounds, and pixel
  dimensions for the full Stroke.
- Pixel allocation belongs to the surface adapter and is bounded by the target
  and dirty region, never by the Workspace.
- Viewport zoom does not enter the Raster API. Clients convert pointer input to
  document points before starting or appending a Stroke.

## Stroke Lifecycle

1. `createRasterStroke` snapshots the target, operation, and settings.
2. The surface opens one session with that immutable context.
3. The initial point emits a Dab, including for a click without movement.
4. Appended document points produce distance-spaced Dabs. Residual distance
   carries across append calls.
5. `commit` finalizes pending smoothing output and returns the target id plus an
   optional pixel dirty region.
6. `cancel` closes the session without a durable commit.

A completed or cancelled Stroke rejects further mutation. One Stroke never
changes target or switches between `paint` and `erase`.

## Surface Boundary

`RasterSurface.beginStroke(context)` returns a session with three operations:

| Operation | Contract |
| --- | --- |
| `applyDabs(dabs)` | Apply transient Dabs to the locked working surface. |
| `commit()` | Make the session durable and report its clipped pixel dirty region. |
| `cancel()` | Discard transient work without a durable change. |

The headless operation recorder implements this boundary for engine-contract
tests. Browser rendering and persistence adapters remain separate consumers.

### Canvas2D Adapter

The browser adapter implements the same boundary for an existing
single-payload Raster:

- the injected runtime resolves a resident surface by target id and exact pixel
  dimensions;
- one stable canvas is both authoritative working memory and the presented node
  surface;
- Hard Round paints with native paths and Eraser uses `destination-out`;
- transient rollback is captured as native dirty-rectangle canvas copies and
  restored in reverse on cancel;
- commit returns the clipped union dirty region without readback or encoding.

The adapter rejects non-round or non-hard Dabs in this vertical surface. It
never calls `getImageData`, `putImageData`, or PNG encoding while a Stroke is
active.

## Brush Settings And Presets

Stroke settings contain color, size, opacity, hardness, spacing, smoothing, and
a round or sampled tip descriptor. Sampled tips use an opaque native `sampleId`;
the engine contract does not carry sample bytes or encoded image types.
Size must be positive; spacing and smoothing must be non-negative; opacity and
hardness stay between zero and one. Invalid numeric settings fail before input
processing begins.

Native presets use format `punchpress-raster-brush` and version `1`. Presets
store default settings except color so choosing a preset does not replace the
active paint color.

## Fidelity Fixtures

`packages/engine/fixtures/raster-fidelity-v1.json` owns the version-1 contract
cases for hard, soft, sampled, erase, spacing-residual, and zoom-invariant
input. Every case contains document-space input variants and exact expected
Dabs. Exact and explicit-tolerance comparison helpers report field-level
differences without depending on a test framework.

## Related

- [Raster image editor](../internals/raster-image-editor.md)
- [Coordinate spaces](coordinate-spaces.md)
- [Tool events](tool-events.md)
