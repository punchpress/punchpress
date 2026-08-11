---
summary: Defines PunchPress asset search for finding external artwork and adding SVG or raster artwork to the active canvas.
read_when:
  - changing asset search, external asset providers, asset import placement, or command menu asset entry points
  - debugging asset search results, asset download/import behavior, or which editor tab receives imported asset nodes
---

# Assets

Assets are external artwork that users can search from the PunchPress workspace
and add to the active canvas.

## Contract

- Assets are opened from the command menu.
- The command menu shows normal commands as rows; choosing Assets switches the
  menu to an asset search page.
- The asset page shows a search bar and a dense grid of rectangular asset previews.
- Asset results load more items with infinite scroll.
- Asset search requests SVG, PNG, and JPG-capable results from the provider.
- Each result resolves to one preferred format in order: SVG, then PNG, then JPG.
- The active workspace tab receives imported assets.
- Search calls external asset providers through the PunchPress assets API, not directly from the
  browser.
- Clicking an SVG-capable result downloads that SVG and imports it as
  editable PunchPress nodes at the active viewport center.
- Clicking a PNG or JPG result downloads that raster asset and imports it as an
  image node at the active viewport center.
- Dragging a PNG or JPG file from the OS onto the canvas imports it as an image
  node at the drop point.
- Asset provider credentials stay server-side.

## Placement

SVG assets use the same normalization path as local SVG imports. Raster assets
become image nodes at their browser-decoded natural pixel dimensions and
preserve their chosen source format until edited. The import target is the
active editor viewport center. A first import into an empty document may fit by
changing the camera; adding beside existing content does not replace the user's
current view.
