# editor-contract

This is the default test type for Punchpress.

Use `bun:test` against the plain `Editor` class.

## Use It For

- document load and save behavior
- text and transform updates
- selection logic
- geometry invariants
- export invariants
- other durable editor behavior
- risky plain TypeScript modules outside `Editor`, such as document parsing or
  platform adapters, when the browser path is not relevant

## Why It Matters

- fastest feedback loop
- closest to the product behavior engine
- easiest for agents to reason about

## How It Works

- load a `.punch` fixture or construct state directly
- execute real editor commands
- assert through `getDebugDump()`

`.punch` files are inputs, not the contract by themselves.

For non-`Editor` modules, use the same `bun:test` style but assert directly on
the module API instead of the debug dump.

## Do Not Use It For

- pointer-event wiring
- keyboard focus behavior
- DOM overlay alignment
- browser-only APIs
