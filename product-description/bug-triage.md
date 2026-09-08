# Bug triage

Seventeen deduplicated findings from the description pass. Two are confirmed by
agent-driven browser input; the rest are source-supported risks or product calls.
The three high-severity entries concern persistence or font substitution and
need controlled reproduction.
No application fixes or external issues were made. All source references use
PunchPress baseline `d4e6d4a`; line ranges describe that baseline.

| ID | Finding | Severity | Decision | Evidence |
| --- | --- | --- | --- | --- |
| [B-05](#b-05) | A quick tab switch can discard the pending scratchpad save | high | fix | source reviewed |
| [B-06](#b-06) | An edit during a pending save can be marked saved without being written | high | fix | source reviewed |
| [B-17](#b-17) | Opening before font access can replace valid font descriptors | high | product call | source reviewed |
| [B-01](#b-01) | Clearing a numeric field immediately changes the artwork | medium | fix | browser confirmed |
| [B-03](#b-03) | Pointer cancellation retains partial transforms and guide edits | medium | product call | source reviewed |
| [B-07](#b-07) | Opening the same browser file can create duplicate tabs | medium | fix | source reviewed |
| [B-08](#b-08) | Asset pagination can mix results from two search queries | medium | fix | source reviewed |
| [B-10](#b-10) | Pen handle activation changes with zoom | medium | product call | source reviewed |
| [B-11](#b-11) | Escape can leave a Shape placement alive until pointer release | medium | fix | source reviewed |
| [B-12](#b-12) | Joining separated endpoints removes the final anchor | medium | product call | source reviewed |
| [B-13](#b-13) | Merging differently styled curves loses the other styles | medium | product call | source reviewed |
| [B-14](#b-14) | Text warp handles and panel values have different ranges | medium | product call | source reviewed |
| [B-15](#b-15) | External image clipboard paste is swallowed | medium | product call | source reviewed |
| [B-02](#b-02) | Command-menu reset depends on how it was closed | low | fix | browser confirmed |
| [B-04](#b-04) | Selected-object preparation can bypass the drag-distance threshold | low | fix | source reviewed |
| [B-09](#b-09) | The native Export SVG label can launch PNG export | low | fix | source reviewed |
| [B-16](#b-16) | Desktop update progress described in existing docs is not shown | low | product call | source reviewed |

## B-05

### A quick tab switch can discard the pending scratchpad save

The pending write is canceled when the active editor changes. Expected: leaving Scratchpad flushes the latest content or keeps its pending save alive.

Reproduce: Edit the Scratchpad, switch within 400 ms to a clean file tab, then reload without returning to Scratchpad. Compare restored content with the edit.

Source cause: apps/web/src/workspace/workspace-provider.tsx:151–166 subscribes only to the active scratchpad and clears its debounce timer on cleanup without a flush.

Severity: high. Decision needed: fix.

Raised by [documents/workspace-tabs.md](./documents/workspace-tabs.md#open-questions-and-verification), checklist TABS-15.

Status: Source-supported; timed browser reproduction still required. No data-loss claim is marked browser-confirmed.

## B-06

### An edit during a pending save can be marked saved without being written

Serialization captures A before the awaited write, but completion marks current B saved. Expected: only the saved snapshot/revision establishes the clean baseline.

Reproduce: Use a destination with a controlled slow write. Save document A; edit it to B while the write is pending; let it finish. Close/reopen and compare B with disk.

Source cause: apps/web/src/components/panels/document-commands/use-document-commands.ts:163–178 serializes before await and calls tab.editor.markDocumentSaved() after the result without checking revision.

Severity: high. Decision needed: fix.

Raised by [documents/files.md](./documents/files.md#open-questions-and-verification), checklist FILE-14.

Status: Source-supported; needs a slow-write reproduction and confirmation of which input remains available during that write.

## B-17

### Opening before font access can replace valid font descriptors

Browser local-font initialization can return an empty catalog while waiting for
permission. Opening a file nevertheless treats fonts absent from that catalog
as missing, replaces their descriptors with the default, and establishes the
substituted document as the saved baseline. Expected: distinguish an unqueried
catalog from a confirmed missing face and preserve original descriptors until
the replacement policy can make an informed choice.

Reproduce: in a browser before enabling local fonts, open a `.punch` fixture
using an installed non-default font. Inspect the resulting font and save/reopen
a disposable copy. Compare with opening after font access is enabled.

Source cause: `apps/web/src/platform/local-fonts.ts:104–109` supplies the
action-required empty catalog; `apps/web/src/workspace/workspace-provider.tsx:184–187`
initializes then loads; `packages/engine/src/document/document-actions.ts:59–68`
replaces fonts before loading/resetting history;
`packages/punch-schema/src/document-fonts.ts:29–44,77–81` identifies absent-catalog
ids and rewrites their descriptors.

Severity: high. Decision needed: product call on substitution timing and warning,
followed by preserving descriptors until availability is actually known.

Raised by [fonts](documents/fonts.md#open-questions-and-verification) and
[files](documents/files.md#open-questions-and-verification), checklist FONT-12.

Status: source-supported; browser permission/file-fixture reproduction unrun.
No claim that every platform or already-authorized catalog loses typography.

## B-01

### Clearing a numeric field immediately changes the artwork

The blank field immediately changes Width from1080 to1. Expected: a temporarily empty draft preserves the existing value until a valid number is entered or explicitly committed.

Reproduce: Create a Social Square Frame. Select it, focus Width, select all, and press Backspace without typing a replacement.

Source cause: apps/web/src/components/panels/properties/number-field.tsx:35–48 converts the empty string with Number and applies the minimum; artboard-fields.tsx:15–20 supplies min1 and live width mutation.

Severity: medium. Decision needed: fix.

Raised by [workspace/properties.md](./workspace/properties.md#open-questions-and-verification), checklist PROP-01.

Status: Confirmed by agent browser UI on2026-09-07: Frame label changed to1 x1080 while field remained blank; typing1080 restored it. PROP-01 records fail.

## B-03

### Pointer cancellation retains partial transforms and guide edits

Changed results use the normal commit path. Explicit engine move cancellation can instead roll back. Decide whether an interrupted gesture should retain its partial result or restore its start, then make the behavior consistent.

Reproduce: Start a move, resize, rotate, corner-radius or text-guide drag. Trigger a real pointer cancellation before release. Inspect retained geometry and Undo.

Source cause: apps/web/src/components/canvas/canvas-node/node-interactions.ts:240–253; canvas-overlay/selection/single-selection-foreground.tsx:666–680,732–747; multi-selection-foreground.tsx:481–495,547–562; canvas-overlay/vector-path/vector-corner-radius-handle.tsx:270–295; canvas-overlay/text/path-guides.tsx:523–534. Paths after canvas/ are relative to apps/web/src/components/canvas/.

Severity: medium. Decision needed: product call.

Raised by [selection/resizing-and-rotating.md](./selection/resizing-and-rotating.md#open-questions-and-verification), checklist TRANSFORM-05.

Status: Source-supported, not hardware-confirmed. Raised also by MOVE-06, PATH-33 and text-warp interruption checks. This entry merges the common commit-on-cancel policy, not a claim that all underlying fixes are identical.

## B-07

### Opening the same browser file can create duplicate tabs

The deduplication key accepts path strings but not browser file handles. Expected under the existing tab contract: reopen focuses the same file, or the product explicitly permits copies and labels them clearly.

Reproduce: Open a .punch file through the browser picker, then open that same file again. Inspect whether it focuses the existing tab or creates another independently editable copy.

Source cause: apps/web/src/workspace/workspace-provider.tsx:19–26 returns no key for browser handles;174–181 only deduplicates when a key exists.

Severity: medium. Decision needed: fix.

Raised by [documents/workspace-tabs.md](./documents/workspace-tabs.md#open-questions-and-verification), checklist TABS-16.

Status: Source-supported; requires browser file access. Native string-path behavior is a separate case.

## B-08

### Asset pagination can mix results from two search queries

Pagination can request B using the previous page counter and append it to A results. Expected: load-more uses the submitted query, or changing the query resets the result set and page.

Reproduce: Search for A and load its first result page. Change the text to B without submitting. Scroll to request the next page.

Source cause: apps/web/src/components/assets/asset-search-panel.tsx:45,60,63–75,130–136 uses current text with existing pagination and appends page>1 results.

Severity: medium. Decision needed: fix.

Raised by [workspace/assets.md](./workspace/assets.md#open-questions-and-verification), checklist ASSET-09.

Status: Source-supported; service-backed reproduction not run.

## B-10

### Pen handle activation changes with zoom

The12-unit handle threshold compares workspace coordinates. A10px drag predicts a handle at50% but not100% or200%. Decide whether activation should use screen distance or intentionally scale with document zoom.

Reproduce: At50%,100%,200% zoom, start separate Pen paths and drag the first anchor by the same10 screen pixels. Compare whether a handle appears.

Source cause: packages/engine/src/tools/pen-tool-types.ts:99–117; pen-tool-draft-placement.ts:263–269,292–299; primitives/pointer-distance.ts:7.

Severity: medium. Decision needed: product call.

Raised by [tools/pen.md](./tools/pen.md#open-questions-and-verification), checklist PEN-16.

Status: Source-supported prediction; matched physical drags at the three zoom levels remain unrun.

## B-11

### Escape can leave a Shape placement alive until pointer release

Escape selects Pointer but does not remove placement listeners. Release can still complete the shape. Expected if Escape is cancel: no new shape is committed after leaving the gesture.

Reproduce: Press R, begin a100px drag, keep the pointer held, press Escape, then release.

Source cause: packages/engine/src/tools/shape-tool.ts:43–45 changes tool only; apps/web/src/components/canvas/canvas-tool-placement-session.ts:120–145 retains pointer completion listeners.

Severity: medium. Decision needed: fix.

Raised by [tools/shape.md](./tools/shape.md#open-questions-and-verification), checklist SHAPE-17.

Status: Source-supported; held-pointer keyboard reproduction not run.

## B-12

### Joining separated endpoints removes the final anchor

The final anchor is removed and its incoming handle is assigned to the first anchor, yielding a closed two-anchor contour. Decide whether Join should bridge the endpoints, merge only coincident endpoints, or intentionally replace geometry as now.

Reproduce: Create an open bent three-anchor path with distinct endpoints. Select both endpoints and choose Join endpoints.

Source cause: packages/engine/src/document/path/path-topology-actions.ts:180–231, especially208–213. apps/web/tests/editor-contract/vector-path-topology.test.ts:202–242 explicitly expects3→2.

Severity: medium. Decision needed: product call.

Raised by [editing/path-editing.md](./editing/path-editing.md#open-questions-and-verification), checklist PATH-25.

Status: Source and passing test describe current behavior. This is an intentional-behavior review, not an unqualified implementation bug.

## B-13

### Merging differently styled curves loses the other styles

Merged contours use the first path style; Separate cannot reconstruct the previous colors. Decide whether to reject mixed styles, preserve them in a vector container, or disclose flattening to one style.

Reproduce: Create red and blue sibling paths. Select red first, then blue; Merge Curves. Separate Curves afterward.

Source cause: packages/engine/src/document/path/path-curve-actions.ts:127–135 allows same-parent paths without style equality;228–240 builds from the first path.

Severity: medium. Decision needed: product call.

Raised by [editing/path-editing.md](./editing/path-editing.md#open-questions-and-verification), checklist PATH-26.

Status: Source-supported; documented as a potentially surprising product choice rather than automatically wrong.

## B-14

### Text warp handles and panel values have different ranges

Handle updates can store values outside the panel clamps. The panel then changes the value to its permitted range. Decide on shared bounds or controls that faithfully accept the existing value.

Reproduce: Drag Wave amplitude beyond500 or Slant rise beyond400 through on-canvas controls, then edit that value in Properties.

Source cause: packages/engine/src/transform/text-path-edit.ts:395–399,480–485 writes unbounded amplitude/rise; apps/web/src/components/panels/properties/text-warp-fields.tsx:162–168,295–301 clamps±500/±400.

Severity: medium. Decision needed: product call.

Raised by [editing/text-warps.md](./editing/text-warps.md#open-questions-and-verification), checklist WARP-16 / WARP-17.

Status: Source-supported; extremes and panel interaction not yet browser-confirmed.

## B-15

### External image clipboard paste is swallowed

The clipboard listener prevents default for file items and returns without inserting artwork. Existing clipboard docs describe image support. Decide whether to implement image-byte paste or keep it unsupported and align the public contract.

Reproduce: Copy actual PNG image bytes from another application. Focus canvas and paste.

Source cause: apps/web/src/editor-react/use-editor-clipboard-events.ts:107–110 detects file items, prevents default, and returns. File/drop import is a different path.

Severity: medium. Decision needed: product call.

Raised by [documents/import.md](./documents/import.md#open-questions-and-verification), checklist IMP-16.

Status: Source-supported feature gap versus existing docs; native clipboard bytes not exercised in this pass.

## B-02

### Command-menu reset depends on how it was closed

K-close retains assets while Escape-close clears it. Expected: both dismissal paths follow the chosen reset policy.

Reproduce: Open Cmd+K, type assets, close with Cmd+K and reopen. Compare with closing through Escape and reopening.

Source cause: apps/web/src/components/command-menu/command-menu.tsx:87–106 resets only in handleOpenChange; the key listener toggles setOpen directly.

Severity: low. Decision needed: fix.

Raised by [workspace/commands-and-settings.md](./workspace/commands-and-settings.md#open-questions-and-verification), checklist COMMAND-02.

Status: Confirmed by agent browser UI on2026-09-07, both dismissal paths compared. COMMAND-02 records fail; COMMAND-03 records reset pass.

## B-04

### Selected-object preparation can bypass the drag-distance threshold

A pre-created session passes the movement gate without the three-pixel check, so tiny movements can become edits. Expected if the named tolerance is universal: preparation does not relax gesture activation.

Reproduce: Select an object. Press and hold long enough for an animation frame, move one screen pixel, then release. Compare an initially unselected target.

Source cause: apps/web/src/components/canvas/canvas-node/node-interactions.ts:186–217 prepares dragSession and accepts dragSession OR distance threshold; equivalent selection overlay paths also prepare sessions.

Severity: low. Decision needed: fix.

Raised by [selection/moving.md](./selection/moving.md#open-questions-and-verification), checklist MOVE-05.

Status: Source-supported; precise held-pointer one-pixel comparison remains unrun.

## B-09

### The native Export SVG label can launch PNG export

The selected-Frame branch requests PNG. Expected: label reflects selection-sensitive format, or the labeled SVG command always exports SVG.

Reproduce: In desktop, select one Frame and choose native File > Export SVG.

Source cause: apps/desktop/src-electron/application-menu.ts:129–132 labels Export SVG; apps/web/src/components/panels/document-commands/use-document-commands.ts:255–267 uses selected-Frame PNG export.

Severity: low. Decision needed: fix.

Raised by [documents/desktop.md](./documents/desktop.md#open-questions-and-verification), checklist DESK-15 / EXP-16.

Status: Source-supported; desktop menu/picker not run.

## B-16

### Desktop update progress described in existing docs is not shown

The indicator renders only when ready. Existing docs promise progress states. Decide whether the UI should show those states or the documentation should state ready-only behavior.

Reproduce: On a desktop build with an available update, observe checking/downloading before the downloaded state.

Source cause: apps/web/src/components/editor/desktop-update-indicator.tsx:24–26 returns null for every non-ready state.

Severity: low. Decision needed: product call.

Raised by [documents/desktop.md](./documents/desktop.md#open-questions-and-verification), checklist DESK-10.

Status: Source-supported documentation/feature mismatch; updater lifecycle not exercised.
