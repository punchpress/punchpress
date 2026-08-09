---
summary: Defines finite Raster targets, Stroke and Dab semantics, stable surfaces, exact patch commits, presets, and fidelity fixtures.
read_when:
  - implementing Brush or Eraser Stroke generation, Canvas2D surface adapters, dirty-patch history, clipping, or cancellation
  - adding native Brush presets or changing document-space smoothing and Dab spacing
---

# Raster Engine Contracts

The engine owns finite Raster Stroke semantics. Hosts implement pixel mutation
behind `RasterSurface`; engine code does not import DOM or Canvas types.

## Coordinates And Targets

- Points, Dab centers, Dab size, bounds, and writable polygons use document or
  Raster-local units as declared by the target projection.
- Inputs must be finite. Segments are clipped to the writable plane expanded by
  Dab radius before smoothing and spacing.
- `RasterTarget` locks one id, finite bounds, exact pixel dimensions, optional
  writable bounds, and optional transformed Frame polygon for the whole Stroke.
- Frame children use the complete Frame-local writable plane. Standalone
  Rasters use their finite saved writable rectangle or image rectangle.
- Viewport zoom and Workspace size are absent from this API.

## Stroke Lifecycle

1. `createRasterStroke` snapshots operation, settings, and target.
2. `RasterSurface.beginStroke(context)` opens one surface session.
3. Initial and appended points generate distance-spaced Dabs.
4. `commit()` returns the target id, exact pixel dirty union, and an optional
   reversible pixel patch.
5. `cancel()` restores transient mutations and creates no durable revision.

A completed or cancelled Stroke rejects further mutation. One Stroke cannot
retarget or change between paint and erase.

## Surface Boundary

| Operation | Contract |
| --- | --- |
| `applyDabs(dabs)` | Mutate the authoritative surface and clip again at the adapter boundary. |
| `commit()` | Finalize one dirty-region patch; do not encode or replace presentation. |
| `cancel()` | Restore exact pre-Stroke pixels. |

The browser Canvas2D adapter resolves one stable full-resolution surface by
target id and dimensions. It paints that Canvas directly, captures before and
after dirty rectangles as Canvas copies, and notifies the renderer. Commit does
not call `getImageData`, `putImageData`, PNG encoding, or a presentation
handoff. Undo and Redo mutate the same Canvas with the returned patch.

The renderer may derive disposable low-zoom projections, but they do not
implement `RasterSurface` and are never editing or persistence authority.

## Settings And Presets

Settings include color, size, opacity, flow, hardness, spacing, angle,
roundness, smoothing, scatter, size jitter, angle jitter, a 32-bit seed, and a
round or sampled tip descriptor. Native preset format is
`punchpress-raster-brush`, version `1`. Built-ins are Hard Round, Soft Round,
Ink, Pencil, Marker, Chalk, Grain, and Pixel.

Spacing and smoothing are document-space size multipliers. Effective spacing
has a one-unit floor. Hard tips use full size-scaled spacing; soft tips reduce
spacing to avoid visible rings.

## Fidelity Fixtures

`packages/engine/fixtures/raster-fidelity-v1.json` defines exact Hard Round,
soft, sampled, erase, spacing-residual, and zoom-invariant Dab cases. The
headless operation recorder exercises the same engine contract without browser
pixels.

## Related

- [Raster image editor](../internals/raster-image-editor.md)
- [Resident Canvas2D decision](../decisions/raster-resident-canvas-surface.md)
- [Coordinate spaces](coordinate-spaces.md)
