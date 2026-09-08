# Hand-tool checklist

Source: [the hand tool](../tools/hand-tool.md). Baseline: `d4e6d4a`.
For each row, start afresh with a disposable frame using "Add artboard", selected
in Layers, with editor focus outside inputs, menus, and dialogs unless the row
says otherwise. "Agent pass"
means UI input and visual/accessibility observation on 2026-09-07.

| ID | Priority | Device | Claim / question | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| HAND-01 | P2 | Keyboard | H activates Hand | 1. Start in Pointer. 2. Press H. | Hand is selected in toolbar. | pass; agent pass |
| HAND-02 | P1 | Mouse | Hand pans | 1. Select Hand. 2. Drag frame body right/down. 3. Release. | Frame visibly moves right/down. | pass; agent pass; distance unmeasured |
| HAND-03 | P1 | Mouse | Selection, size, zoom retained | 1. Note selected frame and displayed size/zoom. 2. Perform HAND-02. | Same frame remains selected; size and zoom displays unchanged. | pass; agent pass; 4500 x 5400 and 21% |
| HAND-04 | P2 | Mouse | Hand remains active | 1. Perform HAND-02. 2. Inspect toolbar after release. | Hand remains selected. | pass; agent pass |
| HAND-05 | P2 | Keyboard | Idle Escape selects Pointer | 1. Finish a Hand drag. 2. Press Escape. | Pointer selected; view does not reset. | pass; agent pass |
| HAND-06 | P1 | Keyboard + mouse | Temporary pan | 1. Select Pointer. 2. Hold Space. 3. Drag. 4. Release mouse then Space. | View pans; Pointer remains selected. | not run |
| HAND-07 | P1 | Keyboard + mouse | Space released during drag | 1. Start temporary pan. 2. Release Space while mouse held. 3. Move again, then release. | Record whether pan stops immediately or continues; update open question. | not run |
| HAND-08 | P1 | Keyboard + mouse | Escape during drag | 1. Start Hand drag. 2. Press Escape while mouse held. 3. Move again. | Record selected tool, continued movement, and any rollback. | not run |
| HAND-09 | P1 | Keyboard + mouse | Tool switch during drag | 1. Start Hand drag. 2. Press V while held. 3. Move and release. | Record whether drag stops and whether selection changes. | not run |
| HAND-10 | P1 | Keyboard + mouse | Focus loss during drag | 1. Start pan. 2. Focus another window. 3. Release there and return. 4. Repeat for temporary pan. | Record stuck movement; temporary Space mode should clear. | not run |
| HAND-11 | P1 | Mouse | Release outside window | 1. Start Hand drag. 2. Leave browser window. 3. Release outside. 4. Return. | Record whether movement ends and next press works. | not run |
| HAND-12 | P1 | Keyboard + mouse | Pan excluded from undo | 1. Add disposable frame. 2. Pan. 3. Undo once. | Frame creation undone; pan was not a history step. | not run |
| HAND-13 | P1 | Keyboard | Space inside inputs | 1. Focus an inline text editor. 2. Type words separated by Space. 3. Repeat in an appropriate properties input. | Space reaches input; temporary pan does not activate. | not run |
| HAND-14 | P2 | Mouse | Click without motion | 1. Select Hand. 2. Press/release without motion. | View and selection unchanged; Hand stays active. | not run |
| HAND-15 | P2 | Keyboard + mouse | Drag modifiers | 1. Repeat Hand drag with Shift, Alt, Ctrl, Cmd. 2. Repeat changing each during drag. | Record axis, speed, and interruption behavior separately. | not run |
| HAND-16 | P1 | Keyboard + mouse | Space takeover | 1. Start an object-move drag in Pointer. 2. Hold Space midway. 3. Move and release. | Record whether view or object moves and how history resolves. | not run |
| HAND-17 | P1 | Keyboard + mouse | Menu and history during pan | 1. Start Hand drag. 2. Try menu shortcut, Undo, Redo in separate runs. | Record whether pan continues and what document state changes. | not run |
| HAND-18 | P2 | Mouse | Alternate targets | 1. Pan over empty workspace, group, locked object, and selection handle in separate runs. | Record successful pan and any unexpected edits. | not run |
| HAND-19 | P2 | Keyboard + mouse | Target deletion | 1. Select disposable frame. 2. Start Hand drag. 3. Press Delete. 4. Continue and release. | Record deletion and viewport continuation. | not run |
| HAND-20 | P2 | Browser | Reload during pan | 1. Pan with disposable content. 2. Reload mid-gesture. | Record restored view and document; restoration not yet specified. | not run |
| HAND-21 | P2 | Touch / stylus | Device takeover | 1. Start pan on touch-capable device. 2. Add second touch, cancel touch, and switch device in separate runs. | Record behavior; no mouse-to-touch equivalence assumed. | not run |
| HAND-22 | P3 | Mouse | Cursor and motion | 1. Hover Hand. 2. Drag very slowly, then quickly. 3. Release. | Record cursor shapes, smallest motion, and post-release movement. | not run |
| HAND-23 | P2 | Keyboard + mouse | Pressed-state interruptions | 1. Press without moving. 2. Try Escape, V, focus loss, and leaving window in separate runs. 3. Release. | Record each transition; compare with mid-drag rows. | not run |

## Not checkable by this pass

Deciding whether these detailed descriptions should replace the existing docs
is a product/documentation decision. A green checklist does not make that decision.
