# PunchPress product description

A draft account of what users see, do, and encounter when an interaction stops
halfway. Start with [the hand tool](tools/hand-tool.md) for a worked example.

This set lives alongside the existing `docs/`. It is an experiment in greater
behavioral detail, not an approved replacement. Decide whether to merge, replace,
or retain the existing docs after reviewing the resulting set.

## Scope decisions

- Describe the default web editor at `/`, with mouse and keyboard on macOS.
- Cover the full editor feature set below, including browser workflows and a
  separately labeled desktop comparison. The initial description pass left
  existing docs untouched; the subsequent fix pass updates their contracts.
- Native Electron behavior is source-described as a platform comparison; native
  dialogs, physical touch/stylus, permissions, and external services may remain
  blocked in verification. Record each limitation rather than guessing.
- Source is the parent PunchPress repository at commit
  `d4e6d4ae45d2bc71cd122f25fd747c793c9f650b`. Existing uncommitted agent/domain docs
  are context, not proof of shipped behavior. No application changes were present
  at the start of the pilot.
- Output stays in `product-description/`, using the monorepo's Git history.
  Do not create another repository or replace its root README or AGENTS files.
- The glossary follows PunchPress's `CONTEXT.md`. Quote conflicting visible UI
  labels exactly and explain the discrepancy.

## Method and conventions

Read code and tests, draft the behavior, check it in the running editor, then
collect suspected defects. Use [goal.md](goal.md) as the standing instructions
and [glossary.md](glossary.md) for shared terms.

The 25 feature documents use eight sections: summary; the simple case; the interaction,
event by event; modifiers; cancel and interrupt; interactions with other systems;
edge cases; open questions and verification. Four shorter foundation documents
own shared concepts and constants, with headings suited to those facts.

The unit is a gesture. Its phases are press, release without dragging, begin
dragging, while dragging, and release. Include a Mermaid state diagram. The
modifier rows are Shift, Alt/Option, Ctrl/Cmd, and Space, with start/during columns.

Use these interrupt rows in this order: Escape; switching tools; menu opening or
undo/redo; window loses focus; pointer leaves the window; reload or tab close;
target changed or deleted; touch cancel or second input device. Ask each before
and during dragging. An unknown gets an explicit question, never "no effect."

Walk these cross-cutting concerns in order: containers and groups; selection and
locked/hidden objects; history; zoom; offline; touch and stylus; collaboration.
Describe experience in prose. Put necessary implementation detail in
`> Technical note:` blocks. Prefer links over repeated claims.

## Structure

```text
README.md                                   scope, conventions, inventory, coverage
AGENTS.md                                   monorepo boundary
CLAUDE.md                                   Claude entry point
goal.md                                     standing drafting instructions
glossary.md                                 shared vocabulary
foundations/input.md                        focus, gesture tolerances, and endings
foundations/objects.md                      object families and document/session state
foundations/tools.md                        tool transitions and editing modes
foundations/viewport.md                     pan, zoom, and coordinate expectations
selection/selecting.md                      clicks, marquees, and selection scope
selection/moving.md                         move previews and drag duplication
selection/resizing-and-rotating.md          anchors, scale, rotation, and endings
tools/hand-tool.md                          pan pilot
tools/pen.md                                path authoring and point gestures
tools/shape.md                              shape placement and parametric editing
editing/path-editing.md                     Node, points, handles, topology, and corners
editing/compounds.md                        boolean composition and editable vector containers
workspace/groups.md                         group, focus, and ungroup
tools/brush-and-eraser.md                   raster strokes, targets, and cancellation
editing/text.md                             text placement and inline editing
editing/text-warps.md                       arch, wave, slant, circle, and guides
editing/images.md                           raster layers, clipping, and background removal
documents/fonts.md                          font discovery, previews, and missing fonts
documents/workspace-tabs.md                 scratchpad, tabs, presets, and dirty prompts
documents/files.md                          open, save, save as, and recent files
documents/import.md                         image, SVG, drop, and clipboard imports
documents/export.md                         SVG/PNG export and production boundaries
documents/desktop.md                        native shell differences and limits
workspace/assets.md                         asset search and import
workspace/layers.md                         tree selection, order, visibility, and naming
workspace/properties.md                     contextual fields and editing values
workspace/commands-and-settings.md          command menu, appearance, and debug settings
cross-cutting/history.md                    undo, redo, dirty state, and gesture history
cross-cutting/performance.md                visible feedback and performance HUD
verification/README.md                      verification protocol and pass results
verification/hand-tool.md                   hand-tool checklist
verification/foundations.md                 foundations checklist
verification/selection.md                   selection checklist
verification/vector.md                      vector checklist
verification/text-raster.md                 text-raster checklist
verification/documents.md                   documents checklist
verification/workspace.md                   workspace checklist
bug-triage.md                               deduplicated supported suspected defects
```

