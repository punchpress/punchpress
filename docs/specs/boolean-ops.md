# Boolean Ops

Boolean ops let users combine overlapping vector objects into new editable vector artwork.

## Product Expectations

- PunchPress should support destructive boolean ops for selected vector-capable objects.
- PunchPress should also support non-destructive boolean compounds as a separate feature from destructive boolean ops.
- The baseline boolean ops are `Unite`, `Subtract`, `Intersect`, and `Exclude`.
- Boolean ops should be available from the shared selection action bar as icon-only actions.
- Boolean ops should operate on selected `Shape`, `Path`, and `Vector` nodes.
- A selected `Vector` should participate as one boolean source object even when it contains multiple child paths.
- A non-destructive compound should behave like a normal container object with editable child paths rather than like a baked one-off result.
- The first cut of boolean ops should require all selected source objects to share the same parent layer context rather than silently reparenting across unrelated containers.
- The first cut of boolean ops should require closed path geometry rather than attempting area booleans on open paths.

## Result Shape

- A boolean op should replace the selected source objects with one resulting `Vector` node.
- The resulting `Vector` should contain one or more child `Path` nodes that preserve the boolean result as editable source geometry.
- If the selected source objects are already sibling paths inside one existing vector, the boolean result should rewrite that vector's child paths instead of creating a nested vector.
- The resulting vector should remain editable through the normal vector path editing workflow.
- After a boolean op completes, the resulting vector should become the active selection.

## Relationship To Compounds

- `Make Compound Path` should create a non-destructive boolean compound rather than immediately baking one destructive boolean result.
- A newly created compound should default the compound container to `Unite`.
- If the selected source objects are standalone paths, shapes, or vectors, `Make Compound Path` should create one new compound container around them.
- If the selected source objects are already sibling child paths inside one eligible vector container, `Make Compound Path` should reuse that container rather than nesting another compound.
- In the non-destructive compound model, one compound container owns one boolean operation at a time rather than storing separate boolean modes on each child path.
- Changing the compound operation should update the live result without discarding the original child paths.
- When one compound container is selected, PunchPress should expose a `Compound Operation` menu that lets users switch between `Unite`, `Subtract`, `Intersect`, and `Exclude`.
- In the Layers panel, a compound container should expose the same compound operation choices from both its layer icon and its layer context menu.
- In the Layers panel context menu, `Make Compound Path` and `Release Compound Path` should replace one another based on the row's current compound state rather than appearing together.
- Releasing a compound should restore the original child paths instead of preserving only the baked boolean outline.

## Relationship To Fill Rules

- Fill rules and boolean compounds are separate features.
- A path's fill rule should control winding behavior for that path's own filled shape.
- A compound container's boolean operation should control how sibling child paths combine as one object.

## Operation Semantics

- `Unite` should merge the selected source areas into one combined result.
- `Subtract` should subtract the frontmost selected source objects from the backmost selected source object.
- `Intersect` should keep only the area shared by the selected source objects.
- `Exclude` should keep non-overlapping areas and remove shared overlap areas.
- For non-commutative compound operations such as `Subtract`, child layer order should determine which paths act as cutters and which path acts as the base object.

## Styling

- The first cut of boolean ops may apply one shared appearance to the result rather than preserving mixed source styling piece by piece.
- The resulting vector should inherit its fill and stroke styling from the frontmost selected source object.

## Editing And History

- A boolean op should commit as one undoable change.
- Performing a boolean op should exit any conflicting point-editing state rather than leaving stale path-edit selections attached to removed source objects.
