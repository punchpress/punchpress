import { incrementPerfCounter } from "@punchpress/engine";
import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";

const TILE_SIZE = 512;
const TILE_COLUMNS = 40;
const TILE_ROWS = 40;
const RASTER_WIDTH = TILE_COLUMNS * TILE_SIZE;
const RASTER_HEIGHT = TILE_ROWS * TILE_SIZE;
const SETTLE_FRAMES = 24;

let tileSourceDataUrl: string | null = null;

const getTileSourceDataUrl = () => {
  if (tileSourceDataUrl) {
    return tileSourceDataUrl;
  }

  const canvas = document.createElement("canvas");

  canvas.width = 1;
  canvas.height = 1;

  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "#d8d8d8";
    context.fillRect(0, 0, 1, 1);
  }

  tileSourceDataUrl = canvas.toDataURL("image/png");
  return tileSourceDataUrl;
};

const createLargeRasterDocument = () => {
  const src = getTileSourceDataUrl();
  const tileSources: Record<string, number | string>[] = [];

  for (let row = 0; row < TILE_ROWS; row += 1) {
    for (let col = 0; col < TILE_COLUMNS; col += 1) {
      tileSources.push({
        col,
        height: TILE_SIZE,
        ref: `assets/raster/raster-brush-stroke/tile-${col}-${row}.png`,
        row,
        src,
        width: TILE_SIZE,
        x: col * TILE_SIZE,
        y: row * TILE_SIZE,
      });
    }
  }

  return JSON.stringify({
    nodes: [
      {
        assetId: "asset-raster-brush-stroke",
        baseHeight: RASTER_HEIGHT,
        baseWidth: RASTER_WIDTH,
        baseX: 0,
        baseY: 0,
        height: RASTER_HEIGHT,
        id: "raster-brush-stroke",
        mimeType: "image/png",
        name: "Large Raster",
        opacity: 1,
        parentId: "root",
        tileSources,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "image",
        visible: true,
        width: RASTER_WIDTH,
      },
    ],
    version: "1.8",
  });
};

const recordStrokeStats = (editor, phase) => {
  const node = editor.getNode("raster-brush-stroke");
  const totalTileCount =
    node?.type === "image" ? node.tileSources?.length || 0 : 0;
  const workingTileCount = document.querySelectorAll(
    '[data-testid="raster-working-tile"]'
  ).length;
  const mountedTileImages = document.querySelectorAll(
    "[data-raster-tile-ref]"
  ).length;

  incrementPerfCounter(`rasterStroke.${phase}.tileSources`, totalTileCount);
  incrementPerfCounter(`rasterStroke.${phase}.workingTiles`, workingTileCount);
  incrementPerfCounter(
    `rasterStroke.${phase}.mountedTileImages`,
    mountedTileImages
  );
};

export const rasterBrushStrokeBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 192,
    nodeCount: 6,
    warmupFrames: 12,
  },
  description:
    "Paints repeated zoomed-out sweep strokes across a 20480x20480 tiled raster layer and measures stroke, commit, and settle frames. nodeCount is the stroke count.",
  id: "raster-brush-stroke",
  label: "Raster Brush Stroke",
  setup: async ({ editor, waitForFrames }) => {
    editor.loadDocument(createLargeRasterDocument());
    editor.select("raster-brush-stroke");
    editor.setActiveTool("brush");
    editor.setBrushSettings({
      color: "#bb2233",
      hardness: 1,
      opacity: 1,
      size: 96,
      spacing: 0,
    });
    editor.viewerRef?.setTo?.({ x: 1200, y: 1400, zoom: 0.055 });
    editor.setViewport({ x: 1200, y: 1400, zoom: 0.055 });
    editor.onViewportChange?.();
    await waitForFrames(12);
  },
  run: async ({ editor, options, waitForFrame, waitForFrames }) => {
    const brush = editor.tools.get("brush");
    const node = editor.getNode("raster-brush-stroke");

    if (!(brush && node)) {
      throw new Error("Expected brush tool and raster node");
    }

    const strokeCount = Math.max(1, options.nodeCount || 6);
    const pointsPerStroke = Math.max(
      8,
      Math.floor(options.frames / strokeCount) - SETTLE_FRAMES
    );

    recordStrokeStats(editor, "before");

    for (let strokeIndex = 0; strokeIndex < strokeCount; strokeIndex += 1) {
      const angle = (strokeIndex / strokeCount) * Math.PI;
      const centerX = RASTER_WIDTH / 2;
      const centerY = RASTER_HEIGHT / 2;
      const reachX = RASTER_WIDTH * 0.42;
      const reachY = RASTER_HEIGHT * 0.42;
      const pointAt = (progress: number) => ({
        x: centerX + Math.cos(angle) * reachX * (progress * 2 - 1),
        y: centerY + Math.sin(angle) * reachY * (progress * 2 - 1),
      });

      const session = brush.beginStroke({ node, point: pointAt(0) });

      if (!session) {
        throw new Error("Expected brush stroke session");
      }

      for (let step = 1; step < pointsPerStroke; step += 1) {
        await waitForFrame();
        session.update({ point: pointAt(step / (pointsPerStroke - 1)) });
      }

      recordStrokeStats(editor, "active");

      const commitReady = session.complete({ point: pointAt(1) });

      await waitForFrames(SETTLE_FRAMES);
      await commitReady;
      recordStrokeStats(editor, `afterStroke${strokeIndex + 1}`);
    }

    recordStrokeStats(editor, "after");
  },
  usesScratchDocument: true,
};
