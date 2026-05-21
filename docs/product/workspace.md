---
summary: Defines the PunchPress editor workspace as the combined canvas, tabs, panels, toolbars, document commands, dialogs, and platform shell.
read_when:
  - changing top-level editor layout, workspace state, panel placement, tab chrome, or document command surfaces
  - deciding whether behavior belongs to the canvas, workspace provider, panels, or platform shell
---

# Workspace

The workspace is the user's active editing environment: tabs, canvas, panels,
toolbar, dialogs, and platform shell around one active editor.

## Contract

- One workspace tab is active at a time.
- The active tab owns the visible editor state.
- Canvas, layers, properties, document commands, and export/import actions act
  on the active tab.
- Panels are clients of the editor, not independent sources of document truth.
- Platform shell behavior adds capabilities such as local files and native
  menus without redefining editor semantics.

## Layout

- The canvas fills the workspace.
- Workspace tabs sit in the top titlebar lane.
- Layers live on the left.
- Properties live on the right.
- Tool controls stay close to the canvas.
- Dialogs block conflicting editor commands while open.
