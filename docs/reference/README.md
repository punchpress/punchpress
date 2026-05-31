---
summary: Routes exact PunchPress contracts for file format, editor APIs, node capabilities, geometry, shortcuts, command ids, import, export, and clipboard payloads.
read_when:
  - looking up an exact schema, command, keyboard shortcut, payload, or precedence rule
  - changing code where an incorrect name, order, id, coordinate space, or format would break compatibility
---

# Reference

Reference docs are lookup surfaces. They should be exact, terse, and easy to
scan.

| Contract | Doc |
| --- | --- |
| Saved document shape | [Punch format](punch-format.md) |
| Schema versioning and migrations | [Schema migration](schema-migration.md) |
| Public editor methods and grouped responsibilities | [Editor API](editor-api.md) |
| Node capability methods and extension points | [Node capabilities](node-capabilities.md) |
| Tool event lifecycle | [Tool events](tool-events.md) |
| Render, selection, transform, and hit frames | [Geometry frames](geometry-frames.md) |
| Canvas, viewport, screen, local, and SVG coordinates | [Coordinate spaces](coordinate-spaces.md) |
| Cursor tokens and precedence | [Canvas cursors](canvas-cursors.md) |
| Keyboard shortcuts | [Keyboard shortcuts](keyboard-shortcuts.md) |
| Performance test labels, artifacts, and trace integration | [Performance tests](performance-tests.md) |
| App and document command ids | [Document commands](document-commands.md) |
| Electron menu command bridge | [Desktop menu commands](desktop-menu-commands.md) |
| SVG import behavior and normalization | [SVG import](svg-import.md) |
| SVG export behavior | [SVG export](svg-export.md) |
| Clipboard payloads and paste precedence | [Clipboard formats](clipboard-formats.md) |
