---
summary: Defines PunchPress Brush and Eraser tool behavior, empty-layer materialization, brush options, and raster asset commits.
read_when:
  - changing Brush or Eraser tool behavior, brush options, empty-layer materialization, or raster layer painting
  - deciding how raster tools appear in the action bar and how they create or target raster content
  - debugging a brush stroke that applies to the wrong layer, creates the wrong source kind, or writes the wrong raster asset
---

# Image Editing

Image editing starts with Brush and Eraser. Raster tools live in the normal
action bar and behave like other editor tools: each stroke commits its own
undoable action.

## In The Product

- **Brush.** Users paint raster pixels with the active brush color and brush
  options.
- **Eraser.** Users remove raster pixels with the active brush size, opacity,
  hardness, and spacing.
- **Brush cursor.** Raster tools show a brush-size cursor over the canvas so the
  user can see the dab footprint before and during a stroke.
- **New Layer.** Users create a normal new layer. The layer has no source kind
  until the first content action.
- **Layer materialization.** A brush stroke on an empty layer materializes that
  layer as raster content.
- **Bounded new raster layers.** Brush-created layers start with the rectangle
  that contains painted pixels. Strokes expand the layer when needed.
- **Stable existing raster planes.** Existing image layers keep their width,
  height, transform, rotation, and base raster plane while Brush and Eraser
  update pixels.
- **Auto layer creation.** If Brush starts with no compatible selected layer,
  PunchPress creates a new layer and materializes it as raster content on the
  first stroke.
- **Export.** Export preserves transparency when the chosen format supports it
  and flattens against a chosen background when it does not.

## Action Bar

Brush and Eraser are normal action bar tools. Selecting either tool does not put
the editor into a separate modal image-editing toolbar. Undo and redo remain the
commit and recovery model.

The Brush action bar button selects Brush. The Eraser action bar button selects
Eraser. Eraser variants, such as Background Eraser, belong under the Eraser slot
when they exist.

## Tool Options

Brush and Eraser expose their parameters in the properties panel while the tool
is active, even when no layer is selected. These controls are tool properties,
not action bar items and not selected-layer properties.

| Option | Behavior |
| --- | --- |
| Brush color | Controls painted pixel color. |
| Brush size | Controls brush radius. |
| Brush opacity | Controls painted pixel opacity. |
| Hardness | Controls brush edge falloff. |
| Spacing | Controls the distance between brush dabs. |

Eraser uses the same Size, Opacity, Hardness, and Spacing controls as Brush.
Brush color is hidden for Eraser.

## Tool Rules

- **Brush stroke.** Dragging paints the active brush color into the current
  raster working surface while the pointer moves.
- **Eraser stroke.** Dragging removes alpha from the current raster working
  surface using the same brush engine as Brush.
- **Raster layer.** A brush stroke on a selected image node updates that node's
  current raster asset, even when the stroke starts outside the node's current
  trimmed bounds.
- **Empty layer.** A brush stroke on an empty layer turns that layer into a
  raster image node and writes the first stroke into its raster asset.
- **No target.** A brush stroke with no compatible target creates a new layer,
  materializes it as raster content, and writes the stroke.
- **Bounds.** Brush-created layers can grow from their painted pixels. Existing
  raster layers preserve their intrinsic pixel plane; paint does not shrink the
  layer to the latest stroke, and Eraser does not expand a layer by erasing
  transparent space.

## Layer Materialization

Users do not choose between raster and vector layers. New layers start empty.
The first content action sets the source kind.

| First action | Result |
| --- | --- |
| Brush or Eraser stroke | Raster image layer. |
| Shape, Pen, or vector action | Vector content. |
| Text action | Text content. |

Empty layers can be renamed, reordered, hidden, selected, and deleted. Empty
layers do not export.

## Out Of Scope

- Background Eraser.
- Rect Select, Lasso, Magic Wand, and selection delete.
- Crop.
- Masks.
- Rasterize prompts for existing vector, text, group, or artboard content.
- Imported brush presets, textured brushes, and Photoshop-style brush packs.

## Related

- [Image nodes](image-nodes.md)
- [Punch package](../reference/punch-package.md)
- [Raster image editor internals](../internals/raster-image-editor.md)
