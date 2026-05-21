---
summary: Defines group behavior for containment, naming, bounds, transforms, drill-in selection, properties, layers, and empty-group cleanup.
read_when:
  - changing group creation, ungroup, group selection, drill-in, nested layers, or group transforms
  - debugging group bounds, selection colors, child targeting, or layer reordering inside groups
  - deciding whether a new container behavior belongs on groups or another node family
---

# Groups

Groups organize multiple layers and let users manipulate them as one object.

## Product Contract

- A group is a named layer that contains one or more child layers.
- A group may contain any supported layer type, including other groups.
- A group loses its reason to exist when it loses its last child and is removed
  as part of that change.
- Group bounds are the square-cornered outer bounds of visible child layers and
  update as children change.

## Selection And Transform

- Clicking visible grouped content selects the group by default.
- A selected group moves, scales, and rotates as one object.
- Group transforms preserve child arrangement.
- A selected group shows one clear selection frame for the grouped object.

## Drill-In

- Double-clicking a selected group enters child-selection mode.
- While drilled in, clicks target visible descendants instead of reselecting the
  group.
- Nested groups may be passed through when the pointer clearly targets a
  descendant.
- Exiting drill-in restores normal group selection.

## Panels

- Groups appear as expandable rows in layers.
- Reordering respects group structure.
- Selecting a group exposes object-level controls.
- Selection colors aggregate distinct descendant fill and stroke colors.
- Editing a selection color updates every selected descendant paint that uses
  that exact color.
