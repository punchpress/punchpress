# Tools and editing modes

A tool states what the next canvas gesture is for. Editing modes state which
part of an existing object is being edited. Tool selection alone does not tell
the whole story of the current interaction.

## Tool entry

| Key | Tool or shape choice |
| --- | --- |
| V | Pointer |
| A | Node |
| H | Hand |
| P | Pen |
| T | Text |
| B | Brush |
| E | Eraser |
| R | Shape, polygon/rectangle |
| O | Shape, ellipse |
| S | Shape, star |

The initial tool is Pointer, with no selection. These letter shortcuts do not
select tools with Ctrl, Cmd, or Alt held. Focus exclusions are owned by
[input](input.md#focus-and-shortcut-order).

Space temporarily enables navigation without changing the selected tool.
The pan cursor takes precedence over ordinary tool and hover feedback.

## Switching and finishing

Changing tools gives the old tool a chance to finish or abandon its own session,
then activates the new one. Leaving Text for another tool finalizes current text
editing. Selecting an unknown tool has no effect.

Node can automatically enter path editing when exactly one eligible object is
selected. It does not do so for a multi-selection. Leaving Node normally exits
path editing, except that Pen may continue the same path-editing context.

## Escape is contextual

Pointer exits a focused group first, selecting the group, and otherwise clears
object selection. Hand returns to Pointer. Node's inner point selection can be
cleared before a later Escape returns to Pointer. Pen owns Escape during its
active authoring session. Text has its own edit completion/cancellation rules.

These rules describe dispatched keys. A menu or input may receive the key first,
and browser drag listeners can outlive a tool switch. Each feature's interrupt
table owns the result during its active gesture.

## Open questions and verification

- Browser checks must exercise shortcuts both with canvas focus and inside
  relevant fields or popups.
- No claim is made that every tool change cancels an unrelated active drag.
- Evidence: tool classes, `editing/editing-actions.ts`, keyboard dispatch,
  interaction-modes and vector-path-edit-escape tests.

Source reviewed against PunchPress commit `d4e6d4a`. Status: drafted.
