# History

PunchPress keeps a document history so people can undo and redo meaningful
editing steps.

## Logical Steps

- Discrete edits create one history step.
- Continuous interactions such as move, resize, and rotate create one history
  step for the full interaction, not one step per frame.
- Text editing creates one history step for the completed edit, not one step per
  keystroke.

## Undo And Redo

- Undo restores the document to the previous completed history step.
- Redo reapplies the most recently undone step.
- A new edit clears any redo path ahead of the current state.

## What History Tracks

- History tracks document-changing actions.
- A history step is created when a node is pasted onto the canvas.
- History does not track temporary UI state such as hover, selection preview, or
  viewport movement.

## No-Op And Canceled Changes

- If an interaction produces no document change, it should not create a history
  step.
- If an in-progress change is canceled, the document should return to its
  pre-change state and no new history step should be added.
