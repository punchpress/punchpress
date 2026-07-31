---
summary: Groups the public Editor facade by document, node, selection, path, tool, viewport, font, clipboard, history, and inspection responsibilities.
read_when:
  - adding, renaming, or removing methods on `packages/engine/src/editor.ts`
  - deciding whether React, tests, or automation should call an existing editor command
  - debugging duplicated behavior across UI entry points that should share the Editor facade
---

# Editor API

`Editor` is the product command and inspection facade. React, tests, automation,
and future clients should converge here instead of inventing parallel behavior.

## Responsibility Groups

| Group | Examples |
| --- | --- |
| Document | `newDocument`, `loadDocument`, `serializeDocument`, `exportDocument`, `markDocumentSaved`. |
| Nodes | `addTextNode`, `addShapeNode`, `addArtboardNode`, `insertNodes`, `updateNode`, `deleteSelected`, `duplicate`, `groupSelected`, `ungroup`. |
| Active layer and selection | `activeLayerId`, `activeLayer`, `select`, `setSelectedNodes`, `toggleSelection`, `clearSelection`, `ensureSelected`, `isSelected`. |
| Layering | `bringToFront`, `sendToBack`, `setNodeOrder`, `moveNodeToParent`, `toggleVisibility`. |
| Editing modes | `setActiveTool`, `startEditing`, `commitEditing`, `cancelEditing`, `startPathEditing`, `stopPathEditing`. |
| Vector/path | point movement, point deletion, topology operations, curve merge/separate/join, compound paths, boolean operations. |
| Transform | move, resize, rotate, selection drag, text path positioning. |
| Viewport | zoom, wheel zoom, focus canvas bounds, pending focus. |
| Fonts | initialize/request local fonts, preload fonts, set last used font. |
| Clipboard | `copySelection`, `pasteClipboardContent`, `pasteText`. |
| History | undo, redo, commit history step, dirty/saved marks. |
| Inspection | debug dump, selection properties, overlay state, node geometry, layer rows. |
| Raster host | Constructor-injected `RasterSurfaceResolver` for finite browser or headless Raster targets. |
| Raster editing | `getRasterTargetState`, `startCrop`, `updateCrop`, `commitCrop`, `cancelCrop`, `getRasterCropPreviewNode`. |
| Raster presentation | `getRasterWorkingPresentations`, `getRasterWorkingPresentation`, `acknowledgeRasterPresentation`, `failRasterPresentation`. |

## Rules

- Public methods should be operation-first and product-shaped.
- UI entry points representing the same action should call the same editor
  method or session model.
- Keep DOM, pointer capture, native dialogs, and platform-specific file handles
  outside the engine facade.
- Browser Raster canvas allocation, decode, and presentation stay behind the
  injected surface resolver; the engine sees only finite Raster contracts.
- `acknowledgeRasterPresentation({ nodeId, groupId, commitId })` retires the
  exact awaiting group. A full-node authority also retires its superseded
  sequence prefix. Stale, duplicate, wrong-node, wrong-group, and wrong-commit
  acknowledgements do nothing.
- `failRasterPresentation({ nodeId, groupId, commitId, reason })` marks only
  the exact handoff failed. It does not undo accepted durable history.
