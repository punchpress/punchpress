---
summary: Defines when to use direct Editor and plain TypeScript tests, how they exercise durable behavior, and what belongs outside this layer.
read_when:
  - adding regression coverage for document, selection, geometry, transform, export, or engine behavior
  - deciding whether a bug can be proven without launching a browser
  - changing the Editor debug dump or editor-contract test harness
---

# Editor Contract

Editor-contract tests are the default for durable PunchPress behavior.

They run with `bun:test` against the plain `Editor` class or a plain TypeScript
module. They avoid the browser when the browser is not the thing being tested.

## Use For

- document load, save, normalization, and migration behavior
- selection, grouping, ordering, visibility, and history
- node geometry, hit behavior, transform math, and export invariants
- text, shape, vector, path, and artboard editor commands
- platform adapter logic when it can be tested without real browser UI

## Shape

1. Construct editor state or load a `.punch` fixture.
2. Execute real editor commands.
3. Assert through `getDebugDump()` or the public module API.

`.punch` fixtures are inputs. The contract is the editor behavior they prove.

## Do Not Use For

- pointer-event routing
- keyboard focus behavior
- DOM overlay placement
- browser-only file picker or clipboard APIs
- visual checks that depend on rendered elements

Use [Playwright](playwright.md) when the real browser path is the contract.
