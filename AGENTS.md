# Punchpress Agent Guide

AI-powered design tool for Print on Demand. See `README.md` for full product context.

Bun-workspace monorepo: `apps/web` (Vite + React editor), `apps/desktop` (Electrobun shell). Runtime stack is React, Zustand, and opentype.js.

Use these standards for new code and touched code during refactors.

## Working Model

- This is a work-in-progress codebase. Prefer the right end-state design over preserving legacy patterns.
- Do not carry forward compatibility layers unless they are still actively required.

## Code Style

- Keep files cohesive and scoped to one responsibility; target ~300 LoC per file unless there is a strong reason not to.
- Use kebab-case for file names.
- Prefer `const` + arrow function style for new functions/components.
- Prefer `.ts`/`.tsx` for new files. Existing `.jsx` files in `components/ui/` are fine as-is.
- Use extensionless local imports (`from "./foo"` not `from "./foo.ts"`).
- Put primary exports first and helper functions below.
- No index/barrel re-exports.
- Export only what is imported elsewhere.
- Do not use underscore prefixes for unused/private variables.
- Prefer TypeScript inference when the type context is already provided.
- Prefer `components/ui/` for standard controls and app chrome. Use native semantic elements when a custom interaction needs a different accessibility model.
- Use component `variant` and `size` props instead of ad-hoc styling overrides.
- Prefer shared color tokens in `apps/web/src/styles/global.css` or an existing token source over scattering bespoke color values through component or vendor CSS.
- Default to no CSS transitions for state changes like hover/selected backgrounds. Add motion only when it is intentional and clearly improves the interaction.
- Use Biome + Ultracite configuration (`biome.jsonc` + `bun run lint`).

## Testing

- Prefer a small number of high-signal tests over broad coverage.
- Add tests for behavior with non-trivial state, geometry, or library integration risk.
- Skip low-value tests for simple styling tweaks unless the behavior is easy to regress and hard to verify manually.

## Architecture

See `docs/architecture.md` for the full structure and rationale.

The editor follows a three-layer architecture inspired by tldraw:

1. **Editor core** (`apps/web/src/editor/`) — Plain TypeScript `Editor` class. Owns all state, tools, managers, and shape logic. No React imports in non-provider files.
2. **React bindings** — `EditorProvider`, `useEditor()`, and `useEditorValue(selector)` bridge the Editor to React.
3. **Components** (`apps/web/src/components/`) — Flat siblings under `canvas/` and `panels/`. Each calls `useEditor()` directly. No prop drilling for editor state.

### Architecture Rules

1. **No new props for editor state.** Components call `useEditor()` / `useEditorValue()`.
2. **No tool logic in canvas components.** Tool behavior goes in `editor/tools/`.
3. **No derived editor state in React hooks.** Put it on the `Editor` class or a manager.
4. **Components are flat.** Max 1 level of nesting inside `canvas/` or `panels/`.
5. **Pure logic has no React imports.** Geometry, math, warping, font parsing — none of these need React.
6. **Shape-specific code goes under `editor/shapes/<shape-name>/`.** Don't mix shape logic with editor infrastructure.

### Adding a New Node Type

1. Create `editor/shapes/<name>/model.ts` with `createDefault<Name>Node()` and default props.
2. Create `editor/shapes/<name>/<name>-engine.ts` for geometry/rendering logic.
3. Add a tool in `editor/tools/<name>-tool.ts` if needed.
4. Add a renderer component in `components/canvas/`.
5. Add property fields in `components/panels/`.

## Docs Index

- `docs/architecture.md` — Editor architecture, file structure, and layer responsibilities
- `docs/architecture-north-star.md` — Original north star (historical reference)
- `docs/design-system.md` — UI component system, Base UI policy, COSS UI workflow
- `docs/desktop-release.md` — macOS signing, notarization, S3 publishing, and auto-update setup
- `docs/release-runbook.md` — canonical version bump, changelog, tag, and publish flow
- `docs/ai-commands/version-bump/README.md` — agent workflow for `do a version bump`
- `docs/architecture-decisions/` — Durable architectural decisions

## Release Workflow

- Treat `docs/release-runbook.md` as the source of truth for version bumps, changelog updates, GitHub tags, and desktop publish steps.
- If the user says `do a version bump`, follow `docs/ai-commands/version-bump/README.md`.
- Keep `CHANGELOG.md`, `apps/desktop/package.json`, and `apps/web/package.json` synchronized for each release.
- Write changelog entries for end users in product-release language, not engineering implementation language.

## Commit Format

Use Conventional Commit style: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`.
