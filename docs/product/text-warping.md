---
summary: Defines path-guided and inline text warps, including arch, wave, slant, circle, path edit mode, path-position handles, and warp-control ranges.
read_when:
  - changing arch, wave, slant, circle, path-position, or text path editing behavior
  - debugging warped text selection boxes, jitter, handle placement, tracking, or inside/outside circle text
  - deciding whether a warp should use inline controls or distinct path-editing mode
---

# Text Warping

Warped text remains a text node with normal node selection unless the user enters
a specific path-editing mode.

## Path-Guided Text

- A selected path-guided text node may show a subtle path preview.
- Path previews stay aligned while the node is transformed.
- Path editing is distinct from text editing.
- Circle warp enters path edit mode when first applied.
- Users can enter or leave path editing through a clear affordance and shortcut.
- While path editing, dragging the text moves the node.
- A dedicated path-position handle moves text along the path without moving the
  node.
- Moving text along a path must not make the path appear to drift or jitter.

## Circle Warp

- Applying circle warp from the default preset starts with a restrained sweep and
  a radius scaled to the text node.
- Text can sit outside or inside the circle without reversing order.
- Circle tracking uses the full UI range meaningfully without wrapping past a
  full-circle distribution.
- Extreme values clamp before text order inverts.
- Scrub controls recover quickly from out-of-range starting values.

## Inline Warps

- Arch, wave, and slant can stay inline on selection.
- Inline guides are centered through the text rather than anchored to the top.
- Wave defaults to restrained amplitude and clamps to at most three cycles.
- Inline controls support the intended expressive range in both directions.

## Handles

- Warp handle icons inherit node rotation.
- Circle path-position handles also follow path tangent.
- Static-position handles may show a subtle spring effect while dragging.
- Handles that move with the node during adjustment do not use the spring effect.
