import type { Editor } from "@punchpress/engine";

// Camera trajectories and motion checks shared by viewport benchmarks.
// Benchmarks move the camera through `editor.moveViewportTo`; these checks
// prove the viewer and the stage actually moved, so a benchmark can never
// time a camera that stays put again.

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface ViewportHost {
  height: number;
  width: number;
}

interface WorldPoint {
  x: number;
  y: number;
}

// Read once per run after layout settles, so trajectories stay deterministic
// and the hot loop never forces layout.
export const captureViewportHost = (editor: Editor): ViewportHost => {
  const rect = editor.hostRef?.getBoundingClientRect();

  if (!(rect && rect.width > 0 && rect.height > 0)) {
    throw new Error("Viewport benchmark has no measured canvas host.");
  }

  return { height: rect.height, width: rect.width };
};

export const getCameraCenteredOn = (
  host: ViewportHost,
  center: WorldPoint,
  zoom: number
): Camera => {
  return {
    x: center.x - host.width / zoom / 2,
    y: center.y - host.height / zoom / 2,
    zoom,
  };
};

// Fixed-zoom translation: an ellipse with a constant screen-space radius, so
// every zoom pans the same number of pixels per frame.
export const getPanCamera = (
  host: ViewportHost,
  center: WorldPoint,
  zoom: number,
  {
    frames,
    index,
    radiusPx,
  }: { frames: number; index: number; radiusPx: WorldPoint }
): Camera => {
  const angle = (index / Math.max(1, frames)) * Math.PI * 2;
  const camera = getCameraCenteredOn(host, center, zoom);

  return {
    x: camera.x + (Math.sin(angle) * radiusPx.x) / zoom,
    y: camera.y + ((1 - Math.cos(angle)) * radiusPx.y) / zoom,
    zoom,
  };
};

// 0 → 1 → 0 across the run, landing exactly on 1 at the middle frame and on 0
// at both ends whatever the frame count, so a ladder reaches its extremes.
export const getPingPongProgress = (index: number, frames: number) => {
  const last = Math.max(1, frames - 1);
  const middle = Math.max(1, Math.floor(last / 2));

  if (index <= middle) {
    return index / middle;
  }

  return Math.max(0, (last - index) / Math.max(1, last - middle));
};

// Geometric interpolation through the ladder, so every stop gets equal time.
export const getLadderZoom = (ladder: number[], progress: number) => {
  const segments = ladder.length - 1;
  const position = Math.min(segments, Math.max(0, progress * segments));
  const index = Math.min(segments - 1, Math.floor(position));
  const local = position - index;
  const from = ladder[index];
  const to = ladder[index + 1];

  return from * (to / from) ** local;
};

// Moves the camera outside the timed loop and proves the viewer, the engine
// camera, and the projected stage all landed on it.
export const positionViewport = (editor: Editor, camera: Camera) => {
  editor.moveViewportTo(camera);
  assertViewportCamera(editor, camera);
};

// Replays sample frames of a trajectory inside a held interaction (the run's
// path), checks each, then returns to the start. Call from setup.
export const probeViewportTrajectory = (
  editor: Editor,
  getCamera: (index: number) => Camera,
  indices: number[]
) => {
  editor.setViewportInteracting(true);

  try {
    for (const index of indices) {
      const camera = getCamera(index);

      editor.moveViewportTo(camera);
      assertViewportCamera(editor, camera);
    }
  } finally {
    editor.setViewportInteracting(false);
  }

  positionViewport(editor, getCamera(0));
};

const assertViewportCamera = (editor: Editor, expected: Camera) => {
  const viewer = editor.viewerRef;
  const container = viewer?.getContainer?.();
  const stage = container?.querySelector('[data-testid="canvas-stage"]');

  if (!(viewer && container && stage)) {
    throw new Error("Viewport benchmark has no mounted viewer.");
  }

  const actual = {
    x: viewer.getScrollLeft(),
    y: viewer.getScrollTop(),
    zoom: viewer.getZoom(),
  };
  const tolerance = 1 / expected.zoom;

  if (
    Math.abs(actual.zoom - expected.zoom) > expected.zoom * 1e-6 ||
    Math.abs(actual.x - expected.x) > tolerance ||
    Math.abs(actual.y - expected.y) > tolerance
  ) {
    throw new Error(
      `Viewer camera ${JSON.stringify(actual)} missed ${JSON.stringify(expected)}.`
    );
  }

  const engine = editor.viewport;

  if (
    engine.zoom !== actual.zoom ||
    Math.abs(engine.x - actual.x) > tolerance ||
    Math.abs(engine.y - actual.y) > tolerance
  ) {
    throw new Error(
      `Engine camera ${JSON.stringify(engine)} disagrees with the viewer ${JSON.stringify(actual)}.`
    );
  }

  // The stage's top-left is the world origin; its screen position proves the
  // DOM transform moved, not just the viewer's bookkeeping.
  const containerRect = container.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const expectedLeft = containerRect.left - actual.x * actual.zoom;
  const expectedTop = containerRect.top - actual.y * actual.zoom;

  if (
    Math.abs(stageRect.left - expectedLeft) > 1.5 ||
    Math.abs(stageRect.top - expectedTop) > 1.5
  ) {
    throw new Error(
      `Stage projected at ${stageRect.left},${stageRect.top}; camera expects ${expectedLeft},${expectedTop}.`
    );
  }
};
