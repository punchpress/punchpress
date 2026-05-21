---
summary: Defines `Editor` as the engine facade that wires document, node, selection, path, transform, tool, viewport, font, clipboard, history, and inspection modules.
read_when:
  - adding an editor command or inspection method
  - reducing duplicated behavior across React, tests, automation, or desktop menus
  - deciding whether an operation should become public editor API or stay module-private
---

# Editor Facade

`packages/engine/src/editor.ts` is an intentional facade. It exposes product
commands and inspection surfaces while delegating behavior to focused modules.

## Responsibilities

- route public commands to document, selection, transform, path, tool, viewport,
  font, clipboard, and history modules
- own lifecycle attachment to host refs
- expose derived state needed by React, tests, automation, and desktop menus
- keep operation names product-shaped and caller-neutral

## Boundary

The facade may know about host refs because browser clients need them for
viewport integration. It must not own DOM event policy, native file dialogs,
Electron IPC, or React rendering.

If two UI surfaces duplicate behavior, add or use an editor command instead of
copying policy.
