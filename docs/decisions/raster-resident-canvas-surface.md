---
summary: Records the stable full-resolution Canvas2D authority for Raster editing and the intentional break from tiled prototype persistence.
read_when:
  - changing Raster editing surfaces, Brush or Eraser commit behavior, pixel history, save, reopen, export, or low-zoom previews
  - considering tiled Raster execution, working-to-durable handoff, or compatibility with prototype tiled .punch files
---

# Resident Canvas2D Raster Surface

Status: Accepted
Date: 2026-08-08

## Context

The tiled prototype split one Raster across editing tiles, committed resources,
LOD projections, and a typed presentation handoff. Pointer release therefore
became a visual transition and persistence work sat on the interaction path.
Finite product planes up to the existing area guard do not require that model.

## Decision

One resident Raster owns one stable, full-resolution Canvas2D surface.

- Brush and Eraser mutate that Canvas directly.
- The same Canvas remains visible and authoritative across pointer release.
- Pointer release captures an exact dirty-region history patch. It does not
  clone the full plane, encode PNG, or hand presentation authority elsewhere.
- Save, Scratchpad autosave, reopen, and export asynchronously snapshot the
  latest committed resident revision. An active Stroke's rollback strips mask
  its uncommitted pixels from concurrent snapshots without mutating the Canvas.
- Inactive surfaces may encode and evict, then lazily decode on activation.
- Low-zoom previews are disposable caches only. They never accept edits and
  never bridge working pixels to durable pixels.
- Frame children edit the stable Frame-local writable plane. Content bounds may
  remain tight while the writable plane stays fixed and finite.
- Ordinary object resize changes the Canvas-to-document geometry mapping, not
  the Canvas object or its pixels. Rendering, Brush targeting, Crop, save, and
  export consume that same mapping. Persisted intrinsic sample dimensions stay
  independent from resized geometry. Crop alone changes the visible source
  window without scaling it, and Save retains pixels outside that window.

RasterTileSurface execution, tile authoring, dirty-tile scheduling, tile LOD,
gutters, culling, and working-presentation acknowledgements are removed from
the editing path.

## Prototype Format Break

The tiled prototype `.punch` format is intentionally unsupported. `storage:
"tiled"`, tile refs, and runtime `tileSources` fail current validation or load.
PunchPress provides no migration, read adapter, compatibility hydration, or
legacy serialization path. Current Raster persistence is one payload per asset.

This is an accepted product-development format break, not an accidental schema
omission.

## Consequences

- Pointer release is a visual no-op and remains independent of encode latency.
- Pixel Undo and Redo operate on exact dirty patches while preserving Canvas
  identity.
- Memory use is proportional to resident finite planes plus bounded history
  patches. Surfaces still referenced by Undo or Redo stay resident until the
  document resets; inactive surfaces with a durable encoded source may evict as
  the cache pressure valve.
- Performance work benchmarks supported finite planes rather than introducing
  infinite or sparse Raster semantics.
