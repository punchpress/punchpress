# Plan 006: Split canvas-node.tsx (1,308 LoC) into a canvas-node feature folder

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fecf8e6c..HEAD -- apps/web/src/components/canvas/canvas-node.tsx`
> This is a top-churn file. On ANY drift, re-derive the symbol inventory
> below with `grep -n "^const \|^export" apps/web/src/components/canvas/canvas-node.tsx`
> before proceeding; on structural mismatch (symbols gone/renamed), STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (hot rendering path; move-only refactor mitigates)
- **Depends on**: 002 (typecheck catches broken imports during the move)
- **Category**: tech-debt
- **Planned at**: commit `fecf8e6c`, 2026-06-10

## Why this matters

`apps/web/src/components/canvas/canvas-node.tsx` is 1,308 LoC against the
repo's own ~300 LoC convention (AGENTS.md: "when a file grows past ~180-220
LoC … turn it into a feature folder and split the behavior into sibling
modules"). It mixes four separable concerns: art-state selection/memoization,
SVG render-tree construction, pointer-interaction policy, and the React
component shells. It's also one of the highest-churn files in the repo (27
commits in 3 months), so navigation cost is paid constantly. This is a
**move-only** refactor: no behavior, signature, or memoization changes.

## Current state

Symbol inventory at `fecf8e6c` (line: symbol), grouped by target module:

- **Art state & geometry selectors** (→ `node-art-state.ts`):
  67 `mergeNodeUpdate`, 78 `getResizePreviewNode`, 91 `selectNodeArtState`,
  396 `selectNodeReadyState`, 400 `selectNodeArtInputs`,
  409 `getMemoizedNodeArtState`.
- **Paint/paths helpers + render tree** (→ `node-render-tree.tsx`):
  143 `getCanvasNodePathFill`, 151 `getCanvasNodePathStroke`,
  155 `getPaintVariableName`, 173 `getCanvasPaintValue`,
  179 `getPaintPreviewStyle`, 185 `getNodeOpacity`,
  189 `getSvgNodeAncestorOpacityChain`, 206 `getNodeRenderPaths`,
  224 `getSvgNodeTransformBounds`, 228 `getSvgNodeTransform`,
  244 `getSvgNodeTransformChain`, 264 `getGroupNodePaths`,
  297 `getGroupNodeRenderTree`, 369 `getGroupNodeArtState`,
  1077 `CanvasNodePath`, 1114 `CanvasNodeRenderTree`.
- **Pointer interaction policy** (→ `node-interactions.ts`):
  39 `getCanvasPoint`, 55 `recordPointerHandlerSpan`, 419 `shouldStartNodeDrag`,
  445 `shouldDirectEnterPathEditing`, 462 `getCanvasInteractionNodeId`,
  489 `getCanvasHoverNodeId`, 514 `clearSelectionFromUnpaintedNodeHit`,
  526 `startCanvasNodeDragSession`, 628 `shouldIgnoreCanvasNodePointerDown`,
  636 `shouldDeferNodeToolIdleSelection`, 640 `handleNodeToolIdlePointerDown`.
- **Components** (→ stays in `canvas-node.tsx`, the folder's entry file):
  705 `CanvasNodeShell`, 984 `CanvasStandardNodeArt`, 1025 `CanvasVectorNodeArt`,
  1065 `CanvasNodeArtContent`, 1184 `CanvasNodeComponent`,
  1203 `export const CanvasNode = memo(CanvasNodeComponent)`, 1205 `CanvasNodeArt`.

Conventions that bind this refactor (AGENTS.md):
- Components live flat under `canvas/` with **max 1 level of nesting** — a
  `canvas/canvas-node/` folder is exactly 1 level: allowed.
- Kebab-case filenames; extensionless relative imports; primary export first;
  export only what's imported elsewhere; **no barrel/index re-export files**.
- `.ts` for React-free modules, `.tsx` only where JSX lives.

Current external consumers: `grep -rn "from \"./canvas-node\"\|from \"@/components/canvas/canvas-node\"" apps/web/src`
— run this; at planning time the public surface is `CanvasNode` (memoized).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Env setup (FIRST — install fails without it) | `cp ~/Programming/punchpress/.env .` | `.env` exists at repo root (gitignored; never commit it) |
| Install | `bun install --frozen-lockfile` | exit 0 |
| Typecheck | `bun run typecheck` (exists if plan 002 landed; else skip) | exit 0 |
| Editor tests | `bun run test:editor` | all pass |
| E2E (rendering/interaction wiring) | `bun run test:e2e` | all pass (run `bunx playwright install chromium` first if browsers missing) |
| Lint | `bun run check` | exit 0 |
| Perf sanity | `bun run perf:json text-nodes-dragging-500` | completes; metrics within normal variance of a pre-refactor baseline run |

## Scope

**In scope**:
- Create `apps/web/src/components/canvas/canvas-node/` containing:
  `canvas-node.tsx` (components + public `CanvasNode`), `node-art-state.ts`,
  `node-render-tree.tsx`, `node-interactions.ts`
- Delete the original `apps/web/src/components/canvas/canvas-node.tsx`
- Update import paths in consumers (Step 4)

**Out of scope**:
- ANY logic change: memoization boundaries (`memo`, `getMemoizedNodeArtState`),
  selector contents, pointer handler behavior, perf-span labels — all byte-identical.
- `canvas.tsx`, `canvas-overlay/**`, engine code.
- Raster/image-node behavior (raster refactor in flight in another worktree) —
  these symbols move with their module but must not be edited.

## Git workflow

- Single commit: `refactor: split canvas-node into feature folder modules`
- Do NOT push unless the operator instructed it.

## Steps

### Step 0: Baseline

Run `bun run test:editor`, `bun run test:e2e`, and
`bun run perf:json text-nodes-dragging-500` on the unmodified tree; save the
perf result JSON (from `.context/performance/`) aside for Step 5 comparison.

**Verify**: both suites green before you start. If e2e is red on the base
commit, note which specs and treat only NEW failures as yours.

### Step 1: Create the folder and move pure modules first

Create `canvas/canvas-node/` and move the **interaction** group into
`node-interactions.ts` and the **art-state** group into `node-art-state.ts`
(both `.ts` — confirm no JSX in those functions; if any has JSX, it belongs in
the render-tree file instead). Cut-paste bodies unchanged; add imports the
moved code needs; export each symbol the remaining files consume.

**Verify**: `bun run typecheck` (or `bunx tsc -p apps/web/tsconfig.json --noEmit`
if 002 hasn't landed and you can install typescript transiently — otherwise
rely on `bun run test:editor` + vite build) → exit 0.

### Step 2: Move render-tree group

Move the paint/path helpers + `CanvasNodePath` + `CanvasNodeRenderTree` into
`node-render-tree.tsx`. Same rules.

**Verify**: same as Step 1.

### Step 3: Move components into the folder entry

Move the remaining components into
`canvas/canvas-node/canvas-node.tsx`; it keeps the single public export
`CanvasNode`. Delete the original file.

**Verify**: `grep -rn "components/canvas/canvas-node\"" apps/web/src` plus
relative `"./canvas-node"` imports — confirm consumers now resolve to the new
folder path; update each consumer's import specifier.

### Step 4: Full verification

**Verify**: `bun run check` → exit 0 (Biome will also catch unused exports —
trim any symbol you exported that nothing imports); `bun run test:editor` →
all pass; `bun run test:e2e` → no new failures vs Step 0.

### Step 5: Perf sanity

Re-run `bun run perf:json text-nodes-dragging-500`; compare against the
Step 0 artifact.

**Verify**: headline frame metrics within normal run-to-run variance (compare
against Step 0; if the regression is consistent across 2 re-runs, STOP — a
move-only refactor must not change hot-path numbers; the likely cause is an
accidentally changed memo/import pattern).

## Test plan

No new tests — move-only. The gates are the existing editor-contract suite,
the e2e suite (covers canvas interaction wiring), and the perf benchmark
comparison.

## Done criteria

- [ ] `apps/web/src/components/canvas/canvas-node/` exists with the 4 files; old single file deleted
- [ ] `wc -l` of every new file ≤ ~450 (the components file may exceed 300 slightly; do not force further splits in this plan)
- [ ] Diff is move-only: no function body changed (reviewer check: `git diff --color-moved=dimmed-zebra` shows bodies as moved blocks)
- [ ] `bun run check`, `bun run test:editor`, `bun run test:e2e` all green (no new e2e failures)
- [ ] Perf benchmark within variance of baseline
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The symbol inventory doesn't match the live file (drift — this file churns).
- Moving a function requires changing its signature or splitting shared
  module-level state (e.g. a shared mutable map) across files.
- A consistent perf regression appears in Step 5.
- You find yourself "improving" code while moving it.

## Maintenance notes

- Future node-type renderers should land as siblings in this folder, not as
  growth in `canvas-node.tsx`.
- Reviewer: use `--color-moved` to confirm move-only; scrutinize only the
  import sections.
- Deferred: any deeper memoization or render-path optimization (see plan 008
  for the panel-side analog; the canvas-side equivalent should be its own
  measured plan).
