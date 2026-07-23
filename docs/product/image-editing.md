---
summary: Defines PunchPress Brush, Eraser, Raster targeting, bounds, materialization, and Crop behavior.
read_when:
  - changing Brush, Eraser, or Crop behavior, Raster targeting, bounds, materialization, or painting
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
- **Finite auto creation.** Brush creates a Raster only inside a visible,
  writable Frame under the targeting rules below. Workspace presses are
  disabled no-ops.
- **Crop.** Crop changes a Raster's visible bounds without deleting hidden
  pixels. Expansion adds transparent paintable area.
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
- **Selected Raster.** One selected visible, unlocked Raster is authoritative,
  even when the pointer starts over another layer. The Stroke locks that target
  until release.
- **Empty layer.** Brush materializes one selected visible empty layer only
  when it belongs to a writable Frame and the pointer starts inside that Frame.
- **Selected Frame.** Brush creates a Raster child only when the pointer starts
  inside that selected writable Frame.
- **No selection.** Brush creates a Raster in the topmost writable Frame under
  the pointer.
- **Invalid target.** Multiple selection, incompatible selected content,
  hidden or locked targets, and Workspace outside a finite Raster target show a
  disabled Brush cursor and do nothing.
- **Eraser.** Eraser requires a selected writable Raster. It never creates,
  materializes, or expands a Raster.
- **Bounds.** Brush-created layers can grow from their painted pixels. Existing
  raster layers preserve their intrinsic pixel plane; Brush and Eraser do not
  expand it. Crop expansion explicitly creates additional paintable area.
- **Frame clipping.** Frame bounds clip Stroke input before Dab generation or
  pixel work. Off-Frame drag distance does not allocate or paint.

## Layer Materialization

Users do not choose between raster and vector layers. New layers start empty.
The first content action sets the source kind.

| First action | Result |
| --- | --- |
| Brush stroke inside the layer's Frame | Raster image layer. |
| Eraser stroke | No materialization. |
| Shape, Pen, or vector action | Vector content. |
| Text action | Text content. |

Empty layers can be renamed, reordered, hidden, selected, and deleted. Empty
layers do not export.

## Crop

Crop is an isolated modal interaction for one selected Raster.

- Drag side or corner handles to trim or extend the visible bounds. Drag inside
  the bounds to move the fixed Crop rectangle.
- Trim and extension are non-destructive. Hidden source pixels remain available
  to a later expansion; newly exposed space is transparent.
- Existing pixels remain stationary in the Workspace. Crop does not scale,
  resample, rotate, or move source pixels.
- Crop preview lifts normal Frame clipping so retained pixels outside the Frame
  can guide the edit.
- Done or Enter commits one logical change. Escape restores the exact starting
  state. Clicking outside commits before the normal selection action continues.
- Pan and zoom remain available. Bounds are limited to 16,384 units per
  dimension and 100,000,000 square units.

## Out Of Scope

- Background Eraser.
- Rect Select, Lasso, Magic Wand, and selection delete.
- Masks.
- Rasterize prompts for existing vector, text, group, or artboard content.
- Imported brush presets, textured brushes, and Photoshop-style brush packs.

## Related

- [Image nodes](image-nodes.md)
- [Punch package](../reference/punch-package.md)
- [Raster image editor internals](../internals/raster-image-editor.md)
