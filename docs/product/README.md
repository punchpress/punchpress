---
summary: Routes PunchPress product behavior docs for workspace, panels, tools, text, vector editing, nodes, files, platform, and performance.
read_when:
  - looking for the user-facing contract behind an editor behavior change
  - deciding which product page owns a canvas, panel, tool, text, vector, node, document, or desktop behavior
---

# Product Docs

Product docs state what PunchPress does. They describe user-facing behavior,
edge cases, and intentional omissions without becoming source tours.

## Workspace

| Behavior | Doc |
| --- | --- |
| Overall editor workspace | [Workspace](workspace.md) |
| Cmd+K workspace action menu | [Command menu](command-menu.md) |
| External asset search and active-canvas import | [Assets](assets.md) |
| Canvas pan, zoom, coordinates, grid, and viewport focus | [Infinite canvas](infinite-canvas.md) |
| Production surfaces and export boundaries | [Artboards](artboards.md) |
| Scratchpad and file-backed tabs | [Workspace tabs](workspace-tabs.md) |

## Panels

| Behavior | Doc |
| --- | --- |
| Document tree, ordering, visibility, grouping, and recent documents | [Layers](layers.md) |
| Selection-specific editing controls | [Properties](properties.md) |
| Open, save, export, new file, close, and modal-safe commands | [Document commands](document-commands.md) |

## Selection And Editing

| Behavior | Doc |
| --- | --- |
| Click selection, marquee selection, hover, and focused groups | [Selection](selection.md) |
| Move, resize, rotate, drag preview, and transform chrome | [Transform](transform.md) |
| Group containers, drill-in, ungroup, and child movement | [Groups](groups.md) |
| Copy, paste, duplication, and external payload interpretation | [Clipboard](clipboard.md) |
| Undo, redo, no-op changes, and gesture history boundaries | [History](history.md) |

## Tools

| Behavior | Doc |
| --- | --- |
| Tool model and shared cursor expectations | [Tools](tools.md) |
| Temporary and explicit pan mode | [Hand tool](hand-tool.md) |
| Object selection and whole-node interaction | [Pointer tool](pointer-tool.md) |
| Direct vector/path selection | [Node tool](node-tool.md) |
| Vector path authoring and point insertion | [Pen tool](pen-tool.md) |
| Text placement and inline text editing | [Text tool](text-tool.md) |
| Polygon, ellipse, and star creation | [Shape tool](shape-tool.md) |

## Text

| Behavior | Doc |
| --- | --- |
| Text as editable design content | [Text](text.md) |
| Inline text editing behavior | [Text editing](text-editing.md) |
| Local fonts, fallback, missing fonts, and font previews | [Fonts](fonts.md) |
| Arch, wave, slant, circle, and path-positioned text | [Text warping](text-warping.md) |

## Vector

| Behavior | Doc |
| --- | --- |
| Vector editing as a product area | [Vector editing](vector-editing.md) |
| Point, handle, segment, and topology editing | [Path editing](path-editing.md) |
| Rounded path and shape corner controls | [Corner controls](corner-controls.md) |
| Non-destructive vector compounds | [Compound paths](compound-paths.md) |
| Unite, subtract, intersect, and exclude | [Boolean operations](boolean-operations.md) |
| SVG import into editable nodes | [SVG import](svg-import.md) |

## Nodes

| Behavior | Doc |
| --- | --- |
| Shared node behavior | [Nodes](nodes.md) |
| Artboard nodes | [Artboard nodes](artboard-nodes.md) |
| Image nodes | [Image nodes](image-nodes.md) |
| Text nodes | [Text nodes](text-nodes.md) |
| Shape nodes | [Shape nodes](shape-nodes.md) |
| Vector nodes | [Vector nodes](vector-nodes.md) |
| Path nodes | [Path nodes](path-nodes.md) |

## Files And Platform

| Behavior | Doc |
| --- | --- |
| `.punch` open, save, and export flows | [Documents](documents.md) |
| Local autosaved scratchpad | [Scratchpad](scratchpad.md) |
| Electron shell behavior | [Desktop app](desktop.md) |
| Recent document surfaces | [Recent documents](recent-documents.md) |
| Local font access | [Local fonts](local-fonts.md) |

## Performance

| Behavior | Doc |
| --- | --- |
| Performance as a product constraint | [Performance](performance.md) |
| In-app live frame and benchmark HUD | [Performance HUD](performance-hud.md) |
| Repeatable benchmark scenarios | [Benchmarks](benchmarks.md) |
