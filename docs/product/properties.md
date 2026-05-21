---
summary: Defines properties panel behavior for selected node controls, mixed values, shared appearance, artboards, text, shapes, paths, vectors, and groups.
read_when:
  - changing properties panel fields, mixed-value display, selection colors, text warp controls, path point controls, or artboard settings
  - debugging a property edit that applies to the wrong selection scope
  - deciding whether a property belongs on selected nodes, selected path points, logical corners, or aggregate selection colors
---

# Properties

The properties panel edits the active selection.

## Contract

- The panel reads editor state and writes through editor commands.
- Single selection shows controls for that node.
- Multi-selection shows shared controls and mixed values.
- Unsupported controls are hidden instead of guessing.
- Aggregate color controls edit every selected paint that uses the chosen color.

## Selection Scopes

- Artboard selection exposes size and background.
- Text selection exposes text appearance and warp controls.
- Shape selection exposes shape-kind controls and live corner radius.
- Path selection exposes path geometry and appearance.
- Vector selection exposes object-level and aggregate child-path appearance.
- Group selection exposes group-level controls and aggregate selection colors.
- Path-editing selection exposes point or logical-corner controls when relevant.
