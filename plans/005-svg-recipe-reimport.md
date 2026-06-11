# Plan 005: Close the SVG recipe round-trip — re-import embedded .punch documents

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fecf8e6c..HEAD -- packages/engine/src/document/export.ts packages/punch-schema/src apps/web/src/platform/svg-import-document.ts apps/web/src/components/canvas/canvas-file-drop-importers.ts apps/web/src/components/panels/document-commands/use-document-commands.ts`
> On drift in any of these, compare excerpts before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches import UX; one product decision encoded below)
- **Depends on**: 003 (migration/load tests guard the parse path this feature leans on)
- **Category**: direction / correctness
- **Planned at**: commit `fecf8e6c`, 2026-06-10

## Why this matters

Every exported SVG already embeds the full design document:
`packages/engine/src/document/export.ts` writes the serialized document into
`<metadata><punchpress-document version="...">…</punchpress-document></metadata>`.
But **no code anywhere reads it back** — importing one of these SVGs runs the
generic paper.js geometry conversion, producing dead paths. The README
explicitly promises: "The exported SVG can optionally embed the original
design recipe in metadata, so re-importing into Punchpress restores full
editability." This plan makes that true. It's the last missing piece of the
product's core "the design is never baked" thesis.

**Encoded product decision** (confirm with the operator only if a STOP
condition forces a choice): when an imported SVG contains a valid recipe, the
embedded document opens as a **new workspace tab** — identical UX to opening a
`.punch` file. It does NOT merge nodes into the current document (id
collisions, asset merging, and placement make that a much bigger feature).
When the recipe is absent or invalid, fall back silently to today's geometry
import.

## Current state

- `packages/engine/src/document/export.ts:10-15` — escaping applied to the
  embedded JSON (the importer must invert this, innermost-first):

```ts
const escapeMetadata = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
};
```

- `export.ts:113-123` — `withDocumentMetadata` joins:
  `<metadata><punchpress-document version="${document.version}">` +
  `escapeMetadata(JSON.stringify(document))` + closing tags, inserted before
  `</svg>`. Note: attribute `version` duplicates `document.version`; the JSON
  is the source of truth.
- `packages/punch-schema/src/load.ts:26-38` — `parseDesignDocument(contents)`
  = JSON.parse → `migrateDocument` → zod validate; throws `DocumentParseError`
  / `UnsupportedDocumentVersionError` / `DocumentValidationError`.
- `apps/web/src/platform/svg-import-document.ts` — `importSvgToNodes(source,
  {targetCenter})`: paper.js-based geometry import; returns nodes. Untouched
  by this plan except possibly exporting a small helper.
- Two import entry points, both calling `importSvgToNodes`:
  - `apps/web/src/components/canvas/canvas-file-drop-importers.ts:23-31` —
    drag-drop importer table; SVG entry calls `importSvgToNodes(await
    file.text(), {targetCenter})`.
  - `apps/web/src/components/panels/document-commands/use-document-commands.ts:213-227`
    — `handleImportSvg` command: `openSvgImportFile()` → `importSvgToNodes`.
- `.punch` open flow: owned by the workspace layer
  (`apps/web/src/workspace/workspace-provider.tsx`) and platform file
  adapters. **Read `docs/internals/document-files.md` and
  `docs/internals/platform-boundaries.md` before Step 3** — they document
  which function opens parsed contents as a tab; this plan intentionally does
  not pin that symbol name to avoid drift, you must locate it (grep the
  workspace folder for where `.punch` open results create tabs).
- Naming signal: `punch-schema` already exports `PUNCH_SVG_EXTENSION` /
  `PUNCH_SVG_MIME_TYPE` — exported SVGs are a first-class format.

Conventions: kebab-case files, `const` arrow functions, primary export first,
no barrels except package roots, files <300 LoC (AGENTS.md).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Env setup (FIRST — install/app-run fail without it) | `cp ~/Programming/punchpress/.env .` | `.env` exists at repo root (gitignored; never commit it) |
| Install | `bun install --frozen-lockfile` | exit 0 |
| New tests | `bun test apps/web/tests/editor-contract/document/svg-recipe-roundtrip.test.ts` | all pass |
| Editor suite | `bun run test:editor` | all pass |
| Lint | `bun run check` | exit 0 |
| Typecheck (if plan 002 landed) | `bun run typecheck` | exit 0 |
| Manual check | `bun run dev` | see Step 5 |

## Scope

**In scope**:
- `packages/punch-schema/src/svg-embedded-document.ts` (create — extraction)
- `packages/punch-schema/src/index.ts` (export the new helpers)
- `apps/web/src/components/canvas/canvas-file-drop-importers.ts`
- `apps/web/src/components/panels/document-commands/use-document-commands.ts`
- The single workspace/platform seam needed to open a parsed document as a new
  tab (identified in Step 3 — keep the touch minimal)
- `apps/web/tests/editor-contract/document/svg-recipe-roundtrip.test.ts` (create)
- `README.md` — only if behavior ends up narrower than the README promise

**Out of scope**:
- `packages/engine/src/document/export.ts` — the export side already works;
  do not change the metadata format.
- Merging recipe nodes into the current document (id remap, asset merge) —
  explicitly deferred.
- `svg-import-document.ts` geometry conversion internals.
- Anything raster-runtime in `packages/engine` (refactor in flight elsewhere).
  Note: image nodes inside a recipe flow through schema load like any `.punch`
  open — that's fine; just don't modify raster engine code.

## Git workflow

- Conventional Commits; suggested: `feat: restore embedded design recipe on svg import`
  plus `test: ...` if you split.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Extraction helper in punch-schema

Create `packages/punch-schema/src/svg-embedded-document.ts`:

- `extractEmbeddedDocumentJson(svgSource: string): string | null` — find the
  first `<punchpress-document` …`>` … `</punchpress-document>` span
  (string/regex scan is fine; do NOT pull in an XML parser), take the inner
  text, and unescape in exactly this order: `&lt;`→`<`, `&gt;`→`>`,
  `&amp;`→`&` (amp last — it inverts `escapeMetadata`, which escaped amp
  first). Return null when the tag is absent or malformed.
- `parseEmbeddedDesignDocument(svgSource: string): DesignDocument | null` —
  composes the above with `parseDesignDocument`; returns null when no
  metadata is present; **lets parse/validation/version errors propagate** (the
  caller distinguishes "no recipe" from "broken recipe").

Export both from `packages/punch-schema/src/index.ts`.

**Verify**: `bun run check` → exit 0 (tests come in Step 2).

### Step 2: Round-trip contract test

Create `apps/web/tests/editor-contract/document/svg-recipe-roundtrip.test.ts`
(bun:test; model imports/document literal on
`apps/web/tests/editor-contract/document/load.test.ts`):

1. Build a valid document literal (copy the text-node `VALID_DOCUMENT` from
   load.test.ts), run it through the real exporter if cheap — otherwise
   construct the metadata block exactly as `withDocumentMetadata` does
   (including `escapeMetadata`) around a minimal `<svg>…</svg>` shell — and
   assert `parseEmbeddedDesignDocument` returns a document deep-equal to the
   input (text content, font, warp params preserved).
2. Special-character round-trip: text node whose `text` is `A & <B> "C"` —
   survives escape/unescape exactly.
3. No metadata → `extractEmbeddedDocumentJson` returns null;
   `parseEmbeddedDesignDocument` returns null.
4. Corrupt inner JSON → throws `DocumentParseError`.
5. Unsupported embedded version → throws `UnsupportedDocumentVersionError`.

If the real exporter is usable headlessly (check how existing tests call
`editor.exportDocument()` — grep `tests/editor-contract` for `exportDocument`),
prefer one true end-to-end case: create editor → load document → export →
extract → compare.

**Verify**: `bun test apps/web/tests/editor-contract/document/svg-recipe-roundtrip.test.ts` → all pass.

### Step 3: Locate the open-as-tab seam

Read `docs/internals/document-files.md`, then find where a successfully
parsed `.punch` open result becomes a new workspace tab (start in
`apps/web/src/workspace/workspace-provider.tsx` and the platform file
adapters). Identify the narrowest function you can call with (document
contents or parsed document + a display base name). Write down the symbol +
file in your progress notes.

**Verify**: you can name the exact function and its signature. If opening a
document inescapably requires a real file handle (no path accepts in-memory
contents), STOP — report the seam you found and the refactor it would take.

### Step 4: Wire both import entry points

Behavior for both entry points, implemented at each call site (keep
`importSvgToNodes` itself pure-geometry):

```
const embedded = tryParseEmbeddedDocument(svgText)  // wrapper, see below
if (embedded.kind === "document")  → open as new tab (Step 3 seam), toast "Restored editable design from <name>"
if (embedded.kind === "error")     → toast the existing error-message pattern (match how handleImportSvg reports failures today), do NOT fall back
if (embedded.kind === "none")      → current geometry import, unchanged
```

`tryParseEmbeddedDocument` is a small shared helper in the web layer (suggest
`apps/web/src/platform/svg-embedded-import.ts`) mapping the punch-schema
helper's null/throw contract onto that 3-way result. "Error" means metadata
exists but is corrupt/unsupported — restoring nothing is better than silently
importing dead geometry from a file the user knows is editable.

- Drop path: `canvas-file-drop-importers.ts` SVG importer — note its
  `importFile` returns nodes; opening a tab instead means returning no nodes.
  Check how the drop caller handles an empty return (grep usage of
  `CANVAS_FILE_DROP_IMPORTERS` / `getCanvasFileDropImport`); return `[]` and
  perform the tab-open side effect, unless the caller treats `[]` as failure —
  in that case adapt minimally and note it.
- Command path: `use-document-commands.ts` `handleImportSvg` — same 3-way
  branch; the success toast for the document case should mention restore, not
  import.

**Verify**: `bun run test:editor` → all pass; `bun run check` → exit 0.

### Step 5: Manual verification in the running app

`bun run dev`, then: create a design with a warped text node → export SVG →
import that SVG via the import command → a new tab opens; the text node is
selectable, its text editable, warp parameters intact. Then import a plain
(non-PunchPress) SVG → geometry import still works as before.

**Verify**: both behaviors observed.

## Test plan

See Step 2 (5 contract cases, ideally one true export→import round trip).
Pattern file: `apps/web/tests/editor-contract/document/load.test.ts`. No new
Playwright spec — per AGENTS.md, e2e is reserved for what editor-contract
can't honestly cover; the wiring is thin and manually verified in Step 5.

## Done criteria

- [ ] `extractEmbeddedDocumentJson` + `parseEmbeddedDesignDocument` exported from `@punchpress/punch-schema`
- [ ] Both import entry points restore-or-fallback per the 3-way contract
- [ ] `bun test apps/web/tests/editor-contract/document/svg-recipe-roundtrip.test.ts` → ≥5 tests pass
- [ ] `bun run test:editor` exits 0; `bun run check` exits 0
- [ ] Step 5 manual round-trip confirmed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 3 finds no way to open in-memory document contents as a tab without a
  platform refactor.
- The exported metadata format differs from the Step 1 excerpt (drift in
  export.ts).
- The drop-importer caller can't tolerate an importer that opens a tab
  instead of returning nodes without restructuring the importer table's
  contract.
- You're tempted to merge recipe nodes into the current document — that's the
  deferred feature, not this plan.

## Maintenance notes

- The metadata format (`escapeMetadata` + `<punchpress-document>`) is now a
  **compatibility surface** — exporter and extractor must change together;
  the round-trip test is the tripwire.
- When `PUNCH_DOCUMENT_VERSION` bumps, old exported SVGs hit the
  embedded-version error path; once real migrations exist in `migrate.ts`,
  they apply here for free (extraction feeds `parseDesignDocument`).
- Reviewer: scrutinize the unescape ordering (amp must be last) and the
  "error ≠ fallback" branch.
