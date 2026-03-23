# Editor Operating Model

Punchpress should behave like an editor engine with multiple clients, not like
a GUI that contains editor logic.

This document describes that conceptual model. It is separate from codebase
structure docs and separate from product specs.

## Core Model

There should be one real editor.

That editor owns:

- document state
- the command surface that changes it
- the inspection surface that reports it

Everything else is a client of that editor.

## The Three Lands

### Editor Land

Editor land is the source of truth. It owns behavior such as document loading,
selection, transforms, geometry, export, and validation.

### React Land

React land is a client of the editor. Its job is to render editor state and
translate GUI interactions into editor commands.

React land may own browser event capture and DOM-specific adapters, but it
should not become the source of truth for durable interaction behavior.

### Automation Land

Automation land includes tests, CLI workflows, AI agents, and future
programmatic integrations. It should drive the same editor commands and inspect
the same structured editor state as the GUI.

## One Action Surface, One Inspection Surface

The operating model should converge toward two durable surfaces:

- an action surface for editor work such as load, select, update, transform,
  and export
- an inspection surface for reading the resulting editor state

Today the inspection surface starts with the debug dump.

## Why This Matters

- Testing: most regressions can be checked by loading a real `.punch` file,
  executing editor commands, and asserting on structured editor state.
- UI boundaries: React and browser tests still matter, but mainly for GUI
  wiring, browser-specific behavior, and rendering boundaries.
- AI readiness: if Punchpress is meant to be AI-drivable, the editor cannot
  only exist through the GUI. The same foundation also supports a future CLI.

## Practical Rule

When adding a feature:

1. Put the behavior in editor land.
2. Expose it through a durable editor command.
3. Make the GUI call that command.
4. Make tests and automation inspect the result through the structured
   inspection surface.

For interaction-heavy features, use this split:

- React owns event capture, DOM hit-testing, and third-party browser library adapters.
- The editor owns gesture semantics, history boundaries, selection effects, and transform policy.
