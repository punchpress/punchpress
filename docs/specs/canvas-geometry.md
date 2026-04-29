# Canvas Geometry

Canvas geometry is the shared source of truth for how nodes appear, select,
transform, and respond to pointer interaction.

## Product Expectations

- Every visible node should have one coherent geometry model that describes its visible footprint.
- Rendering, selection bounds, hover previews, hit testing, transforms, and path-edit entry should agree on that geometry.
- A user should not be able to click an old or untransformed version of a node after the node has moved, resized, rotated, or changed composition.
- Hit testing should respect the same transforms that rendering and selection use.
- Hit testing should respect visibility, layer order, focused groups, and the active tool's selection scope.
- Hit testing should prefer the topmost visible editable artwork under the pointer.
- Filled artwork should be hittable by its filled area.
- Stroked open artwork should be hittable by its visible stroke.
- Hollow or unfilled artwork should be hittable by its visible edge, not by its empty interior, unless a tool explicitly requests inside hits.
- Text, shapes, paths, vectors, and grouped artwork should all participate in the same canvas geometry model.
- A vector node should expose the correct hit target for the current interaction context: the vector object for object selection, or the relevant child path when the user is directly editing vector paths.
- A compound vector should remain visually and interactively coherent after boolean composition, resize, rotate, save, load, copy, paste, and import.
- Hover previews and selection outlines should describe the same target that a click would select or edit.
- Path-editing chrome should never reveal stale source geometry that no longer matches the transformed editable path.
- Imported SVG artwork should behave like native artwork under the same geometry and hit-testing expectations.

