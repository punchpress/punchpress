---
summary: Explains `.punch` load/save ownership across schema helpers, editor document actions, workspace tabs, browser files, desktop files, and recent documents.
read_when:
  - changing document load, save, serialize, tab file identity, recent documents, or browser/Electron file adapters
  - debugging a file-backed tab that loses dirty state, basename, file handle, or recent-document identity
---

# Document Files

Document files span schema, engine, workspace, and platform layers.

## Flow

1. Platform opens or saves bytes.
2. Schema parses, normalizes, migrates, validates, and serializes `.punch`.
3. Engine loads or serializes document state.
4. Workspace tabs own active editor, dirty status, basename, and file identity.
5. Recent documents track file-backed documents only.

## Boundaries

- Schema owns the format.
- Engine owns document state.
- Workspace owns tab lifecycle.
- Platform owns file handles, dialogs, and recent document storage.
- Scratchpad autosave is not a file-backed save flow.
