# Plan 009: Drop-import PunchPress SVGs as a frameless group; keep open-import as full document

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (id/asset remapping; insert semantics)
- **Depends on**: 005 (merged as `fc33070e`)
- **Category**: direction / feature
- **Planned at**: commit `836e8a0b`, 2026-06-10 (REVISED after executor investigation: no asset merging exists or is needed — `document.assets` is a save/export-time artifact; live image nodes carry their own raster data)

## Why this matters (owner-specified semantics)

The owner's workflow: build a design in a frame → export SVG → later reuse
that SVG as a component inside other designs. Plan 005 made both import
entry points open the embedded recipe as a new tab (frame included), which
makes component reuse awkward. New contract:

- **File > Import SVG (open)**: unchanged — recipe opens as a new tab, the
  full original document, frame included. Bonus (only if cheap, see Step 5):
  if the recipe has NO artboard, add one sized to fit the content.
- **Canvas drag-drop**: the recipe's CONTENT is inserted into the CURRENT
  document as a single group at the drop point — artboard frames are
  stripped; the user is composing, not reopening.
- Plain SVGs (no recipe) keep today's geometry import in both paths.
- Corrupt recipe still errors without fallback (unchanged from 005).

## Current state

- `apps/web/src/components/canvas/use-canvas-drop.ts` — SVG drop currently:
  `tryParseEmbeddedDocument(svgText)` → kind "document" → `workspace.openDocumentTab(...)`
  (THIS is what changes), kind "none" → `importSvgToNodes` → `editor.insertNodes(nodes)`.
- `apps/web/src/platform/svg-embedded-import.ts` — `tryParseEmbeddedDocument`
  returns `{kind:"document", documentJson}` (re-serialized). For the drop path
  you need the parsed document object, not JSON — extend the result to carry
  the parsed `DesignDocument` too (punch-schema's `parseEmbeddedDesignDocument`
  already returns it; don't re-parse).
- `packages/punch-schema/src/svg-embedded-document.ts` — extraction helper
  from 005 (untouched by this plan).
- Geometry import precedent: `apps/web/src/platform/svg-import-document.ts`
  `importSvgToNodes(source, {targetCenter})` returns a node array (group +
  children) positioned around targetCenter; the drop caller does
  `editor.insertNodes(nodes)`. **Match that contract** for recipe drops.
- Group node factory: `createDefaultGroupNode()` from `@punchpress/engine`
  (see its use in svg-import-document.ts).
- Node ids: fresh ids must be generated for every inserted node (collision
  with the open document is possible — same recipe dropped twice, or dropped
  into the doc it was exported from). Find the repo's id helper (grep how
  `createDefault*Node` ids are made; engine likely exposes a `createNodeId`
  or the model factories self-assign — reuse that, do not invent uuid code).
