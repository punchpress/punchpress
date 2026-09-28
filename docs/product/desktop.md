---
summary: Defines desktop-shell product behavior for update visibility, native document commands, open-file events, local files, and packaged app expectations.
read_when:
  - changing Electron shell behavior, update indicators, native menus, desktop file opening, or packaged app UX
  - debugging update prompts, app relaunch behavior, or desktop commands that target the wrong tab
  - deciding whether a browser feature needs a desktop-specific product contract
---

# Desktop App

PunchPress desktop wraps the same editor in an Electron shell.

## Product Contract

- Desktop features extend the web editor; they do not redefine editor behavior.
- Native document commands act on the active workspace tab.
- Desktop open-file events open or focus file-backed tabs.
- Local file and local font capabilities are platform boundaries around the
  same editor and document model.

## Auto-Update Visibility

- Packaged builds check for updates after launch and periodically while open.
- Automatic checks stay quiet until an update is ready to install.
- The PunchPress menu offers Check for Updates. A manual check shows checking,
  download progress, an up-to-date result, or an error. Completed results clear
  from the titlebar after a short delay.
- Downloaded updates prompt the user to restart and install.
- Update UI appears only in desktop builds.
- The titlebar may show a compact update pill placed clear of macOS traffic
  lights and primary document controls.
- A user-initiated download shows progress as a percentage.
- When ready, update UI switches to a restart/install action.
- Update UI is visible enough for users to act without interrupting normal
  editing.
- Manual install DMGs and auto-update ZIP artifacts are separate release
  surfaces.

## Intentionally Missing

- Desktop-only document semantics.
- Separate desktop document model.
- Multi-window editing until it has a product contract.
