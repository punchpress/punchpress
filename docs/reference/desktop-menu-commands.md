---
summary: Defines Electron native menu document commands, editor commands, menu state payloads, IPC channels, and vector menu choices.
read_when:
  - changing desktop native menus, preload command channels, app menu state, vector compound menu items, or native recent documents
  - debugging native menu actions that are enabled incorrectly or send the wrong renderer command
---

# Desktop Menu Commands

The Electron shell sends document and editor commands to the renderer.

## Document Commands

- `new`
- `open`
- `save`
- `save-as`
- `export`
- `import-svg`

## Editor Commands

| Type | Actions |
| --- | --- |
| `history` | `undo`, `redo` |
| `selection` | `delete-selected`, `merge-curves`, `separate-curves`, `join-curves`, `make-compound-path`, `release-compound-path` |
| `vector-compound-operation` | `unite`, `subtract`, `intersect`, `exclude` |
| `selection-property` | `fillRule`, `strokeLineCap`, `strokeLineJoin` |

## Curve Command Semantics

| Menu label | Command id | Semantics |
| --- | --- | --- |
| Merge Curves | `merge-curves` | Combine compatible selected curves into one editable multi-contour result. |
| Separate Curves | `separate-curves` | Split a multi-contour result into separate editable curves. |
| Join Curves | `join-curves` | Connect eligible open endpoints into one contour. |

## Menu State

Menu enabled state is derived from editor selection state:

- selection kind: `none`, `single`, `multi`, `group`
- selected node type: `text`, `shape`, `vector`, `group`
- vector fill rule, stroke cap, stroke join
- compound operation availability
- curve and compound command availability

Native menus should reflect editor state; they do not own editor policy.
