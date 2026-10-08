---
summary: Explains editor store ownership for durable document state, transient interaction state, selection state, clipboard state, font state, history, dirty marks, and undo boundaries.
read_when:
  - changing Zustand store slices, history manager behavior, dirty state, undo/redo, or interaction preview state
  - deciding whether a value is durable document state, session state, or transient gesture state
---

# Store And History

The editor store separates durable document state from session and interaction
state.

## State Kinds

| State | Examples |
| --- | --- |
| Durable document | nodes, transforms, visibility, text, styling, vector geometry, artboards. |
| Session state | active tool, active layer, transform selection, focused group, viewport, font catalog. |
| Transient interaction | hover, drag preview, rotation session, path positioning, panning. |
| Clipboard state | copied PunchPress payload and paste sequencing. |

## History

- History tracks logical document changes.
- Gesture previews remain transient until commit.
- Undo/redo restores document state and relevant editor mode state.
- Dirty state compares current document state to the last saved mark. The
  serialized comparison is cached per nodes snapshot.
- Writes are immutable. A history entry records a node only when its value
  changed: identical references are skipped and distinct versions compare
  field by field, so shared fields such as contours are never serialized.
- Undo and redo load the recorded node objects back. Loading keeps an already
  normalized node (path normalization is idempotent), so untouched nodes keep
  their identity, geometry cache entries, and art revisions.
- `hasOpenHistoryStep` is true while a gesture holds an open mark; deferred
  whole-document work such as scratchpad autosave waits for it to close.
- `subscribeDirtyState` notifies after store updates and after history, save,
  undo, and redo transitions, once `isDirty` holds its final value.

Do not store hover, viewport, cursor, Paper sessions, or render caches in saved
documents.

Active layer is session state rather than saved document data. Store mutations
reconcile it after insert, load, undo, redo, and deletion so a non-empty
document always has exactly one. Transform selection may be empty independently.
