# Input and gesture endings

PunchPress combines canvas gestures, keyboard shortcuts, and focused controls.
The same key can mean a document command, an editing command, or ordinary text,
depending on focus and the active tool.

## Focus and shortcut order

Tool and ordinary editor shortcuts are suppressed inside text inputs, editable
content, selects, menus, and dialogs. Outside those targets, history shortcuts
are handled before canvas editing shortcuts, then the active tool receives the
key. Thus Escape is contextual, not a universal instruction to undo a gesture.

Space is handled separately. Pressing it outside an input enables temporary
pan; releasing it clears that mode. Window focus loss also clears Space and
Pen's temporary modifiers. The Space handler does not use the full menu/dialog
exclusion used by ordinary shortcuts. Whether focused popup content can expose
unwanted canvas panning needs verification.

## Gesture phases

Every canvas description asks what happens on press, release without movement,
the first qualifying movement, continued movement, and release. A press may
already change selection even when no document edit follows.

Object-move activation compares screen positions before converting movement to
document distances. The shared policy names values in pixels, but each caller's
coordinate input must be checked: Pen handle authoring compares document-space
points, so its apparent screen threshold varies with zoom.

| Named interaction tolerance | Policy value |
| --- | --- |
| Primitive placement, object dragging, selection dragging, Pen dragging | 3 |
| Vector point dragging, vector marquee, corner-radius handle dragging | 4 |
| Vector path hit and segment insertion hit | 10 |
| Pen handle length policy | 12 |
| Point epsilon | 0.5 |

These are named policy values, not a promise that every event path waits for
that screen distance. The selected-object drag can prepare its session on an animation
frame and bypass the subsequent threshold check. See
[moving](../selection/moving.md#edge-cases). The Hand tool delegates its gesture
to the viewport library and is not covered by this table.

## Ending is not always canceling

Release ordinarily keeps the result and groups a document gesture into one
undo step. An explicit engine cancel may restore the starting state. The browser
has to invoke that cancel path for the user to receive rollback.

For object move, resize, and rotate, the inspected browser listeners send
`pointercancel` to the same ending path as `pointerup`. A moved object or resized
selection is consequently committed, not restored. This is a supported suspected
inconsistency to assess, rather than an assumption that all tools cancel safely.

Window focus loss clears modifiers. It is not a general cancellation mechanism
for the document gestures reviewed here. Similarly, changing the toolbar tool
does not prove that a window-level drag listener has been removed.

## Shared questions

Every feature asks, in order, about Escape; switching tools; menu opening or
undo/redo; focus loss; leaving the window; reload or tab close; a changed or
deleted target; and touch cancellation or another input device.

For dialogs and discrete commands, interpret “before dragging” as before the
action or submission and “while dragging” as during its pending or editing phase.
There need not be a physical drag. Static foundations can omit the full feature
template while owning shared facts precisely.

## Open questions and verification

- Confirm which browser/device circumstances generate cancellation during real
  artwork editing and whether committing that partial gesture is intended.
- Check focus loss and toolbar changes while a pointer is held down.
- Confirm popup Space handling and the selected-object small-motion exception.
- Evidence: `primitives/dom.ts`, `primitives/pointer-distance.ts`,
  `input/keyboard-shortcuts.ts`, canvas node and selection overlay listeners.
  Gesture-tolerance and editor-contract tests pass, but do not prove browser
  interrupt delivery.

Source reviewed against PunchPress commit `d4e6d4a`. Status: drafted.
