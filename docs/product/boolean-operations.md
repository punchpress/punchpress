---
summary: Defines destructive boolean operations and non-destructive compound paths for editable Shape, Path, and Vector selections.
read_when:
  - changing Unite, Subtract, Intersect, Exclude, Make Compound Path, Release Compound Path, or compound operation menus
  - debugging boolean results that lose editability, choose the wrong parent, or apply the wrong layer-order semantics
  - deciding whether a path operation should bake geometry or preserve a live compound
---

# Boolean Operations

Boolean operations combine vector-capable objects into editable vector artwork.

## Destructive Booleans

- Supported operations are `Unite`, `Subtract`, `Intersect`, and `Exclude`.
- Sources may be shapes, paths, or vectors.
- A selected vector participates as one source object.
- The first cut requires selected sources to share one parent context.
- The first cut requires closed path geometry.
- The result replaces the sources with one vector node and becomes selected.
- The result contains child paths that preserve editable source geometry.
- If sources are sibling paths in one vector, the operation rewrites that vector
  instead of creating a nested vector.

## Compound Paths

- `Make Compound Path` creates a non-destructive compound.
- A compound container owns one operation at a time.
- The default compound operation is `Unite`.
- Changing the compound operation updates the live result without discarding
  child paths.
- `Release Compound Path` restores original child paths instead of preserving
  only the baked outline.
- Layer order controls non-commutative operations such as `Subtract`.

## Fill Rules

- Fill rules and boolean compounds are separate.
- A path fill rule controls that path's own winding behavior.
- A compound operation controls how sibling child paths combine as one object.

## Styling And History

- Boolean results inherit shared appearance from the frontmost selected source.
- A boolean operation commits as one undoable change.
- Conflicting point-editing state exits before removed source objects disappear.
