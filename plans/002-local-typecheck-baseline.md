# Plan 002: Establish a local typecheck gate for all three TypeScript surfaces

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fecf8e6c..HEAD -- apps/web/tsconfig.json package.json apps/web/package.json packages/engine packages/punch-schema`
> If `tsconfig.json` files appeared in `packages/*` since planning, this plan
> may be partially done — reconcile before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (additive tooling; no runtime code changes intended)
- **Depends on**: 001 (fewer deps = fewer ambient types to resolve; not strictly required)
- **Category**: dx
- **Planned at**: commit `fecf8e6c`, 2026-06-10

## Why this matters

The repo has **no typechecking at all**: `typescript` is not a devDependency,
no script runs `tsc`, the only `tsconfig.json` lives in `apps/web` with
`strict: false`, and it covers only `apps/web/src` — the ~30K-LoC engine and
the schema package are never typechecked by anything. Lint (`bun run check` →
Biome/ultracite) does not check types. Bugs that a compiler would catch ship
straight into signed, auto-updating desktop releases. The project owner has
explicitly chosen **no CI** — verification stays local, so this gate must be a
fast local command that agents and humans run per AGENTS.md.

This plan establishes the baseline (tsc passes with current laxity), not full
strictness. Ratcheting `strict: true` is a deliberate follow-up.

## Current state

- `apps/web/tsconfig.json` — the only tsconfig in the repo. Key settings:

```jsonc
// apps/web/tsconfig.json (excerpt)
"moduleResolution": "Bundler",
"noEmit": true,
"strict": false,
"target": "ES2020",
"include": ["src"]   // tests/ NOT included
```

- `packages/engine/package.json` and `packages/punch-schema/package.json` —
  `"exports": { ".": "./src/index.ts" }` (TS source consumed directly; no
  build step, no tsconfig).
- Root `package.json` — scripts include `lint`/`check` (Biome) but nothing
  type-related; `devDependencies` has only `@playwright/test`.
- Code style note: many `.tsx`/`.ts` files have untyped parameters (e.g.
  `apps/web/src/components/canvas/canvas-node.tsx` component props), which is
  why `strict: false` must be preserved for the baseline.
- `import.meta.env` (Vite) is used, e.g. `apps/web/src/workspace/workspace-provider.tsx`;
  a `vite/client` types reference is required for it to typecheck. Check
  whether `apps/web/src/vite-env.d.ts` exists; create it if not.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Env setup (FIRST — install fails without it) | Codex-managed worktrees copy `.env` through `.worktreeinclude`. | `.env` exists at repo root (gitignored; never commit it) |
| Install | `bun install` | exit 0 |
| Lint | `bun run check` | exit 0 |
| Editor tests | `bun run test:editor` | all pass |
| New typecheck (after this plan) | `bun run typecheck` | exit 0, no errors |

## Scope

**In scope**:
- `package.json` (root — add `typecheck` script)
- `apps/web/package.json` (add `typescript` devDependency, `typecheck` script)
- `apps/web/tsconfig.json` (minor additions only — e.g. `types`, `include`)
- `packages/engine/tsconfig.json` (create)
- `packages/punch-schema/tsconfig.json` (create)
- `packages/engine/package.json`, `packages/punch-schema/package.json`
  (add `typecheck` scripts)
- `apps/web/src/vite-env.d.ts` (create if missing)
- `AGENTS.md` (one line adding typecheck to the verification expectations)
- Source files ONLY for mechanical, behavior-preserving type fixes (see Step 4
  limits)

**Out of scope**:
- Turning on `strict` anywhere — follow-up, not this plan.
- `apps/desktop` typechecking — electron-vite owns that build; leave it.
- Any CI/workflow files — the owner explicitly rejected CI.
- Refactors. If a type error wants a refactor, suppress per Step 4 and note it.

## Git workflow

- Conventional Commits, e.g. `chore: add local typecheck gate` (config) and
  `fix: resolve typecheck errors` (source touch-ups), as separate commits.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Add typescript and wire scripts

- Add to `apps/web/package.json` devDependencies: `"typescript": "5.9.3"`
  (pin exact, matching repo convention of exact pins).
- Scripts:
  - `apps/web/package.json`: `"typecheck": "tsc -p tsconfig.json --noEmit"`
  - `packages/engine/package.json`: `"typecheck": "tsc -p tsconfig.json --noEmit"`
  - `packages/punch-schema/package.json`: same.
  - Root `package.json`: `"typecheck": "bun run --cwd packages/punch-schema typecheck && bun run --cwd packages/engine typecheck && bun run --cwd apps/web typecheck"`

**Verify**: `bun install` → exit 0.

### Step 2: Create package tsconfigs

Create `packages/punch-schema/tsconfig.json` and
`packages/engine/tsconfig.json` with settings mirroring the web app's laxity
(the engine code was written under no compiler — do not tighten yet):

```jsonc
{
  "compilerOptions": {
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": false,
    "target": "ES2020"
  },
  "include": ["src"]
}
```

Note: the engine touches DOM types (canvas surfaces), so keep `"DOM"` in lib
for both. If `punch-schema` typechecks without it, you may drop `"DOM"` there.

**Verify**: `bun run --cwd packages/punch-schema typecheck` → exit 0 (this
package is small and zod-typed; expect zero or near-zero errors).

### Step 3: Make apps/web typecheck

- If `apps/web/src/vite-env.d.ts` does not exist, create it:
  `/// <reference types="vite/client" />`
- Run `bun run --cwd apps/web typecheck`. Fix config-level issues (missing
  ambient types) via tsconfig `types`/`include`, not code edits, where
  possible.

**Verify**: `bun run --cwd apps/web typecheck` → exit 0.

### Step 4: Make packages/engine typecheck

Run `bun run --cwd packages/engine typecheck`. With `strict: false` the error
count should be modest. Allowed fixes, in order of preference:

1. Add missing type imports/annotations that are unambiguous from context.
2. Correct obviously-wrong types (typos in names, stale signatures).
3. As a last resort, `// @ts-expect-error TODO(typecheck-baseline): <reason>`
   on the offending line.

Rules: zero behavior changes; no renames; no signature changes that ripple to
callers; never delete code to silence an error.

**Verify**: `bun run --cwd packages/engine typecheck` → exit 0, and
`bun run test:editor` → all pass (proves no behavior drift).

### Step 5: Document the gate

Add to `AGENTS.md` under Testing (match the existing terse bullet style):
`- Run \`bun run typecheck\` along with \`bun run check\` before declaring work done.`

**Verify**: `bun run typecheck` (root) → exit 0.

## Test plan

No new tests. Gates: `bun run typecheck` exits 0 from a clean checkout after
`bun install --frozen-lockfile`; `bun run test:editor` still passes; `bun run
check` still passes (Biome must not object to the new files).

## Done criteria

- [ ] `bun run typecheck` exits 0 at repo root
- [ ] `typescript` pinned in `apps/web/package.json` devDependencies
- [ ] `packages/engine/tsconfig.json` and `packages/punch-schema/tsconfig.json` exist
- [ ] `bun run test:editor` exits 0
- [ ] `bun run check` exits 0
- [ ] Count of `@ts-expect-error TODO(typecheck-baseline)` insertions reported in the completion summary
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `packages/engine` typecheck reports **more than ~60 errors** after config
  fixes — the suppression pass would be noise; report the error inventory
  grouped by file instead so the baseline strategy can be reconsidered.
- Any fix requires changing a function's runtime behavior or public signature.
- `bun run test:editor` fails after your changes.
- Biome/ultracite forbids `@ts-expect-error` (lint failure) — report; we may
  need a lint-level allowance instead of ad-hoc suppression.

## Maintenance notes

- Follow-up (deliberately deferred): ratchet `strict: true` per package,
  starting with `punch-schema` (smallest); burn down the
  `TODO(typecheck-baseline)` markers.
- Anyone adding a workspace package must add a tsconfig + typecheck script and
  chain it into the root script.
- Reviewer: scrutinize Step 4 source diffs — they must be type-only.
