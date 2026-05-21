---
summary: Explains text internals for font resolution, metrics, tracking, warp layout, hit regions, text paths, inline editing, and text property support.
read_when:
  - changing text metrics, warp engine, text path layout, font-dependent geometry, tracking, inline editor behavior, or text properties
  - debugging text geometry differences between edit mode, render mode, and export
---

# Text System

Text internals live in engine text modules plus the React text editor overlay.

## Engine Owns

- text defaults
- font-dependent metrics
- tracking
- straight text and warped layout
- text paths and hit regions
- text placement capabilities
- text property support

## React Owns

- browser text input surface
- caret and selection rendering
- DOM events for inline editing

Durable text behavior writes back to the text node.
