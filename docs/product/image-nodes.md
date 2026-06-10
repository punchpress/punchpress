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
- Image nodes reference raster assets in the document asset table.
- Image node bounds come from explicit width and height values.
- Image node natural pixel dimensions belong to the raster asset.
- Brush-authored image nodes use the current non-transparent pixel bounds as
  their stored raster rectangle.
- Tiled image nodes may place base and tile payloads at local offsets inside the
  image bounds. Selection, properties, hit testing, rendering, and export use
  the logical image bounds, not the individual tile files.
- The properties panel exposes width and height controls for selected image
  nodes.
- Image nodes can be moved, resized, rotated, hidden, deleted, copied, and
  pasted like other canvas objects.

## Editing

- Image nodes do not support direct path or text editing.
- Image editing mode supports raster image editing for image nodes.
- Crop is node-local framing and does not rewrite pixels.
- Pixel edits write a new current raster asset for the image node.
- Masks are explicit image-node modifiers, not the default result of normal
  eraser or selection-delete tools.
- Users resize images through object transform handles or the image dimensions
  in the properties panel.

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
