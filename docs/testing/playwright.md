# playwright

Use this when the real browser path matters.

## Use It For

- pointer interaction wiring
- keyboard shortcuts and focus behavior
- command routing from the GUI into the editor
- browser-only APIs
- visual checks such as overlay alignment or handle placement

## Why It Matters

- verifies that the UI actually drives the editor correctly
- catches bugs at the React, DOM, and browser boundary
- covers visual problems that do not show up in editor state alone

## Keep It Narrow

Do not use Playwright to carry the full weight of editor correctness.

If a behavior can be checked directly in `Editor`, prefer `editor-contract`.

Do not spend Playwright tests on primitives like file pickers or setup plumbing
unless that primitive is itself an important product contract.
