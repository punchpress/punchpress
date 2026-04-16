# Groups

Groups let users organize multiple layers and manipulate them as one canvas object.

## Product Expectations

- A group is a layer that can contain child layers.
- A group may contain any mix of supported layer types, including other groups.
- A group contains one or more child layers.
- A group receives a name when it is created.
- A group's name remains stable as layers are reordered.
- Users can rename a group explicitly.
- If a group loses its last child layer, the group is removed as part of that same change.

## Bounds

- A group's bounds are the square-cornered outer bounds of its child layers.
- Group bounds update as child layers are moved, transformed, hidden, added, or removed.

## Selection And Transform

- Clicking visible grouped content selects the group by default.
- When a group is selected, move, scale, rotate, and similar transforms apply to the group as a whole.
- Transforming a group preserves the relative arrangement of its child layers.
- A selected group should present one clear selection frame that represents the grouped object, not separate frames for each child layer.

## Properties Panel

- Selecting a group should show object-level controls for the group as a whole.
- When a selected group contains multiple child-layer colors, the properties panel should show a `Selection colors` section listing the distinct colors currently in use across supported child-layer paints.
- Editing one `Selection colors` swatch on a selected group should update every selected descendant fill or stroke paint that currently uses that exact color value.
- `Selection colors` should be color-based rather than fill-versus-stroke based, so the same color should appear only once even if it is currently used by both fills and strokes.

## Drill-In

- Double-clicking a selected group enters a mode where child layers inside that group become individually selectable.
- While drilled into a group, direct selection should target the group's child layers instead of reselecting the group itself.
- PunchPress should make it clear when the user is working inside a group rather than at the top canvas level.
- Exiting the drilled-in state should return normal single-click selection behavior for the group.

## Layers Panel

- A group appears in the layers panel as a group layer with nested child layers underneath it.
- The layers panel should support expanding and collapsing group layers for organization.
- Reordering layers in the panel should respect group structure.
