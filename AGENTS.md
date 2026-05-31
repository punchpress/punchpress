# Punchpress Agent Guide

AI-powered design tool for Print on Demand. See `README.md` for full product context.

Bun-workspace monorepo: `packages/engine` (headless editor), `packages/punch-schema` (document schema), `apps/web` (Vite + React editor), and `apps/desktop` (Electron shell). Runtime stack is React, Zustand, and opentype.js.

Use these standards for new code and touched code during refactors.

## Working Model

- This is a work-in-progress codebase. Prefer the right end-state design over preserving legacy patterns.
- Do not carry forward compatibility layers unless they are still actively required.

## Code Style

- Keep files highly cohesive, functionally oriented, and scoped to one responsibility; target under 300 LoC for most files unless there is a strong reason not to.
- Prefer composition of small focused modules and components over monolithic files or layered indirection.
- Do not prop drill. Reach shared state through the appropriate editor API, context, store, or manager.
- Keep function parameter lists and component prop surfaces small; prefer 4 or fewer inputs unless a broader interface is clearly justified.
- When a file grows past ~180-220 LoC or starts owning multiple concerns, turn it into a feature folder and split the behavior into sibling modules.
- React components should primarily render and compose. Move non-trivial behavior, orchestration, and policy into focused domain modules or hooks outside the component file.
- Use compound component composition for complex UI instead of wide prop APIs. Prefer `Root`, `Trigger`, `Content`, `List`, `Item`, and similar patterns over passing large config bags through a single component.
- Pass structure downward and read shared state locally. Passing `children`, slots, ids, and event handlers is good; relaying derived editor/app state through intermediate components is not.
- Prefer plain modules for editor behavior. Reserve long-lived "manager" objects for stateful subsystems with lifecycle, caching, async coordination, or external integration boundaries.
- Name modules and hooks after user-facing behaviors or actions when possible. Prefer names like `use-unsaved-document-warning` over mechanism names like `use-unsaved-document-guard`.
- Prefer simple operation-first editor method names. Favor names like `select`, `moveSelectionBy`, `bringToFront`, and `toggleVisibility` over mechanism-heavy names.
- Do not encode caller context in public editor method names when it can be expressed by parameters or current selection. Prefer `bringToFront(nodeId?)` over pairs like `bringNodeToFront` and `bringSelectedToFront`.
- Keep low-level/store primitives more explicit when needed, but keep the `Editor` surface terse and product-shaped.
- Use kebab-case for file names.
- Prefer `const` + arrow function style for new functions/components.
- Prefer `.ts`/`.tsx` for new files. Existing `.jsx` files in `components/ui/` are fine as-is.
- Use extensionless local imports (`from "./foo"` not `from "./foo.ts"`).
- Put primary exports first and helper functions below.
- No index/barrel re-exports, except for package root public APIs such as `@punchpress/engine` and `@punchpress/punch-schema`.
- Export only what is imported elsewhere.
- Do not use underscore prefixes for unused/private variables.
- Prefer TypeScript inference when the type context is already provided.
- Prefer `components/ui/` for standard controls and app chrome. Use native semantic elements when a custom interaction needs a different accessibility model.
- Use component `variant` and `size` props instead of ad-hoc styling overrides.
- Prefer shared color tokens in `apps/web/src/styles/global.css` or an existing token source over scattering bespoke color values through component or vendor CSS.
- Default to no CSS transitions for state changes like hover/selected backgrounds. Add motion only when it is intentional and clearly improves the interaction.
- Use Biome + Ultracite configuration (`biome.jsonc` + `bun run lint`).

## Testing

See `docs/operations/testing.md` for test-layer selection and
`docs/reference/performance-tests.md` for performance benchmark commands,
labels, artifacts, and CLI inspection.

- Prefer a small number of high-signal tests over broad coverage.
- Default to test-driven development for bug fixes and feature work: add or update the test first when feasible, observe it fail for the target behavior, then implement the fix and verify it passes.
- If a test cannot realistically be written first, add it immediately after the implementation in the same task.
- For reported bugs, prefer a reproducing regression test before the fix and verify the failing-then-passing cycle when practical.
- Add tests for behavior with non-trivial state, geometry, or library integration risk.
- Skip low-value tests for simple styling tweaks unless the behavior is easy to regress and hard to verify manually.
- Name test files after the concrete behavior and path under test. Prefer names like `text-node-move` or `layer-shift-select` over vague buckets like `document-io` or `layer-actions`.
- Put durable editor behavior in `editor-contract` tests and reserve Playwright for end-to-end interaction wiring, browser behavior, and cases that cannot be covered honestly through the engine surface.
- Minimize mocks; prefer exercising real editor flows and document state unless an external boundary leaves no reasonable alternative.
- Use Playwright only for behavior we truly need and cannot cover honestly in `editor-contract`. Do not spend Playwright tests on primitives like file pickers, shell plumbing, or other setup paths when the real product value is elsewhere.

