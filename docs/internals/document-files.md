---
summary: Explains `.punch` load/save ownership across schema helpers, package assets, editor document actions, workspace tabs, browser files, desktop files, and recent documents.
read_when:
  - changing document load, save, serialize, package asset resolution, tab file identity, recent documents, or browser/Electron file adapters
  - debugging a file-backed tab that loses dirty state, basename, file handle, or recent-document identity
---

# Document Files

Document files span schema, engine, workspace, and platform layers.

## Flow

1. Platform opens or saves bytes.
2. Schema reads or writes the `.punch` ZIP package, validates
   `document.json`, and resolves referenced raster assets.
3. Engine loads or serializes hydrated document state. Hydrated image nodes may
   carry runtime `src` data URLs; package `document.json` does not.
4. Workspace tabs own active editor, dirty status, basename, and file identity.
5. Recent documents track file-backed documents only.

Browser file-backed tabs compare `FileSystemFileHandle.isSameEntry()` when a
native handle is available. File names are display labels, not identity keys;
browser opens without a handle cannot be deduplicated.

The save command captures a history checkpoint before asynchronously serializing
the tab's editor, including resident raster pixels. On success it marks that
checkpoint saved for the same editor; edits made during serialization or writing
remain dirty, including after Save As changes the tab's file identity. A canceled
or failed write does not change the baseline or identity.

## Boundaries

- Schema owns the format.
- Engine owns document state.
- Workspace owns tab lifecycle.
- Platform owns file handles, dialogs, and recent document storage.
- Scratchpad autosave is not a file-backed save flow.

For the packaged file contract, see [Punch package](../reference/punch-package.md).
