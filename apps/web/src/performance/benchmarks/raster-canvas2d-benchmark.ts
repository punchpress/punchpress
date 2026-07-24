import { incrementPerfCounter, PERF_COUNTERS } from "@punchpress/engine";
import type {
  PerformanceBenchmarkContext,
  PerformanceBenchmarkDefinition,
} from "../performance-benchmark-types";

const TARGET_ID = "raster-canvas2d-benchmark";
const TARGET_WIDTH = 4500;
const TARGET_HEIGHT = 5400;

export const rasterCanvas2dBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 60,
    nodeCount: 1,
    stepX: 0,
    stepY: 0,
    warmupFrames: 8,
  },
  description:
    "Paints a resident 4500×5400 Raster at pixel zoom, typical zoom, and extreme zoom-out, then runs a large Eraser stroke.",
  id: "raster-canvas2d-strokes",
  label: "Raster Canvas2D Strokes",
  setup: async ({ editor, waitForFrames }) => {
    const src = createOpaquePixelSource();

    editor.loadDocument(createBenchmarkDocument(src));
    await editor.rasterSurface.ensureSurface({
      height: TARGET_HEIGHT,
      id: TARGET_ID,
      src,
      width: TARGET_WIDTH,
    });
    editor.select(TARGET_ID);
    await waitForFrames(2);
  },
  run: async (context) => {
    await runCase(context, {
      counter: PERF_COUNTERS.rasterBenchmarkPixelZoom,
      end: { x: 80, y: 80 },
      operation: "brush",
      size: 1,
      start: { x: 20, y: 20 },
      zoom: 16,
    });
    await runCase(context, {
      counter: PERF_COUNTERS.rasterBenchmarkCommonHardRound,
      end: { x: 1200, y: 900 },
      operation: "brush",
      size: 24,
      start: { x: 300, y: 300 },
      zoom: 1,
    });
    await runCase(context, {
      counter: PERF_COUNTERS.rasterBenchmarkLargeEraser,
      end: { x: 1800, y: 1800 },
      operation: "eraser",
      size: 500,
      start: { x: 600, y: 900 },
      zoom: 1,
    });
    await runCase(context, {
      counter: PERF_COUNTERS.rasterBenchmarkExtremeZoomOut,
      end: { x: TARGET_WIDTH - 12, y: TARGET_HEIGHT - 12 },
      operation: "brush",
      size: 24,
      start: { x: 12, y: 12 },
      zoom: 0.04,
    });
  },
  usesScratchDocument: true,
};

export const rasterCanvas2dExtremeDiagonalBenchmark: PerformanceBenchmarkDefinition =
  {
    defaultOptions: {
      frames: 60,
      nodeCount: 1,
      stepX: 0,
      stepY: 0,
      warmupFrames: 8,
    },
    description:
      "Paints a full-target diagonal across a resident 4500×5400 Raster at 4% zoom for trace capture.",
    id: "raster-canvas2d-extreme-diagonal",
    label: "Raster Canvas2D Extreme Diagonal",
    setup: async ({ editor, waitForFrames }) => {
      const src = createOpaquePixelSource();

      editor.loadDocument(createBenchmarkDocument(src));
      await editor.rasterSurface.ensureSurface({
        height: TARGET_HEIGHT,
        id: TARGET_ID,
        src,
        width: TARGET_WIDTH,
      });
      editor.select(TARGET_ID);
      await waitForFrames(2);
    },
    run: async (context) => {
      await runCase(context, {
        counter: PERF_COUNTERS.rasterBenchmarkExtremeZoomOut,
        end: { x: TARGET_WIDTH - 12, y: TARGET_HEIGHT - 12 },
        operation: "brush",
        size: 24,
        start: { x: 12, y: 12 },
        zoom: 0.04,
      });
    },
    usesScratchDocument: true,
  };

export const rasterHighZoomBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 60,
    nodeCount: 2,
    stepX: 0.125,
    stepY: 0.125,
    warmupFrames: 8,
  },
  description:
    "Pans a production 4500×5400 Frame and resident Raster at 12,800% with exact samples and its pixel grid visible.",
  id: "raster-high-zoom",
  label: "Raster High Zoom",
  setup: async ({ editor, waitForFrames }) => {
    const src = createOpaquePixelSource();

    editor.loadDocument(createHighZoomBenchmarkDocument(src));
    await editor.rasterSurface.ensureSurface({
      height: TARGET_HEIGHT,
      id: TARGET_ID,
      src,
      width: TARGET_WIDTH,
    });
    editor.select(TARGET_ID);
    setBenchmarkViewport(editor, {
      x: TARGET_WIDTH / 2,
      y: TARGET_HEIGHT / 2,
      zoom: 128,
    });
    await waitForFrames(8);
  },
  run: async ({ editor, options, waitForFrame, waitForFrames }) => {
    setBenchmarkViewport(editor, {
      x: TARGET_WIDTH / 2,
      y: TARGET_HEIGHT / 2,
      zoom: 128,
    });
    await waitForFrames(2);
    assertHighZoomPresentation(editor);
    editor.setViewportInteracting(true);

    try {
      for (let index = 0; index < options.frames; index += 1) {
        const progress = index / Math.max(1, options.frames - 1);
        const phase = progress * Math.PI * 2;

        setBenchmarkViewport(editor, {
          x: TARGET_WIDTH / 2 + Math.cos(phase) * options.stepX,
          y: TARGET_HEIGHT / 2 + Math.sin(phase) * options.stepY,
          zoom: 128,
        });
        await waitForFrame();
      }
    } finally {
      editor.setViewportInteracting(false);
    }

    assertHighZoomPresentation(editor);
  },
  usesScratchDocument: true,
};

