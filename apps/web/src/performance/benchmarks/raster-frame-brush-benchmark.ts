import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";

const FRAME_ID = "raster-frame-brush-frame";
const FRAME_WIDTH = 4500;
const FRAME_HEIGHT = 5400;

export const rasterFrameBrushBenchmark = createRasterFrameBrushBenchmark({
  description:
    "Draws one rapid default Hard Round stroke across an initially empty 4500×5400 Frame at 12% zoom.",
  id: "raster-frame-brush",
  label: "Raster Frame Brush",
});

export const rasterFrameBrushStablePlaneBenchmark =
  createRasterFrameBrushBenchmark({
    description:
      "Draws the same rapid Frame stroke after corner marks have expanded the Raster content bounds.",
    id: "raster-frame-brush-stable-plane",
    label: "Raster Frame Brush — Stable Plane",
    preExpand: true,
  });

function createRasterFrameBrushBenchmark({
  description,
  id,
  label,
  preExpand = false,
}: {
  description: string;
  id: string;
  label: string;
  preExpand?: boolean;
}): PerformanceBenchmarkDefinition {
  return {
    defaultOptions: {
      frames: 30,
      nodeCount: 1,
      stepX: 0,
      stepY: 0,
      warmupFrames: 8,
    },
    description,
    id,
    label,
    setup: async ({ editor, waitForFrames }) => {
      editor.loadDocument(createFrameDocument());
      editor.select(FRAME_ID);
      setViewport(editor);
      await waitForFrames(2);

      if (preExpand) {
        await preExpandFrameRaster(editor);
      }
    },
    run: async ({ editor, options, waitForFrame, waitForFrames }) => {
      setViewport(editor);
      editor.setActiveTool("brush");
      editor.setBrushSettings(
        {
          hardness: 1,
          opacity: 1,
          size: 24,
          smoothing: 0.1,
          spacing: 0,
        },
        "brush"
      );
      await waitForFrames(2);

      const frameElement = document.querySelector(
        `[data-artboard-body="${FRAME_ID}"]`
      );

      if (!(frameElement instanceof HTMLElement)) {
        throw new Error("Unable to find the Frame Brush benchmark target");
      }

      const rect = frameElement.getBoundingClientRect();
      const path = [
        { x: 0.5, y: 0.5 },
        { x: 0.08, y: 0.08 },
        { x: 0.92, y: 0.08 },
        { x: 0.92, y: 0.92 },
        { x: 0.08, y: 0.92 },
        { x: 0.5, y: 0.18 },
        { x: 0.82, y: 0.5 },
        { x: 0.5, y: 0.82 },
        { x: 0.18, y: 0.5 },
      ].map((point) => ({
        x: rect.left + rect.width * point.x,
        y: rect.top + rect.height * point.y,
      }));
      const pointerId = 1;

      dispatchPointerEvent(frameElement, "pointerdown", path[0], pointerId);

      try {
        for (let index = 1; index <= options.frames; index += 1) {
          dispatchPointerEvent(
            window,
            "pointermove",
            getPathPoint(path, index / options.frames),
            pointerId
          );
          await waitForFrame();
        }
      } finally {
        dispatchPointerEvent(window, "pointerup", path.at(-1), pointerId);
      }
      await waitForCommittedRaster(editor, waitForFrame);

      const raster = editor.nodes.find((node) => node.parentId === FRAME_ID);

      if (
        !(
          raster?.type === "image" &&
          editor.rasterSurface?.getPresentation?.(raster.id)
        )
      ) {
        throw new Error(
          "Frame Brush benchmark did not retain its Canvas surface"
        );
      }
    },
    usesScratchDocument: true,
  };
}

const preExpandFrameRaster = async (editor) => {
  editor.setActiveTool("brush");
  editor.setBrushSettings(
    {
      hardness: 1,
      opacity: 1,
      size: 24,
      smoothing: 0.1,
      spacing: 0,
    },
    "brush"
  );
  const frame = editor.getNode(FRAME_ID);
  const bounds = editor.getNodeRenderFrame(FRAME_ID)?.bounds;
  const brush = editor.tools.get("brush");

  if (!(frame?.type === "artboard" && bounds && brush)) {
    throw new Error("Unable to prepare the stable Frame Brush benchmark");
  }

  const points = [
    { x: 0.02, y: 0.02 },
    { x: 0.98, y: 0.02 },
    { x: 0.98, y: 0.98 },
    { x: 0.02, y: 0.98 },
  ].map((point) => ({
    x: bounds.minX + bounds.width * point.x,
    y: bounds.minY + bounds.height * point.y,
  }));
  const session = brush.beginStroke({ point: points[0] });

  if (!session) {
    throw new Error("Unable to start the stable Frame Brush setup stroke");
  }

  for (const point of points.slice(1)) {
    session.update({ point });
  }
  await session.complete({ point: points.at(-1) });
};

const waitForCommittedRaster = async (editor, waitForFrame) => {
  for (let frame = 0; frame < 120; frame += 1) {
    const raster = editor.nodes.find((node) => node.parentId === FRAME_ID);

    if (
      raster?.type === "image" &&
      editor.rasterSurface?.getPresentation?.(raster.id)
    ) {
      return;
    }

    await waitForFrame();
  }
};

const dispatchPointerEvent = (
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup",
  point: { x: number; y: number },
  pointerId: number
) => {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      pointerId,
      pointerType: "mouse",
    })
  );
};

const getPathPoint = (
  path: Array<{ x: number; y: number }>,
  progress: number
) => {
  const segmentProgress = progress * (path.length - 1);
  const segmentIndex = Math.min(path.length - 2, Math.floor(segmentProgress));
  const start = path[segmentIndex];
  const end = path[segmentIndex + 1];
  const localProgress = segmentProgress - segmentIndex;

  return {
    x: start.x + (end.x - start.x) * localProgress,
    y: start.y + (end.y - start.y) * localProgress,
  };
};

const setViewport = (editor) => {
  const viewport = {
    x: FRAME_WIDTH / 2,
    y: FRAME_HEIGHT / 2,
    zoom: 0.12,
  };

  editor.viewerRef?.setTo?.(viewport);
  editor.setViewport(viewport);
  editor.getState().setViewport(viewport);
  editor.onViewportChange?.();
};

const createFrameDocument = () =>
  JSON.stringify({
    nodes: [
      {
        background: "#ffffff",
        height: FRAME_HEIGHT,
        id: FRAME_ID,
        locked: false,
        name: "Raster Frame Brush",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "artboard",
        visible: true,
        width: FRAME_WIDTH,
      },
    ],
    version: "1.8",
  });
