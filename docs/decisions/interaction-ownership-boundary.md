---
summary: Defines the boundary between React event capture and engine-owned interaction semantics for gestures, history, selection, and automation.
read_when:
  - deciding whether pointer, keyboard, drag, duplicate, selection, or history logic belongs in React or the engine
  - adding a new UI entry point for an existing editor action
  - noticing the same gesture implemented differently across canvas, overlay, panel, or automation paths
---

# Interaction Ownership Boundary

Status: Accepted
Date: 2026-03-22

## Context

Pointer and keyboard events arrive through React and browser-integrated
libraries. It is tempting to define interaction behavior where those events
first appear.

That causes drift:

- the same gesture gets implemented differently across UI entry points
- durable editor behavior becomes hard to reuse from tests, automation, or
  future clients

## Decision

React owns platform event capture. The engine owns interaction semantics.

- React may detect pointer and keyboard events, perform DOM hit testing, and
  adapt browser callbacks into editor-friendly inputs.
- The engine owns gesture policy: drag lifecycle, duplicate rules, selection
  changes, transform behavior, history grouping, cancel, and commit semantics.
- Different UI entry points for the same user action converge on one editor
  command or session model.
- Browser-only concerns stay outside the engine: pointer capture, element refs,
  browser clipboard APIs, DOM overlays, and third-party event libraries.

## Consequences

- React, tests, AI automation, and future clients share the same behavior
  surface.
- Modifier behavior is implemented once.
- Node-origin, overlay-origin, and command-origin interactions do not drift.
- If interaction logic starts branching by UI surface, look for a shared editor
  command or session abstraction.
