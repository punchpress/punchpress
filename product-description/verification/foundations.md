# Foundations verification

Baseline: `d4e6d4a`. Agent browser observations are from 2026-09-07.
A pass covers only the named observation; source tests do not substitute for UI checks.
Use disposable artwork. A question result must be recorded before defining intended behavior.

## Input

Description: [Input](../foundations/input.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| INPUT-01 | P1 | Mouse + keyboard unless stated | [Input focus blocks tool letters](../foundations/input.md#focus-and-shortcut-order) | 1. Focus inline text. 2. Type a word containing tool letters. | Text input receives letters; canvas tool does not change. | pass; agent UI 2026-09-07; POD TEST typed in inline field |
| INPUT-02 | P1 | Mouse + keyboard unless stated | [Popup Space exclusion question](../foundations/input.md#focus-and-shortcut-order) | 1. Open menu. 2. Focus a non-input item. 3. Hold Space and drag canvas. | Record whether canvas pans beneath popup. | blocked; held-pointer interruption or physical-device input not available in this pass |
| INPUT-03 | P1 | Mouse + keyboard unless stated | [Pointer cancellation policy](../foundations/input.md#ending-is-not-always-canceling) | 1. Start move/resize/rotate. 2. Trigger real pointer cancellation on each. | Record retained versus rolled-back content. | blocked; held-pointer interruption or physical-device input not available in this pass |
| INPUT-04 | P1 | Mouse + keyboard unless stated | [Small movement on selected object](../foundations/input.md#gesture-phases) | 1. Select shape. 2. Hold press for one frame. 3. Move one screen pixel. 4. Release. | Record whether movement bypasses three-pixel policy. | not run |

## Objects

Description: [Objects](../foundations/objects.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| OBJECT-01 | P2 | Mouse + keyboard unless stated | [Frame labels](../foundations/objects.md#object-families) | 1. New File. 2. Select Social Square. 3. Create. | 1080x1080 Frame; UI still uses artboard labels elsewhere. | pass; agent UI 2026-09-07 |
| OBJECT-02 | P1 | Mouse + keyboard unless stated | [View does not edit content](../foundations/objects.md#document-and-session-state) | 1. Select frame. 2. Pan with Hand. | Selection and displayed size/zoom retained. | pass; pilot UI 2026-09-07 |

## Tools

Description: [Tools](../foundations/tools.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| TOOL-01 | P2 | Mouse + keyboard unless stated | [Tool activation](../foundations/tools.md#tool-entry) | 1. Press H, Escape, R, T, B, E with editor focus. | Tool changes match shortcuts. | pass; agent UI 2026-09-07 |
| TOOL-02 | P1 | Mouse + keyboard unless stated | [Node entry](../foundations/tools.md#switching-and-finishing) | 1. Select one path. 2. Press A. 3. Compare multi-selection. | Single eligible target enters editing; multi-selection does not auto-enter. | not run |

## Viewport

Description: [Viewport](../foundations/viewport.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| VIEW-01 | P1 | Mouse + keyboard unless stated | [Zoom bounds](../foundations/viewport.md#scale-and-movement) | 1. Zoom out repeatedly. 2. Zoom in repeatedly. | Stops at1% and200%. | not run |
| VIEW-02 | P1 | Mouse + keyboard unless stated | [Pointer-anchored wheel zoom](../foundations/viewport.md#scale-and-movement) | 1. Place pointer on shape edge. 2. Cmd/Ctrl-wheel. | Same workspace point stays under pointer within rounding tolerance. | not run |
| VIEW-03 | P2 | Mouse + keyboard unless stated | [First insertion fit](../foundations/viewport.md#placement-and-fitting) | 1. Empty workspace. 2. Add a 4500 x 5400 Frame. 3. Add another Frame. | First Frame fits the view; later insertions do not refit automatically. | partial; pilot first Frame fit at 21%; later insertion condition not run |
