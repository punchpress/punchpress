---
summary: Defines non-destructive compound paths as vector containers with child paths, one live operation, layer-order semantics, and release behavior.
read_when:
  - changing Make Compound Path, Release Compound Path, compound operation menus, or compound rendering
  - debugging compound paths that bake child geometry, lose layer order, or show overlapping child strokes incorrectly
  - deciding whether a boolean-like feature should be live compound behavior or destructive output
---

# Compound Paths

Compound paths combine child paths without discarding the original editable
geometry.

## Contract

- A compound is a vector container.
- Child paths remain editable source content.
- The parent compound owns one operation at a time.
- The default operation is `Unite`.
- Changing the operation updates the live result.
- Releasing restores original child paths.

## Creation

- Eligible standalone paths, shapes, or vectors can become one compound
  container.
- Eligible sibling child paths inside one vector reuse that vector instead of
  creating a nested compound.
- `Make Compound Path` and `Release Compound Path` replace one another in menus
  based on current compound state.

## Rendering

- Compound child order is durable.
- Layer order controls non-commutative operations such as `Subtract`.
- A compound renders as one combined result rather than leaving overlapping
  child strokes visible through each other.
- Fill rules remain separate from compound operations.
