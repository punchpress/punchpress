---
summary: Explains the PunchPress architecture layers from schema and engine through React bindings, canvas UI, platform adapters, and Electron shell.
read_when:
  - orienting before broad editor work
  - moving behavior between engine, schema, React, platform, or desktop shell
  - adding a feature that crosses document state, canvas rendering, panels, and file workflows
---

# Architecture Overview

PunchPress is a Bun workspace with one product engine and multiple clients.

## Layers

| Layer | Owner |
| --- | --- |
| Schema | `packages/punch-schema` owns `.punch` constants, schema, version checks, load, save, normalization, font descriptors, and clipboard types. |
| Engine | `packages/engine` owns `Editor`, document state, commands, nodes, tools, geometry, selection, history, viewport, export, and inspection. |
| React bindings | `apps/web/src/editor-react` provides editor context, subscriptions, configured editor creation, and clipboard events. |
| Web app | `apps/web/src/components`, `workspace`, `platform`, and `performance` render the editor and adapt browser capabilities. |
| Desktop shell | `apps/desktop/src-electron` owns Electron windows, native menus, local file IPC, local fonts, recent documents, and updates. |

## Rule

Durable behavior belongs in schema or engine when it can run headlessly. React
renders editor state and adapts browser events. Platform and desktop code expose
host capabilities without owning editor semantics.
