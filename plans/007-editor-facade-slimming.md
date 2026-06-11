# Plan 007: Slim editor.ts toward its documented facade role (2,172 → ~1,200 LoC)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fecf8e6c..HEAD -- packages/engine/src/editor.ts`
> This is the highest-churn file in the repo (30 commits / 3 months). On any
> drift, re-survey before extracting; on heavy drift (>200 changed lines),
> STOP and ask whether this plan should be re-planned.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED (engine core; mitigated by extract-delegate pattern + contract tests)
- **Depends on**: 002 (typecheck), and run AFTER 006 to avoid concurrent churn pain
- **Category**: tech-debt
- **Planned at**: commit `fecf8e6c`, 2026-06-10

## Why this matters

`packages/engine/src/editor.ts` is 2,172 LoC. The file itself states the
intent at line 268:

```ts
// Intentional facade: keep the public editor API and durable subsystem wiring
// here, and move behavior-heavy implementation into capability modules.
```

The facade pattern is right and documented (`docs/internals/editor-facade.md`)
— but the file still **hand-implements** behavior that belongs in capability
modules (e.g. `loadLocalFontCatalog` at lines 2138-2154 contains promise
caching + catalog application logic inline; path-editing preview state logic
around lines 1323-1334 and 1555-1557 implements selection/pointType reads
inline). Every such body makes the public API harder to scan and the
highest-churn file in the repo bigger. Target: every method in `editor.ts` is
≤ ~5 lines of delegation/wiring; behavior lives in `packages/engine/src/<capability>/`.

This is incremental: extract the worst offenders, not a big-bang rewrite.

## Current state

- `packages/engine/src/editor.ts` — 2,172 LoC, ~300 methods, the only class.
  Existing capability modules already follow the target pattern — the engine
  has `document/`, `selection/`, `transform/`, `viewport/`, `clipboard/`,
  `fonts/`, `editing/`, `inspection/`, `queries/`, `managers/`, `history/`,
  `input/`, `lifecycle/`, `placement/`, `interaction/` folders whose functions
  typically take `editor` (or store/state) as the first argument — e.g.
  `packages/engine/src/selection/selection-actions.ts`,
  `packages/engine/src/fonts/font-catalog-actions.ts`. **Match that exemplar
  pattern**: free function in the capability folder, editor method one-line
  delegates.
- Read `docs/internals/editor-facade.md` before starting — it defines what is
  allowed to stay in the facade (public API + durable subsystem wiring).
- AGENTS.md rules that bind here: "Prefer plain modules for editor behavior";
  manager objects only for stateful subsystems; operation-first method names;
  files <300 LoC for new modules.
- Test coverage: `apps/web/tests/editor-contract/**` exercises the editor
  surface heavily (editor.test.ts plus ~40 behavior files) — this is the
  safety net that makes extraction safe.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Env setup (FIRST — install fails without it) | `cp ~/Programming/punchpress/.env .` | `.env` exists at repo root (gitignored; never commit it) |
| Install | `bun install --frozen-lockfile` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Editor tests | `bun run test:editor` | all pass |
| Lint | `bun run check` | exit 0 |
| LoC progress | `wc -l packages/engine/src/editor.ts` | decreasing per step |

## Scope

**In scope**:
- `packages/engine/src/editor.ts` (shrinks)
- New/extended modules under existing capability folders:
  `packages/engine/src/fonts/`, `packages/engine/src/editing/`,
  `packages/engine/src/queries/`, `packages/engine/src/interaction/`,
  `packages/engine/src/viewport/` (extend existing files where cohesive,
  create kebab-case siblings where not)
- `packages/engine/src/index.ts` only if a moved symbol was package-public

**Out of scope**:
- The PUBLIC API: no editor method may be renamed, removed, or change
  signature/behavior. React bindings, tests, and desktop menus call these.
- `packages/engine/src/tools/brush-*.ts`, `raster-tile-surface.ts`, and any
  raster working-surface code — raster refactor in flight in another worktree.
  If a facade method's body is raster-related, SKIP it (leave inline) and note it.
- Store internals (`state/store/**`) — extraction targets method bodies, not
  store actions.