## Architecture

See `docs/internals/architecture-overview.md` for the current code layout and layer rationale.
See `docs/internals/editor-facade.md` for the editor command surface.
See `docs/internals/react-bindings.md` for the React bridge and subscription model.
See `docs/docs-policy.md` before adding, moving, or retiring docs.

The editor follows a five-layer architecture:

1. **Engine core** (`packages/engine/src/`) — Plain TypeScript `Editor` class. Owns state, tools, managers, node logic, transforms, geometry, and export behavior. No React imports.
2. **Schema/document layer** (`packages/punch-schema/src/`) — `.punch` schema, parse/load/save/migrate helpers, and shared font descriptor utilities.
3. **React bindings** (`apps/web/src/editor-react/`) — `EditorProvider`, `useEditor()`, and `useEditorValue(selector)` bridge the engine to React.
4. **Components** (`apps/web/src/components/`) — Flat siblings under `canvas/` and `panels/`. Each calls `useEditor()` directly. No prop drilling for editor state.
5. **Platform layer** (`apps/web/src/platform/` and desktop shell boundaries) — Browser and Electron capabilities such as file flows, recent documents, local font access, and command bridges.

The editor is the product engine. Put durable behavior in the editor, not in React.
React is a client of the editor: it renders editor state and translates GUI interactions into editor commands.
Tests, CLI workflows, and AI automation should converge on the same editor command and inspection surfaces rather than creating separate behavior paths.

### Architecture Rules

1. **No new props for editor state.** Components call `useEditor()` / `useEditorValue()`.
2. **No tool logic in canvas components.** Tool behavior goes in `packages/engine/src/tools/`.
3. **No derived editor state in React hooks.** Put it on the `Editor` class or a manager.
4. **Components are flat.** Max 1 level of nesting inside `canvas/` or `panels/`.
5. **Pure logic has no React imports.** Geometry, math, warping, font parsing — none of these need React.
6. **Node-specific code goes under `packages/engine/src/nodes/<node-type>/`.** Don't mix node logic with editor infrastructure.
7. **Split behavior by capability.** Prefer folders like `document/`, `selection/`, `transform/`, `viewport/`, and `input/` over large mixed-purpose modules.
8. **Manager is a high bar.** Use a manager only when the code owns durable state, subscriptions, caching, async work, or an external system boundary.
9. **Favor compound UI families.** Complex controls should live in dedicated folders and expose composable parts instead of one component with many props.

### Adding a New Node Type

1. Create `packages/engine/src/nodes/<name>/model.ts` with `createDefault<Name>Node()` and default props.
2. Create `packages/engine/src/nodes/<name>/<name>-engine.ts` for geometry/rendering logic.
3. Add a tool in `packages/engine/src/tools/<name>-tool.ts` if needed.
4. Add a renderer component in `components/canvas/`.
5. Add property fields in `components/panels/`.

## Docs Index

- `docs/README.md` — top-level docs map
- `docs/docs-policy.md` — docs surfaces, frontmatter, brevity, review, and migration rules
- `docs/product/README.md` — product behavior docs index
- `docs/internals/README.md` — editor systems and ownership docs index
- `docs/reference/README.md` — exact contracts, formats, commands, and API references
- `docs/operations/README.md` — development, testing, performance, and release workflows
- `docs/decisions/README.md` — durable architecture decisions
- `docs/design/system.md` — UI component system, Base UI policy, COSS UI workflow

## Product Docs

- `docs/product/` contains high-level product behavior and contracts.
- Product docs are concise, product-facing, and focused on behavior that is hard to infer from code search.
- Keep architecture notes in `docs/internals/`, exact formats in `docs/reference/`, workflows in `docs/operations/`, and durable tradeoffs in `docs/decisions/`.
- When behavior changes or becomes clearer, update the relevant product doc in the same task.

## Release Workflow

- Treat `docs/operations/releases.md` as the source of truth for version bumps, changelog updates, GitHub tags, and desktop publish steps.
- If the user says `do a version bump`, follow `docs/operations/version-bumps.md`.
- Keep `CHANGELOG.md`, `apps/desktop/package.json`, and `apps/web/package.json` synchronized for each release.
- Write changelog entries for end users in product-release language, not engineering implementation language.

## Commit Format

Use Conventional Commit style: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`.
