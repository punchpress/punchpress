---
summary: Explains workspace tab lifecycle, scratchpad persistence, active editor mounting, file-backed tab identity, and per-tab editor disposal.
read_when:
  - changing `apps/web/src/workspace`, scratchpad autosave, active editor context, tab close behavior, or file identity updates
  - debugging stale editor instances, lost selection/viewport/history, or scratchpad persistence
---

# Workspace Tabs

Workspace tabs own multiple editor instances.

## Flow

- Scratchpad tab is created first and kept in a ref.
- File-backed tabs create configured editor instances.
- Active tab provides the current editor through context.
- Switching tabs mounts the next editor and disposes the previous active editor.
- Scratchpad serializes to local storage on debounced editor changes.
- File-backed tabs store basename, file handle, file key, dirty state, and
  editor instance.

## Rule

The workspace owns tab lifecycle. The editor owns document behavior inside each
tab.
