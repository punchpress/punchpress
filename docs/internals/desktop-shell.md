---
summary: Explains Electron shell ownership for main window lifecycle, preload APIs, native menus, document files, recent documents, local fonts, and auto-updates.
read_when:
  - changing Electron main/preload code, desktop document handlers, application menu, recent documents, local fonts, updater, or app close flow
  - debugging desktop-only differences from the browser editor
---

# Desktop Shell

The desktop shell wraps the web editor with native macOS capabilities.

## Owners

- main window controller creates and manages the renderer window
- preload exposes typed `window.electron` APIs
- document file handlers open/save `.punch`, SVG, PNG, and recent documents
- native menu sends document and editor commands
- local font handlers list fonts and read font bytes
- updater reports status and restarts into downloaded updates

Desktop code should adapt native capability to web/editor commands without
owning editor semantics.
