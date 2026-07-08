# Plan 003: Add tests for .punch document migration and normalization

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fecf8e6c..HEAD -- packages/punch-schema/src apps/web/tests/editor-contract/document`
> If `migrate.ts`, `normalize.ts`, or `raster-assets.ts` changed since
> planning, compare the excerpts below against live code before writing tests.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (test-only change)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `fecf8e6c`, 2026-06-10

## Why this matters

`migrateDocument` is the gate every saved `.punch` document passes through on
load, and the place future version migrations will live. Today it is invoked
indirectly by 4 small tests in `load.test.ts`, but its normalization behavior
(legacy path-node shape upgrade, image asset materialization, opacity
clamping) has **zero direct coverage**. PunchPress ships auto-updating desktop
releases; a regression here silently corrupts or rejects users' saved
documents on upgrade. These are cheap, durable contract tests.

## Current state

- `packages/punch-schema/src/migrate.ts` (47 lines, whole file relevant) —
  validates `version`, then normalizes nodes + assets:

```ts
// migrate.ts:34-46
if (value.version === PUNCH_DOCUMENT_VERSION) {
  return normalizeDocumentRecord(value);
}
if (typeof value.version !== "string" || value.version.length === 0) {
  throw new UnsupportedDocumentVersionError("Document is missing a supported version.");
}
throw new UnsupportedDocumentVersionError(`Unsupported document version: ${value.version}`);
```

```ts
// migrate.ts:17-32 — normalizeDocumentRecord
if (!Array.isArray(document.nodes)) { return document; }
const nodes = normalizeNodesForSchema(document.nodes);
return {
  ...document,
  assets: createDocumentAssetsFromNodes(nodes, isRecord(document.assets) ? document.assets : {}),
  nodes,
};
```

- `packages/punch-schema/src/normalize.ts` — `normalizeNodeForSchema`:
  clamps `opacity` to [0,1] (defaults to 1 when missing/non-finite); for
  `image` nodes synthesizes `assetId` via `createRasterAssetId(nodeId)` when
  absent; for `path` nodes upgrades the **legacy `{segments, closed}` shape**
  to `contours: [{closed, segments}]` and strips the legacy keys.
- `packages/punch-schema/src/raster-assets.ts` —
  `createDocumentAssetsFromNodes(nodes, existingAssets)` builds the document
  asset map from image nodes (read it before writing assertions).
- `packages/punch-schema/src/load.ts:26-38` — `parseDesignDocument` =
  JSON.parse → `migrateDocument` → `designDocumentSchema.safeParse`; throws
  `DocumentParseError` / `UnsupportedDocumentVersionError` /
  `DocumentValidationError`.
- Existing tests: `apps/web/tests/editor-contract/document/load.test.ts` —
  uses bun:test `describe/test/expect`, builds a `VALID_DOCUMENT` literal with
  a text node, imports everything from `@punchpress/punch-schema`. **Model the
  new file on it** (same import style, same literal-document approach).

Repo testing conventions (AGENTS.md): name test files after the concrete
behavior; durable editor/schema behavior belongs in `editor-contract` tests;
minimize mocks.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Env setup (FIRST — install fails without it) | Codex-managed worktrees copy `.env` through `.worktreeinclude`. | `.env` exists at repo root (gitignored; never commit it) |
| Install | `bun install --frozen-lockfile` | exit 0 |
| Run new tests | `bun test apps/web/tests/editor-contract/document/document-migration.test.ts` | all pass |
| Full editor suite | `bun run test:editor` | all pass |
| Lint | `bun run check` | exit 0 |

## Scope

**In scope**:
- `apps/web/tests/editor-contract/document/document-migration.test.ts` (create)

**Out of scope**:
- Any file under `packages/punch-schema/src` — if a test exposes a real bug,
  STOP and report it; do not fix production code in this plan.
- `load.test.ts` — leave the existing tests where they are.
- Anything raster-runtime related in `packages/engine` (a raster refactor is
  in flight in another worktree); the image-node *schema* normalization
  tested here is fine.

## Git workflow

- One commit: `test: cover punch document migration and normalization`
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Read the two helpers you'll assert against

Read `packages/punch-schema/src/normalize.ts` and
`packages/punch-schema/src/raster-assets.ts` fully, plus `constants.ts` for
`PUNCH_DOCUMENT_VERSION`. Confirm the behaviors listed in "Current state".

**Verify**: behaviors match; if not, STOP (drift).

### Step 2: Write document-migration.test.ts

Create `apps/web/tests/editor-contract/document/document-migration.test.ts`,
importing `migrateDocument`, `parseDesignDocument`,
`UnsupportedDocumentVersionError`, `PUNCH_DOCUMENT_VERSION` from
`@punchpress/punch-schema`. Cases (use `describe("migrateDocument")` and
`describe("document normalization")`):

1. **Rejects non-object input**: `migrateDocument("hi")`, `migrateDocument([])`,
   `migrateDocument(null)` each throw `UnsupportedDocumentVersionError`.
2. **Rejects missing/empty/non-string version**: `{}`, `{version: ""}`,
   `{version: 42}` throw with "missing a supported version" message.
3. **Rejects other versions with the version in the message**:
   `{version: "0.0.1"}` throws; `expect(...).toThrow(/0\.0\.1/)`.
4. **Passes through current version without nodes array**: a record
   `{version: PUNCH_DOCUMENT_VERSION, nodes: undefined}` is returned as-is
   (migrate only; don't run schema parse on this one).
5. **Legacy path shape upgrade**: a path node carrying top-level
   `segments: [...]` + `closed: false` (no `contours`) comes back with
   `contours: [{closed: false, segments: [...]}]` and **no** `segments`/`closed`
   keys at the top level. Build the segments to match what the schema expects —
   copy a valid path node literal from any existing editor-contract test that
   constructs path nodes (e.g. search `tests/editor-contract` for
   `type: "path"`), then run the full `parseDesignDocument` round to prove the
   upgraded document validates.
6. **Opacity clamping**: nodes with `opacity: 7` → 1, `opacity: -2` → 0,
   `opacity` missing → 1 (assert via `migrateDocument` output).
7. **Image assetId synthesis**: an image node without `assetId` gets
   `asset_<sanitized-node-id>`; node ids with characters outside
   `[a-zA-Z0-9_-]` are sanitized to `_`.
8. **Asset map construction**: full `parseDesignDocument` on a document with
   one image node (reuse the data-url pixel from
   `document/load.test.ts:87-114`) produces `assets.<assetId>` with the shape
   asserted there (`kind: "raster"`, `storage: "single"`, ref under
   `assets/raster/`); pre-existing entries in `document.assets` for live nodes
   are preserved per `createDocumentAssetsFromNodes` (assert per what you read
   in Step 1).

**Verify**: `bun test apps/web/tests/editor-contract/document/document-migration.test.ts`
→ all pass (expect ~10+ assertions across ≥8 tests).

### Step 3: Full suite + lint

**Verify**: `bun run test:editor` → all pass; `bun run check` → exit 0.

## Test plan

This plan IS the test plan — see Step 2 case list. Structural pattern:
`apps/web/tests/editor-contract/document/load.test.ts`.

## Done criteria

- [ ] `document-migration.test.ts` exists with the 8 case groups above, all passing
- [ ] `bun run test:editor` exits 0
- [ ] `bun run check` exits 0
- [ ] `git status` shows only the new test file
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A test reveals behavior that contradicts "Current state" (e.g. opacity not
  clamped, legacy keys not stripped) — that's either drift or a real bug;
  report it with the failing assertion rather than adjusting the test to pass.
- A valid-looking path/image node literal will not pass
  `designDocumentSchema` — the schema may have required fields not visible in
  this plan; copy a literal from an existing passing test, and if none exists,
  report.

## Maintenance notes

- When `PUNCH_DOCUMENT_VERSION` is bumped and a real version migration is
  added to `migrate.ts`, extend this file with old→new fixture documents —
  keep one fixture per historical version.
- Reviewer: check assertions encode behavior from `normalize.ts` itself, not
  from this plan's paraphrase.
