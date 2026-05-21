---
summary: Explains how layers, properties, context menus, document commands, dialogs, and desktop menu bridges translate UI intent into editor commands.
read_when:
  - changing panels, context menus, document command hooks, native menu state, unsaved dialogs, or missing-font export dialogs
  - debugging a UI command that bypasses editor policy or mutates panel-local state
---

# Panels And Commands

Panels render editor state and dispatch editor commands.

## Owners

- Layers panel renders tree rows, layer menus, visibility, reorder, and recent
  document surfaces.
- Properties panel renders selection-specific fields.
- Context menus expose node and selection commands.
- Document command hooks coordinate New, Open, Save, Save As, Export, Close, and
  modal blocking.
- Desktop menu bridge mirrors editor command availability into Electron menus.

Panel state may drive UI presentation, but document behavior belongs in the
editor.
