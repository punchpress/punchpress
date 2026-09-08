# Goal: describe PunchPress behavior

Read [README.md](README.md), [glossary.md](glossary.md), and the
[hand-tool pilot](tools/hand-tool.md). The user has now authorized the complete
workflow: all planned descriptions, consistency review, verification checklists,
an agent-driven verification pass, and consolidated bug triage.

## Reading order

The source repository is the parent directory. Read the feature's engine tool
and commands, shared input dispatch, related tests, browser handlers, then
defaults and styling. Read relevant existing `docs/` pages, but verify their
claims against the implementation. Apply the parent AGENTS instructions.

The pilot's key evidence is `packages/engine/src/tools/hand-tool.ts`,
`tools/tool.ts`, `input/keyboard-shortcuts.ts`, `lifecycle/editor-lifecycle.ts`,
`viewport/viewport-queries.ts`, and `apps/web/src/components/canvas/canvas.tsx`.
The wheel-pan E2E tests cover neighboring behavior, not hand dragging.

## Working rules

- Keep all generated description work here. Preserve existing app code and docs.
- Use the eight sections, fixed modifier/interrupt rows, and concern order in
  README. Explain what happens to the user at every phase.
- Record unresolved behavior as a question. Never infer that a missing handler
  means no behavior: a browser or dependency may own it.
- Use the glossary's terms. Add necessary definitions before introducing terms.
- Keep technical explanations in `> Technical note:` blocks.
- Cite the source commit in feature footers and distinguish source review from
  browser observations. If the source commit changes, settle the new baseline
  before continuing; do not silently mix versions.
- Add one reproducible checklist item per observable claim. Record which device,
  setup, and evidence support a result. Agent-only passes remain `drafted`.
- Keep missing evidence separate from suspected defects. Add a triage entry only
  when there is an identified wrong behavior and a supported cause.
- Update Structure and Coverage together. Do not expand the whole-product plan
  by cloning the existing docs inventory without examining feature boundaries.
- Follow the parent repository's commit and push rules. This directory does not
  authorize shipping, replacing docs, or filing issues.

## Things already established

Read `foundations/input.md`, `objects.md`, `tools.md`, and `viewport.md` before
feature work. Selection owns object targeting and marquees; moving owns body
and overlay translation plus Alt duplication; resizing-and-rotating owns handle
transforms. Path-point editing and raster strokes have separate owners.

- Frame and Raster layer are the domain terms; quote legacy UI labels exactly.
- Zoom spans 1%–200%; wheel zoom is capped at 10% of current scale per event.
- Plain selection and viewport changes do not add document undo changes.
- Named pointer/placement/Pen tolerances are 3, vector point/corner/marquee
  tolerances 4. Check caller units: Pen handle authoring compares document-space
  points; selected-object prewarming can bypass the move threshold.
- Space is temporary pan, not a tool change. Focus loss clears modifiers.
- Browser pointercancel commits moved/resized/rotated selections in reviewed
  handlers; explicit engine cancel may roll back. Never generalize cancellation.
- Read source and tests for each feature. Existing product docs are context,
  not sufficient evidence of actual behavior.
- Workers own only assigned feature/checklist files. Return proposed glossary
  terms and triage evidence to the coordinator; do not race on shared files.

## Next work

All planned descriptions and checklists are drafted and cross-reviewed. The
first agent browser pass and consolidated triage are recorded in
[verification/README.md](verification/README.md) and [bug-triage.md](bug-triage.md).
Next, reproduce the high-severity findings and complete the remaining P1/P2
checks before promoting features to verified. Existing docs remain untouched.
Run the imported link checker after every coherent addition.
