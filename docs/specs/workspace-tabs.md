# Workspace Tabs

Workspace tabs let PunchPress keep an always-available scratchpad alongside explicit `.punch` files.

## Product Expectations

- PunchPress opens to a scratchpad canvas by default.
- The scratchpad is always present and always has a tab.
- The scratchpad is an internal PunchPress document, not a user-selected file on disk.
- The scratchpad persists automatically across app restarts.
- Users do not explicitly save, save as, open, close, or rename the scratchpad.
- Users can create design nodes, import artwork, add artboards, and edit normally in the scratchpad.
- File-backed documents open as separate tabs next to the scratchpad.
- Each file-backed tab represents one PunchPress document canvas.
- Only one tab is active at a time.
- Switching tabs swaps the full canvas, selection, viewport, history, document name, and file identity for that tab.
- Opening a `.punch` file creates a new tab or focuses an already-open tab for that file.
- Opening a file never replaces the scratchpad.
- Opening a file never replaces another open file-backed tab.
- Creating a new file creates a new file-backed document tab.
- File-backed tabs can be closed.
- The scratchpad tab cannot be closed.

## Tab Behavior

- Tabs sit along the top of the app in the titlebar/workspace lane.
- The scratchpad tab is visually stable and easy to distinguish from file-backed tabs.
- The active tab is clearly selected.
- File-backed tabs show a document name.
- Unsaved file-backed tabs show a visible dirty state.
- Tabs remain usable when several documents are open.
- Closing the active tab activates the nearest remaining file-backed tab, or the scratchpad when no file-backed tabs remain.
- Closing an inactive tab does not change the active canvas unless the closed tab was the active tab.

## Scratchpad Contract

- The scratchpad autosaves without prompting.
- Scratchpad autosave preserves document contents, artboards, loose pasteboard content, viewport, and selection when practical.
- Scratchpad data is local to the device.
- Scratchpad changes do not affect recent documents.
- Scratchpad content is excluded from file save and file open flows unless the user explicitly copies, exports, or moves content through normal product actions.
- Resetting or clearing the scratchpad is a deliberate command, not part of ordinary close or quit behavior.

## File-Backed Document Contract

- A file-backed document may be saved to a `.punch` file.
- A file-backed document may exist without a saved file path until the user saves it.
- Saving a file-backed document updates that tab's file identity and display name.
- Save writes the active file-backed tab.
- Save As writes the active file-backed tab to a chosen file and updates that tab's file identity.
- Opening recent documents creates or focuses file-backed tabs.
- Recent documents track file-backed documents only.
- Export commands operate on the active tab.
- Import commands import into the active tab.
- Desktop open-file events open file-backed tabs.
- Native document commands act on the active tab.

## Closing And Unsaved Changes

- Closing a clean file-backed tab closes it immediately.
- Closing a dirty file-backed tab prompts the user to save, discard, or cancel.
- Save writes the document, clears the dirty state, and closes the tab.
- Discard closes the tab without writing changes.
- Cancel leaves the tab open and active.
- Quitting the app checks all dirty file-backed tabs before quit completes.
- The scratchpad never participates in unsaved-change prompts.
- Browser refresh or tab close uses the same unsaved-change protection for dirty file-backed tabs when the platform allows it.

## New File Flow

- New File opens a creation dialog before creating the document.
- The dialog lets the user choose whether the new document starts with an artboard.
- A document without an artboard is valid.
- A document may contain many artboards after creation.
- Presets cover common print-on-demand and general design sizes.
- Amazon Merch is included as a preset.
- Custom size is available.
- Presets create an artboard with the chosen dimensions and a clear default name.
- Choosing no artboard creates an empty pasteboard document.
- After creation, the new file-backed tab becomes active.
- When the first artboard is created during New File, PunchPress fits it into view with comfortable surrounding space.

## Preset Requirements

- Presets have product-facing names.
- Presets show dimensions before selection.
- Presets are grouped so users can scan them quickly.
- Presets do not prevent users from changing or deleting the resulting artboard.
- Presets do not define export behavior by themselves.
- Presets do not make an artboard required for saving.

## MVP

- The scratchpad tab is always open.
- The scratchpad persists locally and autosaves.
- Users can create, open, switch, save, save as, and close file-backed tabs.
- Opening a file creates or focuses a tab instead of replacing the active document.
- New File supports no-artboard, Amazon Merch, and custom-size starts.
- Dirty file-backed tabs prompt on close.
- Quit checks dirty file-backed tabs.
- Export and import operate on the active tab.
- Recent documents work for file-backed tabs.

## Intentionally Missing

- Cloud sync for scratchpad or file-backed tabs.
- Shared collaborative tabs.
- Cross-device scratchpad continuity.
- Multiple windows for separate documents.
- Dragging tabs between windows.
- Pinned tabs other than the scratchpad.
- Per-tab account or workspace ownership.

## Open Questions

- Should the scratchpad support an explicit Clear Scratchpad command in the first release of tabs?
- Should New File default to Amazon Merch, custom size, or no artboard?
- Should opening the same unsaved file from disk focus the existing tab by file path only, or allow duplicate tabs after Save As workflows?
