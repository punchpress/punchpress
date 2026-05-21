---
summary: Defines PunchPress canvas, viewport, screen, node-local, path-local, and SVG export coordinate spaces.
read_when:
  - changing pointer-to-canvas conversion, zoom math, overlay placement, path editing, SVG import, or export transforms
  - debugging geometry that is correct at one zoom level but wrong after pan, rotate, resize, or import
---

# Coordinate Spaces

Coordinate spaces must stay explicit.

| Space | Meaning |
| --- | --- |
| Screen/client | Browser pointer coordinates. |
| Viewport | Scrolled and zoomed view through the infinite canvas. |
| Canvas/world | Document workspace coordinates. |
| Node local | Coordinates before a node transform is applied. |
| Path local | Contour and segment coordinates inside a path node. |
| SVG output | Export or import coordinate system after normalization. |

## Rules

- Pointer events convert from client to canvas before reaching engine behavior.
- Zoom-sensitive values must declare whether they are screen-space or
  canvas-space.
- Screen-sized handles stay screen-sized across zoom.
- Durable node data stores document meaning, not viewport placement.
