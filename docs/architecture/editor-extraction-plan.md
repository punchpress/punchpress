# Editor Extraction Plan

This document describes the remaining migration work after extracting the
editor into `packages/engine` and the document layer into
`packages/punch-schema`.

It is a migration plan, not a product spec.

## End State

Punchpress should have:

- a headless engine in `packages/engine`
- a single `.punch` schema/document package in `packages/punch-schema`
- a React app that renders engine state and forwards GUI intent into engine
  commands
- editor-contract tests that cover most regression risk
- Playwright tests that stay focused on UI/browser behavior

## Current State

We already have:

- `packages/engine`
- `packages/punch-schema`
- `apps/web/src/editor-react` as the React bridge
- editor-contract tests running against the extracted engine
- Playwright still green against the web app

The big move is done. The remaining work is boundary cleanup and API
tightening.

## Remaining Work

### 1. Keep Platform Concerns Out Of The Engine

Do not let `packages/engine` grow new imports from `apps/web` or browser /
Electron modules.

Host-specific concerns should stay app-side, including:

- local font discovery
- file picker and save flows
- recent documents
- persisted UI preferences
- Electron command bridges

### 2. Keep Tightening The Editor/App Split

Continue moving durable behavior out of React/canvas helpers and into engine
modules.

The rule stays:

- React owns DOM integration and gesture wiring
- the engine owns commands, math, invariants, and resulting state updates

### 3. Keep The Command Surface Explicit

Every meaningful editor behavior should be callable without the GUI.

Tests, CLI workflows, AI integrations, and browser glue should converge on the
same engine command surface.

### 4. Keep The Inspection Surface Stable

The debug dump should remain the main structured inspection surface.

When new behavior matters for tests or automation, prefer extending structured
inspection over adding ad hoc DOM reads.

### 5. Keep Tests On The Right Side Of The Boundary

Editor-contract tests should cover:

- document behavior
- transforms and geometry invariants
- selection invariants
- export invariants
- other deterministic engine behavior

Playwright should cover:

- pointer and keyboard wiring
- focus behavior
- browser-only APIs
- visible overlay / UI behavior

### 6. Update Specs As The Surfaces Get Clearer

When behavior changes or becomes clearer during this migration, update
`docs/specs/` in the same task.

## Done Means

This migration is complete when:

- durable editor behavior no longer lives in React files
- `packages/engine` has no app/platform imports
- `packages/punch-schema` is the single home of `.punch` schema/versioning
- editor-contract tests cover the bulk of regression risk
- Playwright is narrow and browser-focused
- the engine can be imported independently of `apps/web`
