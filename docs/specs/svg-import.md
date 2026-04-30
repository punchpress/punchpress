# SVG Import

SVG import should bring external vector artwork into PunchPress as editable
source content while preserving the organization users expect from design tools.

## Product Expectations

- Users should be able to import SVG artwork from the document menu.
- Users should be able to import SVG artwork by dragging a `.svg` file from the OS onto the canvas.
- Imported SVG artwork should always land inside one selected top-level group.
- SVG artwork imported from the document menu should be centered in the current viewport.
- SVG artwork dropped from the OS should be centered on the drop point.
- Non-empty SVG group hierarchy should be preserved as nested PunchPress groups.
- Empty SVG groups should be skipped unless they carry user-visible behavior that PunchPress can represent.
- Imported group and artwork names should use author-provided SVG labels when available, including `inkscape:label`, `data-name`, `id`, and `name`.
- Imported path artwork should remain editable as PunchPress vector/path source content, not a flattened image.
- Each imported SVG path object should become one editable PunchPress path node.
- An SVG path object with multiple subpaths should become one PunchPress path node with multiple contours, not separate sibling paths.
- Imported open paths should remain open on canvas and export instead of gaining implied fills.
- Compound SVG paths should preserve fill-rule behavior so holes and cutouts remain visually correct without inferring destructive boolean operations.
- Imported fill and stroke colors, alpha values, stroke width, stroke line cap, stroke line join, and miter limit should remain editable where PunchPress has matching controls.
- Imported SVG groups should become PunchPress groups only when the SVG source contains group structure, not merely because a path contains multiple contours.
- Unsupported SVG features should fail gracefully by preserving importable editable artwork rather than rejecting the whole SVG when possible.

## Missing Fidelity

PunchPress does not yet fully preserve or edit these SVG features:

- Clip paths through `clip-path`.
- Masks through `<mask>`.
- SVG filters such as blur, shadow, color matrix, displacement, lighting, morphology, and filter chains.
- Linear and radial gradients.
- Pattern fills and strokes through `<pattern>`.
- Group opacity as durable group opacity.
- Blend modes, including `mix-blend-mode`.
- Full CSS cascade support from `<style>`, classes, CSS variables, inherited selectors, and selector specificity.
- External stylesheets or linked resources.
- Reusable definitions from `<defs>` as durable reusable objects.
- `<use>` and `<symbol>` as instanced reusable artwork.
- Raster image import through `<image>`.
- SVG text import as editable text.
- SVG text outline fallback when editable text import is not possible.
- Stroke dash styling through `stroke-dasharray` and `stroke-dashoffset`.
- Markers such as arrowheads through `marker-start`, `marker-mid`, and `marker-end`.
- `vector-effect="non-scaling-stroke"`.
- Durable group transforms. Imported transforms may be resolved into child geometry instead of represented as editable group transforms.
- Live shape preservation. SVG rectangles, circles, ellipses, lines, polygons, and polylines may import as editable vector/path artwork instead of PunchPress shape nodes.
- Advanced fill and stroke inheritance as editable group-level styling.
- Clipped, masked, filtered, or otherwise effect-driven export fidelity after import.
- Visibility and display semantics beyond the subset that maps cleanly to PunchPress node visibility.
- SVG metadata, accessibility labels, descriptions, and ARIA attributes as editable PunchPress metadata.
- Color profiles, color spaces, and print-specific SVG color management.
- Units and physical sizing semantics beyond visual placement in canvas coordinates.
- Animation elements and timing behavior.
- Scripting and interactive SVG behavior.
