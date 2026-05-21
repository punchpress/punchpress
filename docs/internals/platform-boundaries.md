---
summary: Defines browser and Electron platform boundaries for files, local fonts, recent documents, desktop menus, open-file events, and updater commands.
read_when:
  - changing `apps/web/src/platform`, Electron preload APIs, local file flows, local fonts, or desktop command bridges
  - deciding whether behavior belongs in platform adapters or the headless engine
  - debugging web/desktop differences in open, save, recent documents, font access, or menu commands
---

# Platform Boundaries

Platform code adapts host capabilities to editor commands.

## Browser Platform

`apps/web/src/platform` owns:

- browser file open/save through `browser-fs-access`
- browser recent documents
- browser local font access
- SVG import file opening
- desktop menu bridge types and state adapters for the web side

## Desktop Platform

Electron owns:

- native open/save dialogs
- `.punch` file opening and recent documents
- local font enumeration and byte reads
- native menu command routing
- auto-update status and restart

## Rule

Platform code returns data or invokes editor commands. It does not own document
semantics, selection policy, node behavior, or history.
