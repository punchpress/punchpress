# Artboards

Artboards are the primary design surfaces on the PunchPress canvas.

## Product Expectations

- An artboard represents one final design surface in a document.
- A document may contain one or more artboards.
- The canvas may also contain loose workspace content outside every artboard.
- Artboard content is what users assemble for production, preview, export, and reuse.
- Artboards define production and export dimensions; the surrounding canvas does not have a fixed document size.
- Each artboard has a stable name.
- Users can rename artboards explicitly.
- An artboard has a size in document units, such as pixels or inches.
- An artboard may use a preset size or a custom size.
- An artboard may have its own background color or transparent background.
- The properties panel exposes selected artboard width, height, and background.
- Artboard width and height can be set with explicit pixel values.
- Artboard background colors participate in selection-wide color editing.
- Artboards appear as first-class items in the layers panel.
- Artboards can be selected, moved, resized, duplicated, hidden, locked, and deleted.
- Artboards can be aligned and distributed like other canvas objects.

## Containment

- An artboard is a container node.
- Nodes may live inside an artboard or directly on the pasteboard.
- Nodes inside an artboard are clipped to the artboard bounds by default.
- Moving a node into an artboard reparents that node into the artboard.
- Moving an artboard node out to the pasteboard reparents that node to the document root.
- Moving an artboard moves its child nodes with it.
- Resizing an artboard changes the production surface without scaling its child nodes by default.
- Duplicating an artboard duplicates its child nodes and preserves their relative positions.
- Deleting an artboard should ask whether to delete its child content or keep that content on the pasteboard.

## Selection And Editing

- Every artboard has an on-canvas label.
- Clicking an artboard label selects the artboard.
- Dragging an artboard label moves the artboard.
- Dragging inside an artboard body should not move the artboard.
- Clicking empty artboard body selects the artboard.
- Dragging from empty artboard body starts marquee selection.
- Clicking visible content inside an artboard selects that content when normal selection rules would target it.
- Dragging visible content inside an artboard moves that content when normal selection rules would target it.
- A selected artboard shows a clear artboard boundary and resize handles.
- An artboard label should be visible enough for users to identify the surface without competing with artwork.
- Users should be able to select multiple artboards.
- Users should be able to select loose pasteboard content and artboard content in the same selection when needed.
- Creating the first artboard on an empty canvas should fit that artboard into view with comfortable surrounding space.
- Creating an artboard after other content exists should not automatically zoom or pan the viewport.
- New authored content placed inside an artboard should start at a size that feels useful for that artboard.

## Export

- An artboard is an export boundary.
- Users can export one selected artboard as a PNG.
- Exported artboard output uses the artboard bounds as the crop area.
- Export includes visible child content inside the artboard.
- Export excludes loose pasteboard content.
- Content extending outside an artboard is clipped in exported output.
- Artboard background is included in export when set; transparent artboards export with transparency.
- Exported filenames should default to the artboard name.

## MVP

- Artboards are rectangular only.
- Artboards cannot be rotated or sheared.
- Artboards cannot be non-rectangular.
- Artboards cannot be converted from arbitrary objects.
- Artboards do not have per-artboard guides, grids, drawing scale, or bleed.
- Artboards do not have multi-format export presets.
- Artboards support custom pixel dimensions.
- Artboards support name, visibility, locked state, and optional background color.
- Users can create an artboard from a toolbar command or menu action.
- Users can select, move, resize, duplicate, delete, and rename artboards.
- Users can nest ordinary design nodes inside artboards.
- PunchPress automatically reparents nodes when users move them into or out of artboards.
- Users can export a single artboard to PNG.
