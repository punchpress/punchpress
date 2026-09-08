# Selection verification

Baseline: `d4e6d4a`. Agent browser observations are from 2026-09-07.
A pass covers only the named observation; source tests do not substitute for UI checks.
Use disposable artwork. A question result must be recorded before defining intended behavior.

## Selecting

Description: [Selecting](../selection/selecting.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| SELECT-01 | P1 | Mouse + keyboard unless stated | [Click selection](../selection/selecting.md#press) | 1. Create shape. 2. Click its body in Pointer. | Shape selected and matching Properties shown. | pass; agent UI 2026-09-07 |
| SELECT-02 | P1 | Mouse + keyboard unless stated | [Marquee enclosure](../selection/selecting.md#release) | 1. Two separated shapes. 2. Partly cross one, fully enclose other. 3. Release. | Only fully enclosed eligible object selected. | not run |
| SELECT-03 | P1 | Mouse + keyboard unless stated | [Shift toggle and marquee release](../selection/selecting.md#modifiers) | 1. Shift-click second object. 2. Repeat to remove. 3. Change Shift before marquee release. | Toggle membership; release-time Shift controls addition. | not run |
| SELECT-04 | P1 | Mouse + keyboard unless stated | [Marquee interrupted](../selection/selecting.md#cancel-and-interrupt) | 1. Start marquee. 2. Try Escape, tool change, focus loss, outside release in separate runs. | Record final selection and cleanup separately for each event. | blocked; held-pointer interruption or physical-device input not available in this pass |
| SELECT-05 | P2 | Mouse + keyboard unless stated | [Path editing suppresses object marquee](../selection/selecting.md#edge-cases) | 1. Enter path editing. 2. Drag empty area. | Object marquee does not select unrelated nodes. | not run |

## Moving

Description: [Moving](../selection/moving.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| MOVE-01 | P1 | Mouse + keyboard unless stated | [Body drag](../selection/moving.md#while-dragging) | 1. Selected200x150 ellipse at(400,400). 2. Drag body by150,200 screen pixels at100%. | Ellipse and bounds move together; dimensions retained. | pass; agent UI 2026-09-07 |
| MOVE-02 | P1 | Mouse + keyboard unless stated | [Move Undo](../selection/moving.md#release) | 1. Finish MOVE-01. 2. Cmd+Z once. | Original position restored. | pass; agent UI 2026-09-07 |
| MOVE-03 | P1 | Mouse + keyboard unless stated | [Alt duplication latch](../selection/moving.md#modifiers) | 1. Hold Alt before press, drag/release. 2. Repeat adding Alt only after start. | Only first gesture duplicates; late Alt does not. | blocked; held-pointer interruption or physical-device input not available in this pass |
| MOVE-04 | P1 | Mouse + keyboard unless stated | [No-motion Alt press](../selection/moving.md#release-without-dragging) | 1. Alt-press selected artwork. 2. Release without moving. | No persistent duplicate or move. | not run |
| MOVE-05 | P1 | Mouse + keyboard unless stated | [Tiny selected drag](../selection/moving.md#edge-cases) | 1. Select shape. 2. Hold press briefly. 3. Move1px and release. | Record whether selected prewarm bypasses threshold. | not run |
| MOVE-06 | P1 | Mouse + keyboard unless stated | [Move interruption matrix](../selection/moving.md#cancel-and-interrupt) | 1. Separate drags: Escape, V, Undo, blur, outside release, pointercancel, target deletion. | Record each result; pointercancel source path keeps moved content. | blocked; held-pointer interruption or physical-device input not available in this pass |

## Resizing and rotating

Description: [Resizing and rotating](../selection/resizing-and-rotating.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| TRANSFORM-01 | P1 | Mouse + keyboard unless stated | [Single box resize](../selection/resizing-and-rotating.md#while-dragging) | 1. Ellipse200x150 at(400,400). 2. Drag southeast handle to(680,600). | 280x200; northwest anchor stays at(400,400). | pass; agent UI 2026-09-07 |
| TRANSFORM-02 | P1 | Mouse + keyboard unless stated | [Resize Undo](../selection/resizing-and-rotating.md#release) | 1. Finish TRANSFORM-01. 2. Undo once. | 200x150 restored. | pass; agent UI 2026-09-07 |
| TRANSFORM-03 | P1 | Mouse + keyboard unless stated | [Ratio modes](../selection/resizing-and-rotating.md#modifiers) | 1. Resize single box with Shift. 2. Toggle while held. 3. Compare group resize. | Single box follows Shift; group uniform scale without extra Shift mode. | blocked; held-pointer interruption or physical-device input not available in this pass |
| TRANSFORM-04 | P1 | Mouse + keyboard unless stated | [Rotation center and wrap](../selection/resizing-and-rotating.md#while-dragging) | 1. Drag rotation perimeter across angle boundary. 2. Undo. | Continuous rotation around center and one-step restoration. | not run |
| TRANSFORM-05 | P1 | Mouse + keyboard unless stated | [Transform interruptions](../selection/resizing-and-rotating.md#cancel-and-interrupt) | 1. Separate resize/rotate runs: Escape, tool change, Undo, blur, pointercancel, deletion. | Record retained content and cleanup; pointercancel commits in source. | blocked; held-pointer interruption or physical-device input not available in this pass |
| TRANSFORM-06 | P2 | Mouse + keyboard unless stated | [Frame edge limits](../selection/resizing-and-rotating.md#edge-cases) | 1. Select Frame. 2. Resize past opposite edge. | No negative dimensions; minimum one unit; no rotation affordance. | not run |

