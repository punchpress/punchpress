---
summary: PunchPress docs map for product behavior, internals, reference contracts, operations, and decisions.
read_when:
  - joining PunchPress development
  - choosing which docs to read before changing editor behavior
  - changing product behavior, editor systems, document schema, operations, or architecture decisions
---

# PunchPress Docs

PunchPress is an AI-native design editor for Print on Demand artwork. Users work
on an infinite canvas, build editable `.punch` documents from live nodes, refine
text and vector geometry, then export print-ready assets.

These docs are the agent-facing operating model for the workspace. They state
the product contract, the owning code system, and the invariants to preserve.
They document behavior, boundaries, precedence, data formats, and workflows that
are hard to recover from code search alone.

## Start here

| Task | Read |
| --- | --- |
| Understand product behavior | [Product docs](product/README.md) |
| Understand editor architecture | [Architecture overview](internals/architecture-overview.md) |
| Change the saved document format | [Punch format](reference/punch-format.md) |
| Change editor tests | [Testing](operations/testing.md) |
| Change UI primitives or styling | [Design system](design/system.md) |
| Ship a desktop release | [Releases](operations/releases.md) |

## Product

| Category | Docs |
| --- | --- |
| Workspace | [Workspace](product/workspace.md), [Infinite canvas](product/infinite-canvas.md), [Artboards](product/artboards.md), [Workspace tabs](product/workspace-tabs.md) |
| Panels | [Layers](product/layers.md), [Properties](product/properties.md), [Document commands](product/document-commands.md) |
| Selection and editing | [Selection](product/selection.md), [Transform](product/transform.md), [Groups](product/groups.md), [Clipboard](product/clipboard.md), [History](product/history.md) |
| Tools | [Tools](product/tools.md), [Hand tool](product/hand-tool.md), [Pointer tool](product/pointer-tool.md), [Node tool](product/node-tool.md), [Pen tool](product/pen-tool.md), [Text tool](product/text-tool.md), [Shape tool](product/shape-tool.md) |
| Text | [Text](product/text.md), [Text editing](product/text-editing.md), [Fonts](product/fonts.md), [Text warping](product/text-warping.md) |
| Vector | [Vector editing](product/vector-editing.md), [Path editing](product/path-editing.md), [Corner controls](product/corner-controls.md), [Compound paths](product/compound-paths.md), [Boolean operations](product/boolean-operations.md), [SVG import](product/svg-import.md) |
| Nodes | [Nodes](product/nodes.md), [Artboard nodes](product/artboard-nodes.md), [Text nodes](product/text-nodes.md), [Shape nodes](product/shape-nodes.md), [Vector nodes](product/vector-nodes.md), [Path nodes](product/path-nodes.md) |
| Files and platform | [Documents](product/documents.md), [Scratchpad](product/scratchpad.md), [Desktop app](product/desktop.md), [Recent documents](product/recent-documents.md), [Local fonts](product/local-fonts.md) |
| Performance | [Performance](product/performance.md), [Performance HUD](product/performance-hud.md), [Benchmarks](product/benchmarks.md) |

## Internals

| System | Doc |
| --- | --- |
| Architecture | [Architecture overview](internals/architecture-overview.md), [Editor facade](internals/editor-facade.md), [React bindings](internals/react-bindings.md), [Platform boundaries](internals/platform-boundaries.md) |
| State and files | [Store and history](internals/store-and-history.md), [Document files](internals/document-files.md), [Clipboard data](internals/clipboard-data.md), [Font loading](internals/font-loading.md) |
| Canvas systems | [Infinite canvas](internals/infinite-canvas.md), [Overlay system](internals/overlays.md), [Selection and transform](internals/selection-and-transform.md), [Cursor system](internals/cursors.md) |
| Node systems | [Node contract](internals/node-contract.md), [Node engines](internals/node-engines.md), [Geometry model](internals/geometry-model.md), [Export pipeline](internals/export-pipeline.md) |
| Editing systems | [Tools](internals/tools.md), [Vector editor](internals/vector-editor.md), [Text system](internals/text-system.md), [Shape system](internals/shape-system.md) |
| App systems | [Panels and commands](internals/panels-and-commands.md), [Workspace tabs](internals/workspace-tabs.md), [Desktop shell](internals/desktop-shell.md), [Performance](internals/performance.md) |

## Reference

Reference docs capture exact contracts and precedence rules that are hard to
infer safely from one file.

| Contract | Doc |
| --- | --- |
| File format | [Punch format](reference/punch-format.md), [Schema migration](reference/schema-migration.md) |
| Editor API | [Editor API](reference/editor-api.md), [Node capabilities](reference/node-capabilities.md), [Tool events](reference/tool-events.md) |
| Geometry | [Geometry frames](reference/geometry-frames.md), [Coordinate spaces](reference/coordinate-spaces.md), [Canvas cursors](reference/canvas-cursors.md) |
| Keyboard and commands | [Keyboard shortcuts](reference/keyboard-shortcuts.md), [Document commands](reference/document-commands.md), [Desktop menu commands](reference/desktop-menu-commands.md) |
| Export and import | [SVG import](reference/svg-import.md), [SVG export](reference/svg-export.md), [Clipboard formats](reference/clipboard-formats.md) |

## Operations

| Workflow | Read |
| --- | --- |
| Development | [Development](operations/development.md) |
| Testing | [Testing](operations/testing.md), [Editor contract](operations/editor-contract.md), [Playwright](operations/playwright.md) |
| Performance tests and traces | [Performance](operations/performance.md) |
| Releases | [Releases](operations/releases.md), [Desktop releases](operations/desktop-releases.md), [Version bumps](operations/version-bumps.md) |
| Documentation | [Docs policy](docs-policy.md) |

## Decisions

Architecture decisions explain durable tradeoffs and rejected alternatives.
Keep planning notes out of this section.

| Area | Decisions |
| --- | --- |
| Canvas interaction | [Canvas cursor behavior](decisions/canvas-cursor-behavior.md), [Transform interaction model](decisions/transform-interaction-model.md), [Interaction ownership boundary](decisions/interaction-ownership-boundary.md) |
| Rendering | [Node render contract](decisions/node-render-contract.md), [Interaction render hot path](decisions/interaction-render-hot-path.md), [Vector render surface pipeline](decisions/vector-render-surface-pipeline.md) |
| Groups and vectors | [Group rotation overlay](decisions/group-rotation-overlay.md) |

Every Markdown file under `docs/` should carry `summary` and `read_when`
frontmatter so `bun run docs:list` can route agents before they code.
