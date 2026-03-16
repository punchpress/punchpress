# Editor Extraction Plan

This document describes the remaining migration work to make Punchpress's
editor independent from the React app and ready to move to `packages/editor`.

It is a migration plan, not a product spec.

## End State

Punchpress should have:

- an editor engine that does not live inside `apps/web`
- a React app that renders editor state and forwards GUI intent into editor
  commands
- editor-contract tests that validate most editor behavior without the browser
- Playwright tests that stay focused on browser wiring and visual behavior
- product specs in `docs/specs/` that describe behavior clearly enough for both
  editor and browser tests to target

The intended final home for the engine is `packages/editor`.

## Current Starting Point

We already have:

- a real `Editor` class
- a structured debug dump
- the first migrated editor-contract tests under `apps/web/tests/editor-contract`
- the first resize refactor where the UI keeps the drag session and editor code
  owns resize execution

That is enough foundation to continue the migration incrementally.

## Main Workstreams

### 1. Finish Separating Editor Behavior From React

Continue moving durable behavior out of React/canvas code and into editor land.

The rule is:

- React owns event handling, DOM integration, and drag-session orchestration
- editor code owns commands, math, invariants, and resulting state updates

Priority areas:

- remaining transform paths such as move and rotate
- selection behavior that still depends on React-local derivation
- any browser bridge helpers that still own editor behavior

### 2. Make The Editor Command Surface Explicit

Every meaningful editor behavior should be callable without the GUI.

That means continuing to add editor-side commands for actions such as:

- transforms
- selection changes
- text edits
- layer/order changes
- document load/save/export flows

Tests, CLI workflows, AI integrations, and browser glue should all converge on
that same command surface.

### 3. Keep The Inspection Surface Stable

The debug dump should remain the main structured inspection surface.

As editor behavior expands, keep adding stable, behaviorally meaningful output
to the dump rather than pushing tests toward ad hoc DOM reads.

When useful, extend the dump with:

- geometry and bounds facts
- selection details
- export summaries
- warnings and bootstrap state

### 4. Migrate Tests Deliberately

The goal is not to delete Playwright. The goal is to move the right assertions
to the right layer.

For each meaningful feature:

1. Add or migrate an editor-contract test for editor behavior.
2. Keep or add a Playwright test only if the browser path itself matters.
3. Remove broad Playwright coverage that only re-tests editor invariants.

Playwright should stay responsible for:

- pointer and keyboard wiring
- focus behavior
- browser-only APIs
- visual/overlay correctness

Editor-contract tests should absorb:

- document behavior
- transforms and geometry invariants
- selection invariants
- export invariants
- other deterministic editor behavior

### 5. Fill Missing Editor-Contract Coverage

As we migrate, add missing editor-contract tests for the highest-risk editor
behaviors.

Priority examples:

- move
- rotate
- layer/order behavior
- undo/redo
- document round-trip and export invariants
- missing-font handling that belongs in editor land

The standard shape is:

- load a `.punch` fixture or construct state
- execute editor commands
- assert through the debug dump or another structured editor output

### 6. Keep Playwright Thin As It Adapts

When a Playwright test currently reaches into browser-only helper code to do
editor work:

- move the editor work into editor code
- have Playwright call that editor capability or the real UI path
- keep the Playwright assertion focused on browser concerns

This is the same pattern we started with the resize refactor.

### 7. Update Specs As We Go

During this migration, update `docs/specs/` whenever behavior is missing,
unclear, or changes.

Do not let test migration become disconnected from product behavior.

If a feature is important enough to migrate and protect with better tests, it
is important enough to have a clear product-facing spec.

## Suggested Sequence

1. Continue transform extraction: move, then rotate.
2. Migrate the next high-signal editor-contract tests from Playwright.
3. Tighten Playwright coverage so it focuses on GUI/browser concerns.
4. Finish any remaining React-local editor behavior moves.
5. Move `apps/web/src/editor` into `packages/editor`.
6. Update imports so `apps/web` becomes a client of the extracted package.

## Done Means

This migration is complete when:

- durable editor behavior no longer lives in React files
- editor-contract tests cover the bulk of editor regression risk
- Playwright is narrow and browser-focused
- the editor can be imported independently of `apps/web`
- the code can be moved to `packages/editor` without changing the conceptual
  boundary
