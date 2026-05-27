---
summary: Defines SVG import behavior for menu imports, OS drops, grouping, naming, editable path conversion, placement, and unsupported fidelity.
read_when:
  - changing SVG drop, SVG menu import, group preservation, path conversion, naming, placement, or unsupported-feature handling
  - debugging imported artwork that flattens, lands in the wrong place, loses holes, or creates unexpected groups
  - deciding whether an SVG feature should become editable PunchPress source content or be skipped gracefully
---

# SVG Import

SVG import brings external vector artwork into PunchPress as editable document
structure. Imported SVGs should behave like native vector content, not like
opaque image assets.

## Import Paths

- Users can import SVG from the document menu.
- Users can drag a `.svg` file from the OS onto the canvas.
- Menu import centers artwork in the current viewport.
- Drop import centers artwork on the drop point.
- Imported SVG lands as one selected top-level group named `Imported SVG`.

## Structure

- Non-empty SVG groups are preserved as PunchPress groups.
- Supported SVG path artwork is converted to editable path nodes.
- Compound SVG paths import as one path node with multiple editable contours.
- Dense imported groups may use a cached canvas render surface in normal mode,
  but the cached surface is derived renderer state. It is not the document
  model and must not hide editable path rows when the group is expanded.

## Fidelity

- Normal canvas rendering may optimize dense or large imported groups as one
  compiled vector surface for panning, dragging, resizing, and rotating.
- Editing, layers, selection, save/load, and export use the canonical editable
  groups and paths.
- Import does not simplify vectors unless the user invokes an explicit future
  simplification command.

## Not Yet Preserved

- Automatic conversion of SVG text, symbols, masks, filters, gradients,
  patterns, and images into editable PunchPress child nodes.
- Automatic vector simplification.
