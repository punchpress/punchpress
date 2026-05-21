---
summary: Lists browser and desktop document command names, shortcuts, active-tab scope, and modal-safe command behavior.
read_when:
  - changing document command routing, New/Open/Save/Export shortcuts, native menu bridge, or command blocking
  - debugging a document command that acts on the wrong workspace tab or bypasses a prompt
---

# Document Commands

Document commands target the active workspace tab.

| Command | Shortcut | Scope |
| --- | --- | --- |
| `new` | `Cmd/Ctrl+N` | Create a file-backed tab through New File dialog. |
| `open` | `Cmd/Ctrl+O` | Open or focus a `.punch` file-backed tab. |
| `save` | `Cmd/Ctrl+S` | Save active file-backed tab. |
| `save-as` | `Cmd/Ctrl+Shift+S` | Save active file-backed tab to a chosen path. |
| `export` | `Cmd/Ctrl+E` | Export active document or selected export boundary. |
| `import-svg` | menu command | Import SVG into active tab. |

## Rules

- Modals block conflicting commands.
- Dirty file-backed tabs prompt before close.
- Scratchpad is excluded from file-save prompts.
- Browser and Electron command surfaces should call the same app command path.
