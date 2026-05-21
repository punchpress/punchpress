---
summary: Defines the SVG import normalization contract for supported item classes, naming attributes, path contours, color conversion, placement, and skipped fidelity.
read_when:
  - changing SVG parser normalization, Paper import behavior, path contour conversion, imported names, or color/stroke storage
  - debugging imported SVG geometry that shifts, flattens, loses holes, or creates unexpected path nodes
---

# SVG Import

SVG import normalizes external artwork into editable PunchPress nodes.

## Supported Items

The importer accepts Paper items representing:

- `CompoundPath`
- `Path`
- `Shape`

## Names

Imported names prefer, in order:

1. `inkscape:label`
2. `data-name`
3. `id`
4. `name`

## Geometry

- Paths become path nodes.
- Paper segments become vector segments with `point`, `handleIn`, `handleOut`,
  and `pointType`.
- Coordinates are rounded to three decimal places.
- Multi-subpath objects become multi-contour path nodes.
- Open paths remain open.
- Import placement recenters artwork on the viewport center or drop point.

## Style

- Solid colors are stored as CSS colors.
- `rgb(r,g,b)` storage values normalize to hex.
- Fill and stroke can be `null`.
- Stroke cap, join, width, miter, and fill rule map when supported.

Unsupported SVG features should be skipped or flattened only when no editable
representation exists.
