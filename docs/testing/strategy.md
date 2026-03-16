# Testing Strategy

Punchpress has two main test types:

- editor-contract
- playwright

Use the simplest one that can verify the behavior with confidence.

## Why This Split Exists

Punchpress is a graphics editor. Different regressions show up at different
layers.

- Some bugs live in editor behavior.
- Some bugs live in document or platform modules outside the editor.
- Some bugs only show up through the real browser UI.

One test type should not try to do all three jobs.

## What Goes Where

### editor-contract

The default test type for editor behavior.

These tests run against `Editor` directly and assert through the debug dump.

See [editor-contract.md](./editor-contract.md).

### playwright

Use this when the browser UI path matters.

See [playwright.md](./playwright.md).

## Default Rule

When changing editor behavior:

1. Start with an `editor-contract` test.
2. Add a `playwright` test only if the real browser path matters.
3. Update the relevant `docs/specs/` doc when product behavior changes.
