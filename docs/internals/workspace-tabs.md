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
- Scratchpad serializes to local storage on debounced editor changes. A timed
  write saves once; edits made during it wait for the next quiet period.
  Explicit flushes (tab switch, dispose) keep writing until the latest edit is
  saved.
- File-backed tabs store basename, file handle, file key, and editor instance.
  Tab dirty state comes from each file editor's `subscribeDirtyState`, so the
  workspace re-renders only when a tab's dirty state flips, not on every edit.

## Rule

The workspace owns tab lifecycle. The editor owns document behavior inside each
tab.
