# Canvas Navigation

PunchPress keeps canvas navigation predictable and easy to control.

## Zoom

- At 100% zoom, one canvas world unit maps to one device pixel.
- Zoom should stay numerically honest; fitting a large object may produce a low
  zoom percentage rather than redefining what 100% means.
- Zooming should feel steady and precise on trackpads, mouse wheels, and pinch
  gestures.
- A single zoom update should be capped so large device deltas do not cause
  runaway acceleration.
- Zooming should focus on the pointer position so the content under the cursor
  stays under the cursor as the zoom changes.
- When the canvas has no established content and the user adds the first object,
  PunchPress may zoom to fit that object with comfortable surrounding space.
- Once the user has established content on the canvas, adding another object
  should not move or zoom the viewport automatically.
- Users should be able to fit the selected object or artboard on demand.

## Pan

- Panning moves the viewport without changing the document.
- Viewport movement and zoom are session state and do not create history steps.
