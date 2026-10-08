---
summary: Explains the infinite canvas implementation boundary across react-infinite-viewer, viewport state, canvas coordinate conversion, grid rendering, stage bounds, and pointer dispatch.
read_when:
  - changing canvas pan, zoom, viewport focus, pointer-to-canvas conversion, dot grid, or stage sizing
  - debugging viewport drift, zoom math, canvas placement, or pointer targeting after pan and zoom
---

# Infinite Canvas

The web canvas integrates `react-infinite-viewer` with engine viewport state.

## Owners

- Engine owns camera policy: viewport state, clamping, zoom anchoring,
  pending focus, interaction state, and publication
  (`packages/engine/src/viewport/`).
- The canvas viewer adapter (`use-canvas-viewer.ts`) attaches
  react-infinite-viewer to the engine, reports native viewer scrolls as
  gestures, ends gestures after a short idle, and routes wheel pinch to the
  engine. It also prevents browser page zoom for pinch-wheel events inside
  the editor shell.
- Canvas components render artboards, nodes, overlays, text editor, toolbar,
  and grid, and convert client points through the live camera.

## Rules

- Convert client coordinates to canvas/world coordinates before engine
  dispatch, reading `editor.zoom` and the viewer at call time.
- Viewport pan and zoom are session state.
- Every camera change goes through `viewport-move.ts`. Programmatic moves,
  focus, discrete zoom, and wheel pinch call `applyViewport`, which moves the
  viewer (`scrollTo` when zoom is unchanged, nothing when the camera is
  identical), ignores the viewer's own scroll echoes, reads back the camera
  the viewer applied, and publishes it once. Native wheel pans and hand drags
  reach the engine through `syncViewportFromViewer`, which starts a gesture.
- The live camera (`editor.viewport`, `editor.zoom`) and the viewport
  presentation channel update on every change. The store's `viewport` only
  changes outside a viewport interaction; an interaction settles it once
  when it ends. An interaction is an explicit hold (`setViewportInteracting`,
  used by zoom scrubs and scripted motion) or a gesture
  (`setViewportGestureActive`, ended by the adapter's idle timer). Gesture
  idle never ends a hold; releasing a hold settles everything.
- Discrete zoom commands keep the viewport center fixed and publish
  immediately.
- Components that draw camera-dependent chrome (dot grid, artboard labels,
  raster sampling, pixel-grid gates, crop handles, selection overlays) read
  the live camera with `useEditorViewportValue`. Canvas itself does not
  subscribe to zoom; node art and durable placement never follow the camera.
- InfiniteViewer takes no controlled `zoom` prop: its React wrapper replays
  supplied props on every update, which would snap the camera back.
- `Editor.moveViewportTo` cancels pending focus. First-add focus may schedule
  viewport movement; ordinary later placement does not.
- Stage bounds are an interaction surface, not document size.

## Layers

- Idle shells translate in 2D and paint into their parent layer; only shells
  whose own art has active effects stay on `translate3d` layers. Plain
  200-node pinch runs at about 8.3 ms per frame (production, GPU raster).
- A transform preview promotes only its resolved presentation roots, once
  per gesture: a whole-group drag moves one presentation wrapper, so the
  promotion that made 2D shells expensive during the Phase 2d experiment
  (every moving shell over stationary 2D content) no longer occurs.
- Artboards clip with an `overflow: clip` box at their frame, which the
  compositor applies as a plain rect clip; shells carry no clips.
- `will-change: transform` on the stage freezes the raster scale of the
  80,000-unit stage and produced multi-second frames; do not promote it.