- `docs/internals/editor-facade.md` — update only the file-pointer list if it
  names moved internals (check at the end).

## Git workflow

- One commit per extraction batch (Steps 2-4), Conventional Commits:
  `refactor: extract <capability> behavior from editor facade`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Survey and rank

Build the extraction list mechanically: in `editor.ts`, find methods whose
bodies exceed ~10 lines (awk/grep over the file or read it in chunks). For
each, record: method name, line range, target capability folder, and whether
it touches raster (→ skip-list). Produce a table of the ~15-25 largest.
Known candidates from planning-time reading: `loadLocalFontCatalog` (~2138),
the path-editing preview cluster (~1323-1360), path point-type queries
(~1555+). Exclude constructor + store wiring.

**Verify**: table produced; share it in your progress notes before extracting.

### Step 2: Extract fonts + lifecycle cluster

Move font-catalog behavior into `packages/engine/src/fonts/font-catalog-actions.ts`
(file exists — extend it). Pattern:

```ts
// fonts/font-catalog-actions.ts
export const loadLocalFontCatalog = (editor, loadCatalog, { force = false } = {}) => { /* moved body */ };

// editor.ts
loadLocalFontCatalog(loadCatalog, options) {
  return loadLocalFontCatalog(this, loadCatalog, options);
}
```

Private fields the body needs (e.g. `localFontCatalogPromise`): if the field
is only used by the moved cluster, move ownership to the module via a
WeakMap-free approach — keep the field on the editor but document it as
owned by the capability module; do NOT invent new manager classes (AGENTS.md:
manager is a high bar).

**Verify**: `bun run typecheck` exit 0; `bun run test:editor` all pass;
`wc -l packages/engine/src/editor.ts` decreased.

### Step 3: Extract path-editing preview + query clusters

Same pattern into `packages/engine/src/editing/` and
`packages/engine/src/queries/` (or `inspection/` where the existing split
puts read-only surfaces — follow where similar functions already live; e.g.
path inspection lives in `inspection/path/path-edit-inspector.ts`).

**Verify**: same gates as Step 2.

### Step 4: Continue down the ranked list

Work the Step 1 table top-down. After each batch: typecheck + test + lint.
Stop extracting when remaining method bodies are ≤ ~10 lines or raster-tagged,
or when `editor.ts` ≤ ~1,200 LoC — whichever comes first. Do not chase a
number at the cost of incoherent module placement.

**Verify**: per batch, all three gates green.

### Step 5: Doc + final sweep

- Re-read `docs/internals/editor-facade.md`; update file pointers if any
  moved (keep the doc terse, per docs-policy).
- `bun run check` for unused-export complaints; trim.

**Verify**: `bun run typecheck`, `bun run test:editor`, `bun run check` all
exit 0; `bun run test:e2e` → no new failures vs a pre-plan baseline run.

## Test plan

No new tests required — the editor-contract suite is the regression net, and
extraction must not change behavior. IF Step 1 reveals a large method with no
covering test (search `apps/web/tests/editor-contract` for the method name),
write a small characterization test for it BEFORE moving it, in the existing
behavior-named test file that fits (AGENTS.md naming rules).

## Done criteria

- [ ] `wc -l packages/engine/src/editor.ts` ≤ ~1,200 (report exact number)
- [ ] No public editor method renamed/removed (verify: `bun run test:editor` passes unmodified)
- [ ] No new manager classes introduced
- [ ] No raster-related code touched (`git diff --stat` contains no `brush`/`raster` paths)
- [ ] `bun run typecheck`, `bun run test:editor`, `bun run check` exit 0; e2e has no new failures
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A method body can't move without changing observable behavior (hidden
  ordering/`this`-aliasing effects).
- An extraction requires touching `state/store/**` action signatures.
- Heavy drift in editor.ts since `fecf8e6c` (per the drift check).
- The same private field is shared across 3+ capability clusters — that's a
  real design decision, not mechanical extraction; report it.

## Maintenance notes

- The facade comment at editor.ts:268 is the standing rule: new editor
  methods should be born as delegates to capability modules. Reviewers should
  push back on any new >10-line method body in editor.ts.
- Deferred deliberately: splitting the Editor class itself, store decomposition,
  and anything raster (post-redesign).
