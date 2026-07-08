# Plan 008: Measure, then fix, layers-panel selector cost during canvas interactions

> **Executor instructions**: Follow this plan step by step. This is a
> **measure-first** plan: Step 3's fix only happens if Step 2's numbers
> justify it. Run every verification command and confirm the expected result
> before moving to the next step. If anything in the "STOP conditions"
> section occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fecf8e6c..HEAD -- apps/web/src/components/panels/layers-panel apps/web/src/editor-react/use-editor-value.ts`
> On drift, compare the excerpts below against live code before proceeding.

## Status

- **Priority**: P3
- **Effort**: S (investigate) + M (fix, conditional)
- **Risk**: LOW (measurement first; fix is subscription-granularity only)
- **Depends on**: none (independent; fine to run before/after 006)
- **Category**: perf
- **Planned at**: commit `fecf8e6c`, 2026-06-10

## Why this matters

The layers panel recomputes its full visible-row list inside a Zustand
selector that runs on **every editor store change** — including every
pointermove tick during drags. Worse, the selector returns a fresh array of
fresh row objects each time, and `useEditorValue` compares results with
zustand `shallow`: one-level comparison of array items via `Object.is`. Fresh
objects are never `Object.is`-equal, so the panel likely **re-renders on every
store change**, not just when rows actually change. On large documents this
taxes the interaction hot path the repo's own decision doc
(`docs/decisions/interaction-render-hot-path.md`) says must stay minimal.
The repo has first-class perf infra — use it to confirm before fixing.

## Current state

- `apps/web/src/editor-react/use-editor-value.ts` (whole file, 20 lines):

```ts
export const useEditorValue = (selector, perfLabel = null) => {
  const editor = useEditor();
  return useStore(
    editor.store,
    (state) => {
      if (!perfLabel) { return selector(editor, state); }
      return measurePerf(perfLabel, () => selector(editor, state));
    },
    shallow
  );
};
```

- `apps/web/src/components/panels/layers-panel/layers-panel.tsx:257-263`:

```ts
const visibleLayerRowKeys = useEditorValue((editor) => {
  return getVisibleLayerRowKeys(editor, collapsedGroupIds, expandedDenseGroupIds);
}, PERF_SPANS.layersSelectorVisibleNodeIds);
```

- `layers-panel.tsx:80-115` — `getVisibleLayerRowKeys` recursively walks the
  node tree from `ROOT_PARENT_ID` via `editor.getChildNodeIds`, allocating
  `{depth, kind, nodeId}` (and contour-row) objects per visible row. Note the
  dense-container guard: containers with >300 children render collapsed
  unless expanded — so row count is bounded, but the **tree walk itself**
  runs per store change regardless.
- The selector closes over local React state (`collapsedGroupIds`,
  `expandedDenseGroupIds`) — any fix must keep those reactive.
- Perf instrumentation already present: `usePerformanceRenderCounter(
  PERF_COUNTERS.renderPanelLayers)` at line 238 and the
  `PERF_SPANS.layersSelectorVisibleNodeIds` label. Benchmark runner:
  `bun run perf --list --json` lists scenarios; `bun run perf:json <id>`
  writes artifacts to `.context/performance/`. See
  `docs/reference/performance-tests.md` and `docs/internals/performance.md`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Env setup (FIRST — install fails without it) | Codex-managed worktrees copy `.env` through `.worktreeinclude`. | `.env` exists at repo root (gitignored; never commit it) |
| Install | `bun install --frozen-lockfile` | exit 0 |
| List benchmarks | `bun run perf --list --json` | JSON list of scenario ids |
| Run a benchmark | `bun run perf:json <benchmark-id>` | result JSON in `.context/performance/` |
| Editor tests | `bun run test:editor` | all pass |
| Lint | `bun run check` | exit 0 |

## Scope

**In scope**:
- Measurement artifacts (reported, not committed)
- IF fix proceeds: `apps/web/src/components/panels/layers-panel/layers-panel.tsx`
  (and a sibling module in that folder if extraction is cleaner)

**Out of scope**:
- `use-editor-value.ts` — changing the shared subscription primitive affects
  every component; do not touch it in this plan.
- The engine store, `editor.getChildNodeIds`, node-tree manager.
- Virtualization/overscan logic elsewhere in layers-panel.tsx.
- Any other panel with a similar pattern (note them in the report instead).

## Git workflow

- Conventional Commits: `perf: compute layers panel rows outside the store selector`
  (only if the fix lands). Measurement-only outcome = no commit, just a report.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Pick benchmarks

`bun run perf --list --json`; choose 2 scenarios that drag many nodes (at
planning time `text-nodes-dragging-500` exists; pick the closest large-document
drag scenarios available).

**Verify**: chosen ids run successfully once.

### Step 2: Measure the baseline

For each chosen benchmark, run `bun run perf:json <id>` 3 times. From the
result artifacts, extract: (a) the `layersSelectorVisibleNodeIds` span totals
(count + total ms), and (b) the `renderPanelLayers` render-counter value.
Decision rule — proceed to Step 3 only if, in the median run of either
benchmark, the selector span totals **≥ 3ms across the benchmark** or the
panel renders **≥ 0.5× the store-update count during the drag phase**
(i.e. it re-renders on most updates). Otherwise record "measured, not worth
fixing" with the numbers in `plans/README.md` and stop here — that is a
successful outcome of this plan.

**Verify**: numbers reported for both benchmarks, decision stated.

### Step 3 (conditional): Decouple row computation from the store selector

Replace the selector-side computation with a two-stage subscription:

1. Subscribe narrowly to what the row list actually depends on:
   `const layerNodeIds = useEditorValue((editor) => editor.layerNodeIds, ...)`
   already exists at line 250 — reuse it. If tree *structure* (parent/child)
   can change without `layerNodeIds` changing identity, find the cheapest
   store signal that does change (inspect how `editor.layerNodeIds` is
   derived in the engine store; if it's recomputed on any node-tree mutation,
   it is sufficient). If no cheap signal exists, STOP and report.
2. Compute rows in `useMemo` keyed on
   `[layerNodeIds, collapsedGroupIds, expandedDenseGroupIds]`, calling the
   existing `getVisibleLayerRowKeys(editor, ...)` unchanged.

Keep the `PERF_SPANS.layersSelectorVisibleNodeIds` measurement around the
memoized computation (wrap with `measurePerf` directly) so before/after spans
stay comparable.

**Verify**: `bun run test:editor` all pass; `bun run check` exit 0; manual
check in `bun run dev` — collapse/expand groups, reorder layers, enter a
dense group (>300 children if you can create one quickly; otherwise rely on
tests): rows update correctly.

### Step 4 (conditional): Re-measure

Repeat Step 2's runs.

**Verify**: selector/memo span total reduced and panel render count during
drags materially lower (report before/after table); benchmark headline frame
metrics not regressed.

## Test plan

No new tests for the measurement path. If Step 3 lands, existing
editor-contract + e2e suites cover layer listing behavior; add a unit test
ONLY if you find `getVisibleLayerRowKeys` untested logic worth pinning
(contour rows, dense-container threshold) — put it in
`apps/web/tests/editor-contract/layer-actions.test.ts`'s style as a new
behavior-named file if so.

## Done criteria

- [ ] Before numbers reported (selector span ms + render counts, 2 benchmarks × 3 runs)
- [ ] Decision recorded against the Step 2 rule
- [ ] If fixed: after numbers show reduction; `bun run test:editor` + `bun run check` green
- [ ] `plans/README.md` status row updated (DONE with "fixed" or "measured — not worth fixing: <numbers>")

## STOP conditions

Stop and report back (do not improvise) if:

- No drag-style benchmark exists in the registry (report what's available).
- Step 3 finds no store signal that changes when tree structure changes
  (rows would go stale) — report what `layerNodeIds` actually tracks.
- The fix changes row output for any tested interaction (collapse, dense
  groups, contour rows).

## Maintenance notes

- The same selector-returns-fresh-objects-vs-`shallow` hazard exists wherever
  `useEditorValue` selectors build arrays/objects; the auditor saw similar
  shapes in canvas overlay components. If Step 2's numbers are big, a
  follow-up sweep for that pattern is warranted — list candidates in your
  report rather than fixing them here.
