---
summary: Defines live shape nodes as constrained vector objects with polygon, ellipse, star behavior, live editing, corner radius controls, and conversion boundaries.
read_when:
  - changing polygon, ellipse, star, shape placement, shape editing, corner radius, or shape-to-path conversion
  - deciding whether a shape edit preserves live shape behavior or becomes freeform path artwork
  - debugging a shape that loses controls, converts too early, or keeps controls after the shape meaning is gone
---

# Shape Nodes

Shape nodes are live geometric objects that remain easy to manipulate without
immediately becoming freeform paths.

## Contract

- Shape nodes are first-class canvas objects with identity, layer behavior,
  visibility, styling, and transform.
- Shapes render as vector artwork and remain editable source content.
- Baseline families are polygon, ellipse, and star.
- Rectangle creation produces a polygon shape with four default corners.
- A shape keeps its shape family while the current controls still have clear
  meaning.
- Shape nodes do not switch from one live family into another.

## Live Shape Editing

- Live shape editing is the Node tool's editing state for shapes.
- Users enter by double-click, Node tool, Node hotkey, or clicking a shape while
  Node is active.
- The selected shape stays selected.
- Shape-editing affordances replace normal object transform chrome.
- Canvas marquee selection targets shape anchors, not unrelated nodes.
- Shape body drag can move the shape when no anchor or handle is targeted.

## Corner Radius

- Polygon and star shapes expose live corner radius while corners remain
  eligible.
- Bulk corner radius edits apply to eligible corners when no corner is selected.
- Selected-corner edits apply only to selected logical corners.
- Corner-radius edits that still fit the live shape model do not convert the
  shape to freeform path artwork.
- Shared radius controls clamp to a stable shared maximum instead of jumping to
  `0` or `Mixed`.

## Conversion

- Shape nodes convert to freeform path artwork when topology or bezier semantics
  break the current live family.
- Explicit `Convert to path` is available for users who want raw path anchors.
- Conversion preserves visible geometry and styling.
- Single-contour conversions prefer a standalone path node.
- Multi-contour or grouped conversions may use a vector container.
- Once converted, shape-specific controls disappear.
