---
summary: Routes PunchPress internals docs for editor architecture, state, files, canvas systems, node contracts, editing systems, app shell, and performance.
read_when:
  - locating the owner of editor behavior before refactoring
  - deciding whether code belongs in engine, schema, React bindings, platform, or desktop shell
  - checking system boundaries before adding a new canvas, node, tool, or document capability
---

# Internals

Internals docs describe ownership and invariants. They explain where behavior
lives and what boundaries code must preserve.

| System | Doc |
| --- | --- |
| Overall architecture | [Architecture overview](architecture-overview.md) |
| Public editor command and inspection surface | [Editor facade](editor-facade.md) |
| React bridge to the editor | [React bindings](react-bindings.md) |
| Browser and Electron capability boundary | [Platform boundaries](platform-boundaries.md) |
| Zustand-backed editor state and history | [Store and history](store-and-history.md) |
| `.punch` load/save and file identity | [Document files](document-files.md) |
| Clipboard data ownership | [Clipboard data](clipboard-data.md) |
| Font discovery, loading, preview, and missing-font handling | [Font loading](font-loading.md) |
| Infinite canvas integration | [Infinite canvas](infinite-canvas.md) |
| Selection, hover, transform, text, and vector chrome | [Overlay system](overlays.md) |
| Selection state and transform sessions | [Selection and transform](selection-and-transform.md) |
| Cursor precedence and canvas cursor assets | [Cursor system](cursors.md) |
| Shared node capability seam | [Node contract](node-contract.md) |
| Per-node geometry and behavior modules | [Node engines](node-engines.md) |
| Geometry frames and coordinate ownership | [Geometry model](geometry-model.md) |
| SVG and raster export ownership | [Export pipeline](export-pipeline.md) |
| Tool state machines | [Tools](tools.md) |
| Paper-backed vector editing boundary | [Vector editor](vector-editor.md) |
| Raster image editing overlay, assets, buffers, and history | [Raster image editor](raster-image-editor.md) |
| Raster brush tiled preview, commit, and reference findings | [Raster brush runtime](raster-brush-runtime.md) |
| Dense SVG and vector render performance plan | [Vector render performance plan](vector-render-performance-plan.md) |
| Raster tile store migration stages | [Raster engine plan](raster-engine-plan.md) |
| Text metrics, editing, warps, and font use | [Text system](text-system.md) |
| Shape creation and shape-to-path behavior | [Shape system](shape-system.md) |
| Panels, dialogs, context menus, and commands | [Panels and commands](panels-and-commands.md) |
| Workspace tab lifecycle | [Workspace tabs](workspace-tabs.md) |
| Electron shell, native menus, updater, and local files | [Desktop shell](desktop-shell.md) |
| Live frame capture, benchmarks, and slow-frame diagnostics | [Performance](performance.md) |
