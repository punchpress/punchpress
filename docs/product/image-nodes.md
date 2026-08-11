---
summary: Defines raster image nodes as selectable bitmap-backed canvas objects with asset references, crop and mask behavior, dimensions, layer behavior, and export behavior.
read_when:
  - changing raster asset import, image node rendering, image node properties, image export, or image layer behavior
  - deciding whether imported PNG or JPG artwork becomes editable vectors, image nodes, or unsupported content
  - debugging image bounds, dimensions, crop, masks, selection frames, layer labels, or exported image output
---

# Image Nodes

Image nodes represent raster artwork in a PunchPress document.

## Contract

- Image nodes are first-class canvas objects with identity, layer behavior,
  visibility, transform, and object-level selection.
- Image nodes preserve their bitmap source instead of converting pixels into
  editable vector paths.
- PNG and JPG asset imports create image nodes.
- Dragging PNG or JPG files from the OS onto the canvas creates image nodes.
- Import uses the browser-decoded, orientation-corrected natural pixel size for
  both node geometry and the resident Canvas. A `2000 × 2000` source therefore
  enters the document as a `2000 × 2000` Raster, never as a viewport-sized copy.
- The first Raster in an empty document may fit and center by moving the camera.
  Import beside existing content preserves the current camera.
- Image nodes reference raster assets in the document asset table.
- Image node bounds come from explicit width and height values.
- Image node natural pixel dimensions belong to the raster asset.
- Brush-authored image nodes use the current non-transparent pixel bounds as
  their stored raster rectangle.
- Each image node resolves one current Raster payload. While resident, one
  stable full-resolution Canvas is its editing and presentation authority.
- The properties panel exposes integer width and height controls with a visible
  aspect-ratio lock enabled by default.
- Image nodes can be moved, resized, rotated, hidden, deleted, copied, and
  pasted like other canvas objects.

## Editing

- Image nodes do not support direct path or text editing.
- Image editing mode supports raster image editing for image nodes.
- Crop is node-local framing and does not rewrite pixels.
- Crop trim retains hidden source pixels; Crop extension exposes transparent
  area without moving or resampling existing pixels.
- Imported-image bounds remain fixed during Brush and Eraser. Only Crop changes
  their visible raster plane.
- Pixel edits commit immediately in the resident Canvas; save and export
  asynchronously write or consume the new current Raster payload.
- Masks are explicit image-node modifiers, not the default result of normal
  eraser or selection-delete tools.
- Users resize images through object transform handles or the image dimensions
  in the properties panel.
- Resize input stays live through a transformed preview. Commit resamples the
  resident Raster once; a slow commit disables dimensions, lock, handles, and
  painting and shows `Resizing…` only after about 150 ms.
- Resize is destructive from the current resident plane. PunchPress does not
  retain a separate original-source or Smart Object representation; Undo is the
  exact recovery path for the previous pixels and geometry.

## Export

- Export preserves image nodes as image-backed output.
- Image nodes keep their visible bounds and transform in exported SVG.
- Raster source data remains opaque document content, not editable vector
  source.
- Export applies crop and explicit masks before output encoding.
- Alpha-capable exports preserve transparent pixels. JPEG export flattens
  transparent pixels against the selected export background.

## Related

- [Image editing](image-editing.md)
- [Punch package](../reference/punch-package.md)
