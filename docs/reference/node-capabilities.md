---
summary: Defines the node capability seam for per-type geometry, frames, hit bounds, edit capabilities, editable path sessions, and extension rules.
read_when:
  - adding a node type or changing `packages/engine/src/nodes/node-capabilities.ts`
  - debugging render, selection, transform, hit, export, or edit behavior that diverges by node type
  - deciding whether a canvas special case should become a node capability
---

# Node Capabilities

Node capabilities are the shared extension seam for canvas behavior.

## Registered Types

- `artboard`
- `group`
- `path`
- `shape`
- `text`
- `vector`

## Capability Responsibilities

| Capability | Meaning |
| --- | --- |
| `buildGeometry` | Build durable render geometry from node data and font state. |
| `getGeometrySignature` | Detect whether cached geometry is stale. |
| `getFrame` | Return render, selection, transform, or other surface frames. |
| `getFrameFromGeometry` | Build a surface frame from already-built geometry. |
| `getSurfaceGeometry` | Return current geometry for a node surface. |
| `getLocalBounds` | Return local bounds for a named surface. |
| `getHitBounds` | Return picking bounds when different from visual bounds. |
| `getEditCapabilities` | Tell UI which direct-edit affordances apply. |
| `getEditablePathSession` | Expose path-edit source for eligible nodes. |
| `canPersistPathEditing` | Whether path editing can persist across mode changes. |
| `getResizeMode` | Tell transform code whether a node resizes through bounds, scale transform, descendant geometry, or no resize. |

## Rules

- Add node behavior under `packages/engine/src/nodes/<type>/`.
- Extend the capability contract before adding canvas-wide type branches.
- Geometry is engine-owned and derived without reading the DOM.
- Transient interaction previews are not node geometry.
- Selection owns interaction scope; node capabilities own node-specific resize
  behavior.

## Resize Modes

| Mode | Meaning |
| --- | --- |
| `bounds` | Resize by changing node-owned bounds such as artboard or live-shape width and height. |
| `scale` | Resize by scaling the selected node from the transform anchor. |
| `children` | Resize by previewing the selected container and committing descendant geometry once. |
| `none` | Do not expose normal resize behavior. |
