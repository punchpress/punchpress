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

- **Layers.** Each fill or stroke layer has its own paint, opacity, and
  visibility. Strokes also have alignment, width, cap, join, and miter limit.
- **Alignment.** A stroke paints centered on the edge, inside the shape, or
  outside it, always at its full width. An outside stroke never shows through
  a translucent fill. Each letter of straight or circle text aligns against
  its own outline; warped text aligns against its merged outline.
- **Paint.** A layer paints a solid color or a linear gradient. A gradient has
  an angle and 2–8 stops, each with its own color and opacity. The ramp spans
  the whole object, including every letter of a text.
- **Order.** Outside strokes paint under fills; center and inside strokes
  paint over them. Within each group, the row at the top of the panel paints
  on top. Dragging rows reorders the stack.
- **Add and remove.** "Add fill" copies the top fill's color; "Add stroke"
  adds a 2 px black stroke. Removing the last layer leaves the node unpainted
  but still selectable by its area.
- **Opacity.** Layer opacity fades one layer. Node opacity (the Layer section)
  fades the whole node, all layers together.
- **Vectors.** Selecting a multi-path vector edits its child paths' stacks
  together.
- **Effects.** Text, shapes, paths, vectors, and groups take up to 4 drop
  shadows, each with color, opacity, X/Y offset, and blur. A new shadow is a
  hard 8/8 black shadow. Shadows paint in list order (top row first, under the
  object), rotate and scale with the object, and never take clicks. Selecting
  a path inside a vector edits the vector's shadows.
- **Selection colors.** Group and multi-selections list every distinct layer,
  gradient-stop, and shadow color with its opacity, including the selected
  groups' own shadows; editing one recolors every enabled layer, stop, or
  shadow that uses it, live while dragging the picker.

## Rules

- Colors are stored as opaque `#rrggbb`; transparency is layer or stop
  opacity.
- Switching a solid layer to linear fades its color out left to right;
  switching back keeps the first stop.
- Inside and outside are measured against the area the fill paints. A path
  made only of open contours has no inside, so its strokes paint centered and
  the panel says so.
- The edge where an aligned stroke meets its shape can show a faint
  antialiasing seam.
- Open contours fill with SVG's implicit closure on canvas and in export.
- Multi-selections edit together only when their stacks match (apart from
  internal layer ids). Otherwise the panel shows **Mixed** with **Use first**,
  which copies the first selected stack onto the rest.
- Each panel edit, including a full scrub, is one undo step.
- New text starts with one black fill and no stroke.
- Documents saved before stacks existed open with their fill and stroke as
  one layer each.

## Intentionally Missing

- Radial gradients and on-canvas gradient handles.
- Offset Path / Outline Stroke (baking an offset or outlined shape).
- Blend modes, dashes, and per-character styling.

## Related

- [Appearance stack decision](../decisions/appearance-stack.md)
- [Properties](properties.md)
- [Schema versioning](../reference/schema-migration.md)
