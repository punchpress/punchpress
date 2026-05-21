---
summary: Defines SVG import behavior for menu imports, OS drops, grouping, naming, editable path conversion, placement, and unsupported fidelity.
read_when:
  - changing SVG drop, SVG menu import, group preservation, path conversion, naming, placement, or unsupported-feature handling
  - debugging imported artwork that flattens, lands in the wrong place, loses holes, or creates unexpected groups
  - deciding whether an SVG feature should become editable PunchPress source content or be skipped gracefully
---

# SVG Import

SVG import brings external vector artwork into PunchPress as editable source
content.

## Import Paths

- Users can import SVG from the document menu.
- Users can drag a `.svg` file from the OS onto the canvas.
- Menu import centers artwork in the current viewport.
- Drop import centers artwork on the drop point.
- Imported SVG lands as one selected top-level group.

## Structure

- Non-empty SVG group hierarchy becomes nested PunchPress groups.
- Empty groups are skipped unless they carry visible behavior PunchPress can
  represent.
- Author names are preserved when available from `inkscape:label`, `data-name`,
  `id`, or `name`.
- SVG path objects become editable PunchPress path nodes.
- A path with multiple subpaths becomes one path node with multiple contours.
- Imported groups become PunchPress groups only when the SVG contains group
  structure, not merely because a path has multiple contours.

## Fidelity

- Imported open paths remain open on canvas and export.
- Compound SVG paths preserve fill-rule behavior for holes and cutouts.
- Matching fill, stroke, alpha, stroke width, line cap, line join, and miter
  values remain editable.
- Unsupported SVG features fail gracefully by preserving importable editable
  artwork when possible.

## Not Yet Preserved

- Clip paths, masks, filters, gradients, patterns, blend modes, group opacity.
- Full CSS cascade, external stylesheets, reusable defs, symbols, and `<use>`.
- Raster `<image>` import.
- Editable SVG text or text outline fallback.
- Stroke dash styles, markers, non-scaling stroke.
- Durable group transforms.
- Live shape preservation for SVG primitive elements.
- Animation, scripting, accessibility metadata, color profiles, and print color
  management.
