# 0004: Interaction Ownership Boundary

Status: Accepted

Date: 2026-03-22

## Context

Punchpress is a browser app, so pointer and keyboard events arrive through React
land and browser-integrated libraries such as Moveable and Selecto.

That creates a recurring temptation to let interaction behavior live where the
events first appear. This is convenient in the moment, but it causes two kinds
of drift:

- the same gesture gets implemented differently across multiple UI entry points
- durable editor behavior becomes hard to reuse from tests, automation, or
  future clients

Drag interactions are a good example. A drag may begin from a node, from the
selection overlay, or from another interaction surface later. Those are
different event sources, but they should not become different product
behaviors.

## Decision

React land owns platform event capture. Editor land owns interaction semantics.

The durable rules are:

- React and browser-facing code may detect pointer and keyboard events, do DOM
  hit-testing, and adapt third-party library callbacks into editor-friendly
  inputs
- the engine should own interaction state machines and gesture policy such as
  drag lifecycle, duplication rules, selection changes, transform behavior,
  history grouping, and cancel / commit semantics
- if two UI entry points represent the same user action, they should converge
  on one editor command or session model rather than duplicate policy in React
  code
- browser-only concerns such as pointer capture, element refs, clipboard APIs,
  and Moveable / Selecto integration stay outside the engine
- durable behavior should be testable through editor-contract tests, while E2E
  tests should focus on browser wiring and visual interaction boundaries

## Rationale

- This keeps the editor usable by React, tests, AI automation, and future
  clients through the same behavior surface.
- It reduces divergence between node-origin and overlay-origin interactions.
- It makes modifier behavior such as alt-drag duplicate easier to implement once
  and harder to regress.
- It keeps DOM-specific concerns out of the headless engine without pushing
  product logic into the frontend.

## Current Rules

1. React may translate raw input into normalized editor commands or session updates.
2. The engine should decide what a gesture means.
3. The engine should own history boundaries for durable interactions.
4. If interaction logic starts branching by UI surface, stop and look for a
   shared editor command or session abstraction.
5. If a behavior can be exercised honestly without a browser, prefer covering it
   in editor-contract tests.

## Source of Truth

The current implementation lives in:

- `packages/engine/src/interaction/interaction-actions.ts`
- `packages/engine/src/state/store/interaction-state.ts`
- `packages/engine/src/transform/selection-drag.ts`
- `packages/engine/src/editor.ts`
- `apps/web/src/components/canvas/canvas-node.tsx`
- `apps/web/src/components/canvas/canvas-overlay/canvas-drag-handlers.ts`