const setBenchmarkViewport = (
  editor: PerformanceBenchmarkContext["editor"],
  viewport: { x: number; y: number; zoom: number }
) => {
  editor.viewerRef?.setTo?.(viewport);
  editor.setViewport(viewport);
  editor.getState().setViewport(viewport);
  editor.onViewportChange?.();
};

const assertHighZoomPresentation = (
  editor: PerformanceBenchmarkContext["editor"]
) => {
  const grid = document.querySelector('[data-pixel-grid-kind="frame"]');
  const raster = document.querySelector(
    `[data-node-id="${TARGET_ID}"] [data-raster-sampling="exact"]`
  );
  const preview = document.querySelector(
    `[data-node-id="${TARGET_ID}"] [data-raster-preview-active="true"]`
  );

  if (!(grid && raster && !preview)) {
    throw new Error(
      [
        "High-zoom Raster presentation was not exact and grid-aligned",
        `grid=${Boolean(grid)}`,
        `raster=${Boolean(raster)}`,
        `preview=${Boolean(preview)}`,
        `sampling=${document.querySelector(`[data-node-id="${TARGET_ID}"] [data-raster-sampling]`)?.getAttribute("data-raster-sampling") || "missing"}`,
        `editorZoom=${editor.zoom}`,
        `storeZoom=${editor.getState().viewport.zoom}`,
      ].join(" ")
    );
  }
};

const runCase = async (
  { editor, options, waitForFrame, waitForFrames }: PerformanceBenchmarkContext,
  {
    counter,
    end,
    operation,
    size,
    start,
    zoom,
  }: {
    counter: string;
    end: { x: number; y: number };
    operation: "brush" | "eraser";
    size: number;
    start: { x: number; y: number };
    zoom: number;
  }
) => {
  editor.setViewport({ x: 0, y: 0, zoom });
  editor.onViewportChange?.();
  editor.setActiveTool(operation);
  editor.setBrushSettings(
    {
      hardness: 1,
      opacity: 1,
      size,
      spacing: 0,
    },
    operation
  );
  await waitForFrames(2);

  const node = editor.getNode(TARGET_ID);
  const session = editor.currentTool.onNodePointerDown({
    node,
    point: start,
  });

  if (!session) {
    throw new Error(`Unable to start ${operation} Canvas2D Raster benchmark`);
  }

  incrementPerfCounter(counter);

  for (let index = 1; index <= options.frames; index += 1) {
    await waitForFrame();
    const progress = index / options.frames;

    session.update({
      point: {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      },
    });
  }

  await session.complete({ point: end });
  await waitForFrames(2);
};

const createOpaquePixelSource = () => {
  const canvas = document.createElement("canvas");

  canvas.width = 1;
  canvas.height = 1;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas2D is unavailable for the Raster benchmark fixture");
  }

  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, 1, 1);
  return canvas.toDataURL("image/png");
};

const createBenchmarkDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-raster-canvas2d-benchmark",
        height: TARGET_HEIGHT,
        id: TARGET_ID,
        mimeType: "image/png",
        name: "Raster Canvas2D Benchmark",
        opacity: 1,
        parentId: "root",
        src,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "image",
        visible: true,
        width: TARGET_WIDTH,
      },
    ],
    version: "1.8",
  });

const createHighZoomBenchmarkDocument = (src: string) =>
  JSON.stringify({
    nodes: [
      {
        background: "#ffffff",
        height: TARGET_HEIGHT,
        id: "raster-high-zoom-frame",
        locked: false,
        name: "Raster High Zoom Frame",
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
        width: TARGET_WIDTH,
      },
      {
        assetId: "asset-raster-high-zoom",
        height: TARGET_HEIGHT,
        id: TARGET_ID,
        mimeType: "image/png",
        name: "Raster High Zoom",
        opacity: 1,
        parentId: "raster-high-zoom-frame",
        src,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "image",
        visible: true,
        width: TARGET_WIDTH,
      },
    ],
    version: "1.8",
  });
