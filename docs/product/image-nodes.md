---
summary: Defines raster image nodes as selectable bitmap-backed canvas objects with fixed bounds, dimensions, layer behavior, and export behavior.
read_when:
  - changing raster asset import, image node rendering, image node properties, image export, or image layer behavior
  - deciding whether imported PNG or JPG artwork should become editable vectors, image nodes, or unsupported content
  - debugging image bounds, dimensions, selection frames, layer labels, or exported image output
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
- Image node bounds come from explicit width and height values.
- The properties panel exposes width and height controls for selected image
  nodes.
- Image nodes can be moved, resized, rotated, hidden, deleted, copied, and
  pasted like other canvas objects.

## Editing

- Image nodes do not support direct path or text editing.
- Pixel-level image editing is out of scope for image nodes.
- Users resize images through object transform handles or the image dimensions
  in the properties panel.

## Export

- Export preserves image nodes as image-backed output.
- Image nodes should keep their visible bounds and transform in exported SVG.
- Raster source data remains opaque document content, not editable vector source.
