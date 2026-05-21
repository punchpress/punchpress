---
summary: Defines PunchPress scratchpad and file-backed tabs, tab switching, dirty prompts, New File presets, recent documents, and active-document command scope.
read_when:
  - changing tab lifecycle, scratchpad autosave, file-backed documents, dirty prompts, New File, or recent documents
  - debugging a command that acts on the wrong tab or loses file identity
  - deciding whether scratchpad behavior should participate in save, close, or recent-document flows
---

# Workspace Tabs

Workspace tabs keep an always-available scratchpad next to explicit `.punch`
files.

## Tabs

- PunchPress opens to the scratchpad by default.
- The scratchpad tab is always present and cannot be closed.
- File-backed documents open as separate tabs.
- Only one tab is active at a time.
- Switching tabs swaps the full editor state for that tab: document, selection,
  viewport, history, display name, dirty state, and file identity.
- Opening an already-open file focuses its tab.
- Opening a file never replaces the scratchpad or another file-backed tab.

## Scratchpad

- The scratchpad is local internal document storage, not a user-selected file.
- It autosaves without prompting.
- It supports normal canvas editing, imports, artboards, and exports.
- It does not participate in save, save-as, open, close, recent-document, or
  unsaved-change prompts.
- Clearing the scratchpad is a deliberate command, not a quit or close side
  effect.

## File-Backed Documents

- New File creates a file-backed tab.
- A file-backed tab may exist without a file path until first save.
- Save writes the active file-backed tab.
- Save As writes the active file-backed tab to a chosen file and updates tab
  identity.
- Open Recent creates or focuses a file-backed tab.
- Import and export operate on the active tab.
- Desktop open-file events open file-backed tabs.

## Closing

- Clean file-backed tabs close immediately.
- Dirty file-backed tabs prompt to save, discard, or cancel.
- Save clears dirty state and closes the tab.
- Discard closes without writing.
- Cancel leaves the tab open.
- App quit checks all dirty file-backed tabs before completing.
- Browser refresh and browser tab close use dirty file-backed tab protection
  when the platform can present it.
- Browser close protection is a last-resort data-loss guard; it does not replace
  PunchPress save, close, or quit prompts where the app can show richer choices.

## New File

- New File opens a creation dialog before creating the tab.
- Users may start with no artboard, a preset artboard, or a custom size.
- Presets expose product-facing names and dimensions.
- Amazon Merch is included as a preset.
- Presets create an artboard but do not make artboards required for save or
  export.

## Intentionally Missing

- Cloud sync.
- Collaboration.
- Multiple windows.
- Dragging tabs between windows.
- Pinned tabs beyond the scratchpad.
