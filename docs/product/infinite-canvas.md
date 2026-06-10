---
summary: Defines PunchPress canvas navigation, coordinate honesty, zoom and pan behavior, placement scale, hit expectations, and first-add viewport focus.
read_when:
  - changing zoom, pan, viewport focus, canvas coordinates, fit behavior, or starter placement sizes
  - debugging hit targets or selection frames that disagree with rendered artwork
  - deciding whether a new object should move the viewport after insertion
---

# Infinite Canvas

PunchPress is an open workspace. World coordinates describe positions on the
canvas; artboards and imported raster assets are where pixel dimensions become
product meaning.

## Zoom

- At `100%`, one canvas world unit maps to one device pixel.
- Zoom remains numerically honest. Fit-to-view may produce a low zoom value; it
  does not redefine `100%`.
- Wheel, trackpad, and pinch zoom should feel steady.
- One zoom update is capped so large device deltas do not runaway.
- Zoom focuses on the pointer so content under the cursor stays under it.
- Users can fit selected content or an artboard on demand.

## Pan

- Panning moves the viewport without changing the document.
- Viewport position and zoom are session state, not history steps.
- Trackpad and wheel panning remain available over selected-object transform
  chrome and preserve the same viewport speed at every zoom level.
- Holding Space temporarily enters hand-pan behavior.

## Placement

- Imported or pasted artwork with intrinsic dimensions enters at those
  dimensions.
- Click-created primitives use ergonomic starter sizes for the current context.
- Drag-created primitives use the user's exact drag size.
- Starter dimensions are rounded to whole numbers.
- Creating the first substantial object on an empty canvas may fit it into view.
- Adding later objects does not automatically pan or zoom once the workspace is
  established.

## Geometry Expectations

- Rendering, selection bounds, hover previews, hit testing, transforms, and
  path-edit entry must agree on visible geometry.
- Hit testing respects transforms, visibility, layer order, focused groups, and
  active tool scope.
- Hit testing prefers the topmost visible editable artwork under the pointer.
- Filled artwork is hittable by fill. Stroked open artwork is hittable by
  visible stroke. Hollow artwork is hittable by edge unless a tool asks for
  inside hits.