## Coverage

`drafted` means source-described. `verified` requires a human P1/P2 pass, with
failures triaged. Agent-only passes do not promote a document. Checklists record
what was actually run separately from drafting completeness.

| Document | Status |
| --- | --- |
| README.md | drafted |
| AGENTS.md | drafted |
| CLAUDE.md | drafted |
| goal.md | drafted |
| glossary.md | drafted |
| foundations/input.md | drafted |
| foundations/objects.md | drafted |
| foundations/tools.md | drafted |
| foundations/viewport.md | drafted |
| selection/selecting.md | drafted |
| selection/moving.md | drafted |
| selection/resizing-and-rotating.md | drafted |
| tools/hand-tool.md | drafted |
| tools/pen.md | drafted |
| tools/shape.md | drafted |
| editing/path-editing.md | drafted |
| editing/compounds.md | drafted |
| workspace/groups.md | drafted |
| tools/brush-and-eraser.md | drafted |
| editing/text.md | drafted |
| editing/text-warps.md | drafted |
| editing/images.md | drafted |
| documents/fonts.md | drafted |
| documents/workspace-tabs.md | drafted |
| documents/files.md | drafted |
| documents/import.md | drafted |
| documents/export.md | drafted |
| documents/desktop.md | drafted |
| workspace/assets.md | drafted |
| workspace/layers.md | drafted |
| workspace/properties.md | drafted |
| workspace/commands-and-settings.md | drafted |
| cross-cutting/history.md | drafted |
| cross-cutting/performance.md | drafted |
| verification/README.md | drafted |
| verification/hand-tool.md | drafted |
| verification/foundations.md | drafted |
| verification/selection.md | drafted |
| verification/vector.md | drafted |
| verification/text-raster.md | drafted |
| verification/documents.md | drafted |
| verification/workspace.md | drafted |
| bug-triage.md | drafted |

## Completed pass

All 29 behavior documents are drafted and cross-reviewed. Seven checklists
contain 709 checks. The first agent browser pass records 30 passes, two failures,
one partial check, and nine blocked checks; 667 checks remain unrun. See the
[verification report](verification/README.md) for evidence and limitations.

[Bug triage](bug-triage.md) records 17 deduplicated findings from that baseline.
The user approved all seventeen fixes and product calls. The subsequent fix pass
uses separate implementation tasks, regression tests, UI demos, and coordinator
review. Draft descriptions retain baseline source references; consult the
resolution table for changed behavior. Original checklist counts remain a
historical baseline; current behavior contracts are updated in `docs/`. Agent verification
does not promote these draft descriptions to human-verified status.

## Comparing with existing docs

This set adds event-by-event descriptions, interruption behavior, and explicit
verification gaps. Existing docs also cover architecture, operations, releases,
and exact formats; these behavior documents do not replace those responsibilities.

Source review found several places where existing product descriptions need
reconciliation: raster crop/mask claims, image clipboard paste, and desktop
update progress. Current behavior also needs precise wording around shape-family
switching, compound eligibility, selection after Undo, and CSS-pixel zoom.
Relevant feature documents explain the implementation at the cited baseline.

Keep both sets for now. After the remaining P1/P2 checks, use the findings to
revise the existing product contracts or adopt selected descriptions. Replacing
the whole docs tree would discard useful material outside this experiment's scope.

## Reference

- Engine behavior: `packages/engine/src/tools/`, `input/`, `viewport/`, and `state/`.
- Browser interaction: `apps/web/src/components/canvas/` and `styles/global.css`.
- Tests: `apps/web/tests/editor-contract/` and `apps/web/tests/e2e/`.
- Existing behavior contracts: `docs/product/`; terminology: `CONTEXT.md`.
- Imported method: [product-description skill](../.agents/skills/product-description/SKILL.md).
  Vendored unchanged from [Steve Ruiz's gist](https://gist.github.com/steveruizok/83ae5c53f2784ebf8f5fe0a3fb94480f)
  revision `f9435a3c7b022ecadc8441542675a9163cdb6b7f`.

The user's monorepo placement overrides the upstream method's separate-repo
setup. Existing source documentation remains authoritative until a replacement
decision is made.
