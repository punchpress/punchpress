# Codebase Structure

This document describes the current code layout and layer boundaries for
Punchpress.

Punchpress now has a clean package split:

- `packages/engine` owns the headless editor engine
- `packages/punch-schema` owns the `.punch` format and shared document helpers
- `apps/web` is a client of those packages

## Layers

### Layer 1: Engine Core (`packages/engine/src/`)

The `Editor` class is the product engine. It owns state, tools, transforms,
geometry, history, and export behavior. It has no React imports.

```text
packages/engine/src/
├── editor.ts
├── debug-dump.ts
├── document/
├── editing/
├── fonts/
├── history/
├── input/
├── managers/
├── primitives/
├── queries/
├── selection/
├── shapes/
├── state/store/
├── tools/
├── transform/
└── viewport/
```

### Layer 2: Schema / Document (`packages/punch-schema/src/`)

This package owns the persistent `.punch` format and schema-adjacent helpers.

```text
packages/punch-schema/src/
├── constants.ts
├── document-fonts.ts
├── errors.ts
├── load.ts
├── local-fonts.ts
├── migrate.ts
├── save.ts
└── schema.ts
```

### Layer 3: React Bindings (`apps/web/src/editor-react/`)

These files are the React-specific bridge to the engine.

```text
apps/web/src/editor-react/
├── editor-provider.tsx
├── use-editor.ts
├── use-editor-value.ts
└── default-font.ts
```

`EditorProvider` is also where app-side host capabilities are attached to the
engine, such as:

- local font discovery
- font byte loading
- persisted default font preferences

### Layer 4: Components (`apps/web/src/components/`)

Components render state and forward GUI intent into engine commands. They
should not own durable editor behavior.

### Layer 5: Platform (`apps/web/src/platform/`)

The web app owns browser and desktop-shell boundaries such as:

- file picker and save flows
- recent documents
- browser/Electron local font access
- Electron command bridges

Those capabilities stay outside `packages/engine`.

## Responsibilities

**Engine responsibilities**

- own the `Editor` API and store
- own selection, transform, history, geometry, and export behavior
- expose structured inspection like the debug dump
- stay free of React and app/platform imports

**Schema responsibilities**

- define `.punch` shape and versioning
- parse, validate, migrate, and serialize documents
- provide shared document/font descriptor utilities

**React responsibilities**

- render engine state
- translate GUI interactions into engine commands
- attach host capabilities to the engine at runtime

**Platform responsibilities**

- browser/Electron integration
- file system boundaries
- local font discovery

## Current Rule

If a piece of code could run in a headless CLI or AI workflow, it belongs in
`packages/engine` or `packages/punch-schema`, not in `apps/web`.
