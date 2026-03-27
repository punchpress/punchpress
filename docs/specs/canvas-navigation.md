# Canvas Navigation

PunchPress keeps canvas navigation predictable and easy to control.

## Zoom

- Zooming should feel steady and precise on trackpads, mouse wheels, and pinch
  gestures.
- A single zoom update should be capped so large device deltas do not cause
  runaway acceleration.
- Zooming should focus on the pointer position so the content under the cursor
  stays under the cursor as the zoom changes.

## Pan

- Panning moves the viewport without changing the document.
- Viewport movement and zoom are session state and do not create history steps.
