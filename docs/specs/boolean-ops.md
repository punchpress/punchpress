# Boolean Ops

Boolean ops let users combine overlapping vector objects into new editable vector artwork.

## Product Expectations

- PunchPress should support destructive boolean ops for selected vector-capable objects.
- The baseline boolean ops are `Unite`, `Subtract`, `Intersect`, and `Exclude`.
- Boolean ops should be available from the shared selection action bar as icon-only actions.
- Boolean ops should operate on selected `Shape`, `Path`, and `Vector` nodes.
- A selected `Vector` should participate as one boolean source object even when it contains multiple child paths.
- The first cut of boolean ops should require all selected source objects to share the same parent layer context rather than silently reparenting across unrelated containers.
- The first cut of boolean ops should require closed path geometry rather than attempting area booleans on open paths.

## Result Shape

- A boolean op should replace the selected source objects with one resulting `Vector` node.
- The resulting `Vector` should contain one or more child `Path` nodes that preserve the boolean result as editable source geometry.
- If the selected source objects are already sibling paths inside one existing vector, the boolean result should rewrite that vector's child paths instead of creating a nested vector.
- The resulting vector should remain editable through the normal vector path editing workflow.
- After a boolean op completes, the resulting vector should become the active selection.

## Operation Semantics

- `Unite` should merge the selected source areas into one combined result.
- `Subtract` should subtract the frontmost selected source objects from the backmost selected source object.
- `Intersect` should keep only the area shared by the selected source objects.
- `Exclude` should keep non-overlapping areas and remove shared overlap areas.

## Styling

- The first cut of boolean ops may apply one shared appearance to the result rather than preserving mixed source styling piece by piece.
- The resulting vector should inherit its fill and stroke styling from the frontmost selected source object.

## Editing And History

- A boolean op should commit as one undoable change.
- Performing a boolean op should exit any conflicting point-editing state rather than leaving stale path-edit selections attached to removed source objects.
