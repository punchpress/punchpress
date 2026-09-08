# Workspace verification

Baseline: `d4e6d4a`. Agent browser observations are from 2026-09-07.
A pass covers only the named observation; source tests do not substitute for UI checks.
Use disposable artwork. A question result must be recorded before defining intended behavior.

## Layers

Description: [Layers](../workspace/layers.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| LAYER-01 | P1 | Mouse + keyboard unless stated | [Row selection](../workspace/layers.md#press) | 1. Create Frame and shape. 2. Click Frame row, then shape. | Canvas and properties follow chosen row. | pass; agent UI 2026-09-07; Frame/raster selection observed |
| LAYER-02 | P1 | Mouse + keyboard unless stated | [Sibling sorting and Frame drop](../workspace/layers.md#release) | 1. Drag sibling across another. 2. Drop non-Frame onto Frame. | Order changes; Frame drop reparents. | not run |
| LAYER-03 | P1 | Mouse + keyboard unless stated | [Rejected sorting](../workspace/layers.md#while-dragging) | 1. Try parent onto descendant. 2. Try ordinary cross-parent drop. | Invalid moves rejected. | not run |
| LAYER-04 | P2 | Mouse + keyboard unless stated | [Rename endings](../workspace/layers.md#release) | 1. Rename eligible group. 2. Enter, blur, Escape in separate runs. | Enter/blur commit; Escape restores label. | not run |
| LAYER-05 | P1 | Mouse + keyboard unless stated | [Sort cancellation](../workspace/layers.md#cancel-and-interrupt) | 1. Drag row. 2. Escape, blur, outside release, touch cancel separately. | Record cleanup and any committed order. | blocked; held-pointer interruption or physical-device input not available in this pass |

## Properties

Description: [Properties](../workspace/properties.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| PROP-01 | P1 | Mouse + keyboard unless stated | [Empty numeric draft](../workspace/properties.md#while-dragging) | 1. Select1080px Frame. 2. Focus Width. 3. Select all and Backspace. | Record whether blank draft preserves1080. Actual width becomes1. | fail; agent UI confirmed B-01 |
| PROP-02 | P2 | Mouse + keyboard unless stated | [Numeric replacement](../workspace/properties.md#release) | 1. After PROP-01 type1080. 2. Blur. | Frame width returns1080. | pass; agent UI 2026-09-07 |
| PROP-03 | P1 | Mouse + keyboard unless stated | [Property interruptions](../workspace/properties.md#cancel-and-interrupt) | 1. Start scrub. 2. Change tool/selection. 3. Repeat with Escape and blur. | Record commit boundaries; unmount commits active mark. | not run |
| PROP-04 | P2 | Mouse + keyboard unless stated | [Fractional display](../workspace/properties.md#edge-cases) | 1. Enter12.5 in supported simple numeric field. 2. Blur. | Document may retain fraction while display rounds; record both visible states. | not run |
| PROP-05 | P2 | Mouse + keyboard unless stated | [Raster settings without compatible target](../workspace/properties.md#summary) | 1. Select text. 2. Press B. | Brush settings visible despite unsupported paint target. | pass; agent UI 2026-09-07 |

## Commands and settings

Description: [Commands and settings](../workspace/commands-and-settings.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| COMMAND-01 | P2 | Mouse + keyboard unless stated | [Command menu opens from input](../workspace/commands-and-settings.md#press) | 1. Focus Properties input. 2. Cmd+K. | Command menu opens. | pass; agent UI 2026-09-07 |
| COMMAND-02 | P1 | Mouse + keyboard unless stated | [K-close query retention](../workspace/commands-and-settings.md#release) | 1. Search assets. 2. Cmd+K to close. 3. Cmd+K to open. | Record inconsistent reset: prior query retained. | fail; agent UI confirmed B-02 |
| COMMAND-03 | P2 | Mouse + keyboard unless stated | [Escape query reset](../workspace/commands-and-settings.md#release) | 1. With assets query press Escape. 2. Reopen. | Search is empty. | pass; agent UI 2026-09-07 |
| COMMAND-04 | P2 | Mouse + keyboard unless stated | [No-match search](../workspace/commands-and-settings.md#while-dragging) | 1. Enter a term not matching Assets. | No results found. | not run |
| COMMAND-05 | P2 | Mouse + keyboard unless stated | [Theme persistence](../workspace/commands-and-settings.md#begin-dragging) | 1. Choose theme in Settings. 2. Close/reopen or reload. | Theme remains; Settings reopens Appearance. | not run |
| COMMAND-06 | P2 | Mouse + keyboard unless stated | [Debug refresh/copy failure](../workspace/commands-and-settings.md#while-dragging) | 1. Open Debug. 2. Refresh. 3. Copy with allowed and denied clipboard access. | Fresh dump; Copied on success or visible failure message. | not run |

## History

Description: [History](../cross-cutting/history.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| HISTORY-01 | P1 | Mouse + keyboard unless stated | [Undo a completed move](../cross-cutting/history.md#the-simple-case) | 1. Move shape. 2. Undo once. | Starting geometry restored. | pass; agent UI 2026-09-07 |
| HISTORY-02 | P1 | Mouse + keyboard unless stated | [Undo erased pixels](../cross-cutting/history.md#the-simple-case) | 1. Paint raster stroke. 2. Erase crossing gap. 3. Undo once. | Pixels restored; observed tool returns Pointer. | pass; agent UI 2026-09-07 |
| HISTORY-03 | P1 | Mouse + keyboard unless stated | [Redo branch](../cross-cutting/history.md#release) | 1. Edit. 2. Undo. 3. Redo. 4. Undo then new edit. | Redo reapplies; new edit clears old redo branch. | not run |
| HISTORY-04 | P1 | Mouse + keyboard unless stated | [Undo while gesture active](../cross-cutting/history.md#cancel-and-interrupt) | 1. Start move/resize. 2. Undo while held. 3. Continue and release. | Record invalidated-mark/preview behavior. | blocked; held-pointer interruption or physical-device input not available in this pass |

## Performance

Description: [Performance](../cross-cutting/performance.md).

| ID | Priority | Device | Claim | Setup and steps | Expected result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| PERF-01 | P2 | Mouse + keyboard unless stated | [HUD shortcut](../cross-cutting/performance.md#press) | 1. Editor focus. 2. Cmd+Shift+P. | Performance HUD appears. | pass; agent UI 2026-09-07 |
| PERF-02 | P1 | Mouse + keyboard unless stated | [Cancel destructive benchmark prompt](../cross-cutting/performance.md#release-without-dragging) | 1. Disposable content. 2. Request scratch benchmark. 3. Cancel. | Artwork remains; benchmark not started. | pass; agent UI 2026-09-07 |
| PERF-03 | P1 | Mouse + keyboard unless stated | [Scratch completion and error](../cross-cutting/performance.md#release) | 1. Disposable content only. 2. Confirm benchmark. 3. Repeat an error scenario. | Result/status recorded; scratch scene clears after either ending. | not run |

