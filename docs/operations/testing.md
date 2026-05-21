---
summary: Explains PunchPress test-layer selection for editor-contract, Playwright, and performance checks without duplicating test names.
read_when:
  - deciding how to verify an editor behavior change
  - choosing between direct Editor tests, browser interaction tests, and performance benchmarks
  - updating test strategy after architecture or package-script changes
---

# Testing

Use the simplest test layer that can prove the behavior.

PunchPress is a graphics editor. Some regressions live in the headless editor,
some live at the React/browser boundary, and some are only meaningful as
render-path measurements. One test type should not carry all three jobs.

## Layers

| Layer | Use for | Command |
| --- | --- | --- |
| Editor contract | Durable editor behavior, document state, geometry invariants, selection, transforms, export, plain TypeScript modules. | `bun run test:editor` |
| Playwright | Pointer wiring, keyboard focus, DOM geometry, overlays, browser APIs, GUI command routing. | `bun run test:e2e` |
| Performance | Repeatable browser or desktop measurements of interaction cost. | `bun run test:performance` |

## Default Rule

When changing editor behavior:

1. Start with editor-contract coverage when the behavior can be exercised
   through `Editor` or a plain module.
2. Add Playwright coverage only when browser truth matters: pointer routing,
   focus, DOM overlays, browser APIs, visual alignment, or real UI command
   wiring.
3. Use the performance harness when the risk is frame cost, render-path
   regression, benchmark output, or trace diagnostics.
4. Update the relevant product doc when product behavior changes.

Docs should not list individual test files. Test names and paths should be
specific enough to find with `rg`.

## Commands

```bash
bun run test:editor
bun run test:editor:watch
bun run playwright:install
bun run test:e2e
bun run test:e2e:headed
bun run test:e2e:ui
```

For performance commands, see [Performance](performance.md).
