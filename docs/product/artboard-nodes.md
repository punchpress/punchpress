---
summary: Defines the artboard node family as named rectangular containers with size, background, lock, visibility, transform, child clipping, and export ownership.
read_when:
  - changing artboard node defaults, schema fields, property fields, clipping, hit testing, or export behavior
  - deciding whether behavior belongs to artboard product rules or the shared node model
---

# Artboard Nodes

Artboard nodes represent production surfaces.

- Artboards are named rectangular container nodes.
- They own width, height, optional background, lock state, visibility, and
  transform.
- Children are clipped to artboard bounds for editing and export.
- Artboard nodes can contain ordinary design nodes.
- Artboard export uses the node bounds as the crop boundary.

See [Artboards](artboards.md).
