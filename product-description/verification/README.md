# Verification

The seven checklists cover all 29 behavior documents. P1 checks cover central
contracts and interruption risks; P2 ordinary behavior; P3 exact appearance or
motion details. Run P1 first, then P2, then P3.

## Start the app

From the monorepo root, run `bun install --frozen-lockfile` if dependencies are
missing, then `bun run dev:web --port "$(dev-port)" --host 127.0.0.1`.
Open the URL printed by Vite in Codex's in-app browser. Use disposable test
content. Record `git rev-parse HEAD` and any app-code diff before testing.

The first pass used `http://127.0.0.1:29020/` at commit `d4e6d4a` on macOS.
The port is checkout-specific; use the command's output for later runs.

## Record results

Each row needs a setup, steps, expected observation, and result. Use `pass`,
`fail`, or `blocked`, plus the date, tester type, and relevant limitation.
An unrun row stays `not run` or `—`. Use `partial` when only part of a row was
observed; it does not count as a pass. A question row asks the tester to record
actual behavior; resolve the description before treating it as a passed contract.

Put supported suspected defects in [bug-triage.md](../bug-triage.md). A mismatch
can mean the document is wrong. Distinguish that from a product bug. Preserve
checklist IDs when editing or filing results.

Promote the feature in [Coverage](../README.md#coverage) only after a human pass
through every P1/P2 item, with failures recorded. Agent browser checks alone
leave it drafted.

## First-pass results

On 2026-09-07, Codex drove the in-app browser through UI input and inspected
screenshots and accessibility state. It used disposable artwork, without state
injection. Several rows reuse one gesture's evidence, so these counts describe
checklist observations rather than independent test executions.

| Checklist | Total | Pass | Fail | Partial | Blocked | Not run |
| --- | --- | --- | --- | --- | --- | --- |
| [Hand tool](hand-tool.md) | 23 | 5 | 0 | 0 | 0 | 18 |
| [Foundations](foundations.md) | 11 | 4 | 0 | 1 | 2 | 4 |
| [Selection](selection.md) | 17 | 5 | 0 | 0 | 5 | 7 |
| [Vector](vector.md) | 220 | 2 | 0 | 0 | 0 | 218 |
| [Text and raster](text-raster.md) | 169 | 4 | 0 | 0 | 0 | 165 |
| [Documents](documents.md) | 246 | 1 | 0 | 0 | 0 | 245 |
| [Workspace](workspace.md) | 23 | 9 | 2 | 0 | 2 | 10 |
| Total | 709 | 30 | 2 | 1 | 9 | 667 |

Observed flows include Hand activation and pan, a Social Square document,
shape placement and conversion to an ellipse, move/resize with Undo, text
placement and Escape from inline editing, a raster brush stroke and erasure,
command-menu search, numeric Properties editing, and opening the performance
HUD before canceling its destructive benchmark prompt.

The failures reproduce [numeric-field clearing](../bug-triage.md#b-01) and
[command-menu reset inconsistency](../bug-triage.md#b-02). Remaining triage entries
are source-supported findings, not browser-confirmed defects.

## Limits and next pass

Most checklist rows have not been executed. Held-key changes during a drag,
focus loss, release outside the window, touch/stylus, permissions, native Electron
flows, downloads, external asset services, and controlled persistence races need
additional verification. The benchmark itself was not run. Observing a basic
interaction does not verify its complete modifier or interruption matrix.

Start the next pass with the three high-severity findings in
[bug triage](../bug-triage.md): scratchpad debounce on tab switching, editing
during an awaited save, and loading before local-font access. Use disposable
fixtures and inspect persisted results. Then finish P1/P2 checks cluster by
cluster. No document is marked verified yet.

## Automated checks

At the same source baseline, `bun run test:editor` passed 410 tests across 74
files with 1,830 assertions. `bun run typecheck` passed for punch-schema and the
engine; `bun run check` passed for 389 files. These checks establish the existing
code's test status and do not substitute for the observational checklist.

Run the imported consistency checker from the monorepo root:

```sh
python3 .agents/skills/product-description/references/check-links.py product-description
```

The final pass checks relative files and anchors, the inventory, checklist IDs,
and the shared feature skeleton. Application source and existing docs were not
modified by this description work.
