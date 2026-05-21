---
summary: Defines document command behavior for New, Open, Save, Save As, Export, Close, modal blocking, missing fonts, and active-tab scope.
read_when:
  - changing document menus, toolbar commands, desktop menu bridge, new-file dialog, unsaved prompts, missing-font export prompts, or active-tab command routing
  - debugging a command that should be blocked by an open modal or dirty document prompt
---

# Document Commands

Document commands act on the active workspace tab.

## Commands

- New creates a file-backed tab through the New File dialog.
- Open creates or focuses a file-backed tab.
- Save writes the active file-backed tab.
- Save As writes the active file-backed tab to a chosen path and updates its
  file identity.
- Export operates on the active tab or selected export boundary.
- Close checks dirty file-backed tabs before closing.

## Blocking

- Modal dialogs block conflicting editor commands.
- Dirty file-backed tabs prompt before destructive close or quit.
- Missing font export prompts protect users from exporting with unresolved font
  substitutions.
- Scratchpad autosave means the scratchpad does not join unsaved-change prompts.

## Platform

Browser controls and desktop native menus route to the same command model.
