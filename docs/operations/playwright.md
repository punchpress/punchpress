---
summary: Defines when PunchPress needs browser-backed tests for pointer wiring, focus, overlays, visual geometry, and GUI command routing.
read_when:
  - reproducing a bug that only appears through the rendered editor
  - changing canvas overlays, pointer handlers, keyboard focus, browser APIs, or GUI command wiring
  - deciding whether editor-contract coverage is too narrow for an interaction
---

# Playwright

Use Playwright when the real browser path is part of the contract.

## Use For

- pointer interaction wiring
- keyboard shortcuts and focus behavior
- command routing from GUI controls into the editor
- browser-only APIs
- overlay alignment, handle placement, and visible geometry checks

## Rules

- Prefer assertions against the visible surface users interact with: overlay
  boxes, guides, handles, rows, menus, or rendered artwork.
- Reproduce interaction-specific bugs through the real user path before fixing
  them.
- Keep browser tests focused on browser truth: geometry, visibility, pointer
  routing, focus, and coordinate-space correctness.
- Do not use Playwright to prove broad editor correctness when the behavior can
  be checked directly through `Editor`.

## Commands

```bash
bun run playwright:install
bun run test:e2e
bun run test:e2e:headed
bun run test:e2e:ui
```
