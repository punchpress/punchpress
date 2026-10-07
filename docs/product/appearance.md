---
summary: Defines the appearance stack users edit on text, shapes, and paths — ordered fill and stroke layers, layer visibility and opacity, node opacity, mixed selections, and selection colors.
read_when:
  - changing how fills, strokes, layer order, layer visibility, or node opacity behave for users
  - debugging a stack that edits, reorders, or reads as mixed differently than expected
  - adding a paint kind, stroke option, or effect to the appearance panel
---

# Appearance

Every text node, shape, and path paints with an ordered **appearance stack**:
a list of fills and a list of strokes. A node can have no layers, one of each,
or several (up to 8 per list), for example a thin black stroke over a thick
white outline.

## In The Product

- **Layers.** Each fill or stroke layer has its own color, opacity, and
  visibility. Strokes also have width, cap, join, and miter limit.
- **Order.** Fills paint under strokes. Within each list, the row at the top
  of the panel paints on top. Dragging rows reorders the stack.
- **Add and remove.** "Add fill" copies the top fill's color; "Add stroke"
  adds a 2 px black stroke. Removing the last layer leaves the node unpainted
  but still selectable by its area.
- **Opacity.** Layer opacity fades one layer. Node opacity (the Layer section)
  fades the whole node, all layers together.
- **Vectors.** Selecting a multi-path vector edits its child paths' stacks
  together.
- **Selection colors.** Group and multi-selections list every distinct layer
  color; editing one recolors every visible layer that uses it.

## Rules

- Colors are stored as opaque `#rrggbb`; transparency is layer opacity.
- Strokes are center-aligned.
- Open contours fill with SVG's implicit closure on canvas and in export.
- Multi-selections edit together only when their stacks match (apart from
  internal layer ids). Otherwise the panel shows **Mixed** with **Use first**,
  which copies the first selected stack onto the rest.
- Each panel edit, including a full scrub, is one undo step.
- New text starts with one black fill and no stroke.
- Documents saved before stacks existed open with their fill and stroke as
  one layer each.

## Intentionally Missing

- Gradients, inside/outside stroke alignment, and drop shadows (staged; see the
  [appearance stack decision](../decisions/appearance-stack.md)).
- Blend modes, dashes, and per-character styling.

## Related

- [Appearance stack decision](../decisions/appearance-stack.md)
- [Properties](properties.md)
- [Schema versioning](../reference/schema-migration.md)
