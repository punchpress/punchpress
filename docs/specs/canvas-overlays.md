# Canvas Overlays

Canvas overlays communicate hover, selection, editing, and direct-manipulation
state on top of the artwork.

## Product Expectations

- Canvas overlays should feel like one coherent visual system.
- Similar overlay affordances should look intentionally related instead of
  behaving like separate feature-specific styles.
- Canvas overlays should remain visually stable while zooming, panning,
  transforming, and editing.
- Canvas overlays should help users understand what they are about to act on,
  what is currently selected, and what is editable right now.

## Preview And Hover

- Hovering an ordinary object should show object-level hover feedback that is
  distinct from selection.
- Hovering a path or contour target in path-editing workflows should show a path
  preview rather than an object-bounds preview.
- Path-preview overlays that communicate similar intent should share the same
  visual language.
- A hidden or subtracted child path that becomes directly selected should still
  show a visible path ghost on canvas so the user is not dragging invisible
  geometry.
- A selected hidden-path ghost should visually belong to the same preview family
  as related path-hover previews.

## Selection

- Object selection overlays should clearly frame the selected object or objects
  without obscuring the artwork.
- Selection overlays should stay aligned with the visible result of the object
  they describe.
- Selection overlays should remain consistent across single selection,
  multi-selection, and compound-vector selection states.

## Editing

- Entering an edit mode should add editing chrome without making the artwork
  itself look like a different object.
- Text-path guides, vector-path guides, point-edit chrome, and related editing
  overlays should feel like part of the same editor family.
- Edit-mode overlays may have different affordances from plain hover and plain
  selection, but they should still share one visual language.
- Warning and limit states should read consistently across overlay types.

## Consistency

- If two overlay states communicate the same kind of thing, they should reuse
  the same visual treatment or clearly derive from it.
- Visual tuning of a shared overlay family should update all relevant members of
  that family together.
- New overlay affordances should extend the existing overlay language unless
  PunchPress intentionally introduces a clearly different state.