- Assets (RESOLVED by prior executor's investigation): there is NO live
  asset map — `document.assets` is derived at save/export time by
  `createDocumentAssetsFromNodes`; live image nodes are self-contained
  (`src`, `tileSources`, ...). Conversion therefore needs NO asset merging.
  Guard only: if a recipe image node lacks usable inline data (empty `src`),
  SKIP that node and surface one toast noting skipped images.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Env setup (FIRST — install fails without it) | Codex-managed worktrees copy `.env` through `.worktreeinclude`. | `.env` exists (never commit) |
| Install | `bun install --frozen-lockfile` | exit 0 |
| New tests | `bun test apps/web/tests/editor-contract/document/svg-recipe-drop.test.ts` | all pass |
| Editor suite | `bun run test:editor` | 403+ pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run check` / `bun run fix` | exit 0 |

## Scope

**In scope**:
- `apps/web/src/platform/svg-embedded-import.ts` (extend result shape)
- `apps/web/src/components/canvas/use-canvas-drop.ts` (drop → group insert)
- New conversion helper: `packages/engine/src/document/recipe-component-nodes.ts`
  (or extend an existing cohesive document/ module — follow where similar
  conversion helpers live, e.g. `vector-document-conversion.ts` pattern under
  nodes/vector/)
- `packages/engine/src/index.ts` (export the helper if the web layer calls it)
- `apps/web/tests/editor-contract/document/svg-recipe-drop.test.ts` (create)
- `apps/web/src/components/panels/document-commands/use-document-commands.ts`
  ONLY for Step 5's auto-frame (optional; skip cleanly if not cheap)

**Out of scope**:
- The menu-import path's core behavior (still opens full document as a tab).
- Export side (`packages/engine/src/document/export.ts`) — no format changes.
- Raster runtime files (`brush-*`, `raster-tile-surface`) — off-limits
  (in-flight redesign); copying asset MAP ENTRIES is fine, raster pixel
  pipelines are not yours.
- Undo/history plumbing beyond what `editor.insertNodes` already provides.

## Steps

### Step 1: Conversion helper in the engine

`recipeToComponentNodes(document, { targetCenter })` → `{ nodes, skippedImageCount }`:

1. Partition recipe nodes: artboards vs everything else.
2. Drop artboard nodes; children of artboards keep their coordinates
   (transforms are canvas-space; verify by reading how artboard children are
   positioned — check `packages/engine/src/nodes/artboard/` and how the
   canvas renders children; if transforms turn out to be artboard-relative,
   STOP and report).
3. Create one fresh group node; reparent all top-level survivors to it
   (children keep internal structure).
4. Fresh ids for EVERY node; fix all parentId references.
5. Center the content on `targetCenter`: compute the content bounding box —
   if the recipe had exactly one artboard, use its x/y/width/height as the
   box (exact); otherwise use the min/max of node transform x/y as an
   approximation (document this limitation in a comment). Offset all
   top-level children so the box center lands on targetCenter.
6. Image nodes: keep as-is (self-contained). Skip any with empty `src`
   (count them; the caller toasts if count > 0). Return `{ nodes, skippedImageCount }`.

**Verify**: unit-testable pure function; tests in Step 3 cover it.

### Step 2: Wire the drop path

In `use-canvas-drop.ts`, the `embedded.kind === "document"` branch becomes:
convert via `recipeToComponentNodes(embedded.document, { targetCenter })`,
then `editor.insertNodes(nodes)` and toast `Added <fileName> to canvas`
(append a note when `skippedImageCount > 0`).
`svg-embedded-import.ts` result gains the parsed `document` for this.
Menu-import path (`use-document-commands.ts`) stays on `documentJson` +
`openDocumentTab`.

**Verify**: `bun run test:editor` passes; `bun run typecheck` exit 0.

### Step 3: Contract tests

`apps/web/tests/editor-contract/document/svg-recipe-drop.test.ts` (model on
`document/svg-recipe-roundtrip.test.ts`):

1. Recipe with artboard + text child → conversion yields one group node (no
   artboard), text reparented to the group, ALL ids fresh (none equal the
   recipe's), content box centered on targetCenter (artboard-exact case).
2. Recipe with two sibling artboards → both stripped, all children under one
   group.
3. Recipe with an image node carrying a data-url `src` → node inserted
   intact under the group; an image node with empty `src` → skipped and
   counted.
4. Id collision: convert the same recipe twice → zero id overlap between the
   two results.
5. End-to-end: build editor with an existing document, run the real exporter
   on a second document (pattern from svg-recipe-roundtrip.test.ts), extract,
   convert, `editor.insertNodes` → node count grows by group+children; text
   node still `type: "text"` with original string; no artboard added.

**Verify**: new tests pass; full suite passes.

### Step 4: Live verification (headless browser)

`bun run dev`, then with agent-browser (pattern: the session's prior usage —
dispatch pointer events; `window.__PUNCHPRESS_EDITOR__` is exposed in DEV):
create a doc with an artboard+text, `editor.exportDocument()` via eval to get
the SVG string, then simulate the drop path by calling the same functions the
drop handler uses (or construct a DataTransfer drop if feasible); assert via
eval: a new group node exists in the SAME document (no new tab), no new
artboard. If DataTransfer simulation is too flaky, direct function-level
verification through eval is acceptable — say which you did.

**Verify**: eval assertions pass; report them.

### Step 5 (OPTIONAL — skip cleanly if >1h): auto-frame on frameless open

In the menu-import path only: if the parsed recipe has no artboard node, add
one sized to the content bounding box (reuse Step 1's box logic) before
serializing to `openDocumentTab`. If awkward, SKIP and note it — do not
force.

## Done criteria

- [ ] Dropping a PunchPress SVG inserts a group (no artboard) at the drop point in the CURRENT tab
- [ ] Menu import still opens the full document as a new tab
- [ ] Plain SVG drop/import unchanged (geometry import)
- [ ] Corrupt recipe still errors, no fallback
- [ ] New contract tests pass; `bun run test:editor`, `bun run typecheck`, `bun run check` all green
- [ ] Step 4 live assertions reported

## STOP conditions

- Artboard children turn out to use artboard-relative coordinates.
- The id-helper investigation finds nodes get ids only via store actions (no
  reusable factory) — report rather than hand-rolling id generation.

## Maintenance notes

- If a "paste .punch content" feature ever lands, it should share
  `recipeToComponentNodes` (this is the same operation minus the SVG shell).
- Deferred by owner decision elsewhere: an export toggle for embedding the
  recipe at all (size/privacy trade-off) — not this plan.
