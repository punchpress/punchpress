---
summary: Defines artboards as PunchPress production surfaces, export boundaries, selectable containers, and first-class layer objects.
read_when:
  - changing artboard creation, selection, resize, containment, clipping, export, or layer behavior
  - updating New File presets or deciding how content enters or leaves an artboard
  - debugging exports that include the wrong bounds, background, or child content
---

# Artboards

Artboards are the production surfaces inside the open PunchPress canvas.

## Product Contract

- A document may contain one or more artboards and loose pasteboard content.
- Artboards define production and export dimensions; the surrounding canvas has
  no fixed document size.
- Artboards are rectangular, selectable, named, lockable, visible in layers,
  and editable through the properties panel.
- Artboards may have a background color or transparent background.
- Artboard width and height use explicit document-unit values.
- Users can rename, move, resize, duplicate, hide, lock, delete, align, and
  distribute artboards through the same editor command model used by other
  canvas objects.

## Containment

- An artboard is a container node.
- Nodes may live inside an artboard or directly on the pasteboard.
- Content inside an artboard is clipped to artboard bounds.
- Moving content into or out of an artboard reparents that content.
- Moving an artboard moves its children.
- Resizing an artboard changes the production surface without scaling children
  by default.
- Duplicating an artboard duplicates its child content and relative positions.
- Deleting an artboard must make child-content fate explicit: delete the
  content with the artboard or keep it by reparenting it to the pasteboard.

## Selection

- The artboard label selects and moves the artboard.
- Clicking empty artboard body selects the artboard.
- Dragging from empty artboard body starts marquee selection.
- Clicking visible content inside an artboard follows normal selection rules.
- A selected artboard shows its boundary and resize handles.
- Loose content and artboard content may participate in the same selection.

## Export

- Exporting a selected artboard uses the artboard bounds as the crop area.
- Export includes visible child content and excludes loose pasteboard content.
- Content outside artboard bounds is clipped.
- Background color is included when set; transparent artboards export with
  transparency.
- Export filenames default to the artboard name.

## Intentionally Missing

- Rotated, sheared, or non-rectangular artboards.
- Per-artboard guides, grids, bleed, or drawing scale.
- Multi-format export presets owned by artboards.
