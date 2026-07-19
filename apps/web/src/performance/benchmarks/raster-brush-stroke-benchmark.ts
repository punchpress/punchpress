import { incrementPerfCounter } from "@punchpress/engine";
import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";

const TILE_SIZE = 512;
const SETTLE_FRAMES = 24;

interface RasterBrushStrokeConfig {
  brushSize: number;
  description: string;
  frames: number;
  id: string;
  label: string;
  strokeCount: number;
  tileColumns: number;
  tileRows: number;
  viewport: { x: number; y: number; zoom: number };
}

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

const createLargeRasterDocument = (config: RasterBrushStrokeConfig) => {
  const src = getTileSourceDataUrl();
  const rasterWidth = config.tileColumns * TILE_SIZE;
  const rasterHeight = config.tileRows * TILE_SIZE;
  const tileSources: Record<string, number | string>[] = [];

  for (let row = 0; row < config.tileRows; row += 1) {
    for (let col = 0; col < config.tileColumns; col += 1) {
      tileSources.push({
        col,
        height: TILE_SIZE,
        ref: `assets/raster/${config.id}/tile-${col}-${row}.png`,
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
        assetId: `asset-${config.id}`,
        baseHeight: rasterHeight,
        baseWidth: rasterWidth,
        baseX: 0,
        baseY: 0,
        height: rasterHeight,
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
        width: rasterWidth,
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

const createRasterBrushStrokeBenchmark = (
  config: RasterBrushStrokeConfig
): PerformanceBenchmarkDefinition => ({
  defaultOptions: {
    frames: config.frames,
    nodeCount: config.strokeCount,
    warmupFrames: 12,
  },
  description: config.description,
  id: config.id,
  label: config.label,
  setup: async ({ editor, waitForFrames }) => {
    editor.loadDocument(createLargeRasterDocument(config));
    editor.select("raster-brush-stroke");
    editor.setActiveTool("brush");
    editor.setBrushSettings({
      color: "#bb2233",
      hardness: 1,
      opacity: 1,
      size: config.brushSize,
      spacing: 0,
    });
    editor.viewerRef?.setTo?.(config.viewport);
    editor.setViewport(config.viewport);
    editor.onViewportChange?.();
    await waitForFrames(12);
  },
  run: async ({ editor, options, waitForFrame, waitForFrames }) => {
    const brush = editor.tools.get("brush");
    const node = editor.getNode("raster-brush-stroke");

    if (!(brush && node)) {
      throw new Error("Expected brush tool and raster node");
    }

    const rasterWidth = config.tileColumns * TILE_SIZE;
    const rasterHeight = config.tileRows * TILE_SIZE;
    const strokeCount = Math.max(1, options.nodeCount || config.strokeCount);
    const pointsPerStroke = Math.max(
      8,
      Math.floor(options.frames / strokeCount) - SETTLE_FRAMES
    );

    recordStrokeStats(editor, "before");

    for (let strokeIndex = 0; strokeIndex < strokeCount; strokeIndex += 1) {
      const angle = (strokeIndex / strokeCount) * Math.PI;
      const centerX = rasterWidth / 2;
      const centerY = rasterHeight / 2;
      const reachX = rasterWidth * 0.42;
      const reachY = rasterHeight * 0.42;
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
});

export const rasterBrushStrokeBenchmark = createRasterBrushStrokeBenchmark({
  brushSize: 96,
  description:
    "Paints repeated zoomed-out sweep strokes across a 20480x20480 tiled raster layer and measures stroke, commit, and settle frames. nodeCount is the stroke count.",
  frames: 192,
  id: "raster-brush-stroke",
  label: "Raster Brush Stroke",
  strokeCount: 6,
  tileColumns: 40,
  tileRows: 40,
  viewport: { x: 1200, y: 1400, zoom: 0.055 },
});

const FIRST_CONTACT_WIDTH = 12_400;
const FIRST_CONTACT_HEIGHT = 10_800;

const createOpaqueBaseDocument = () => {
  const canvas = document.createElement("canvas");

  canvas.width = FIRST_CONTACT_WIDTH;
  canvas.height = FIRST_CONTACT_HEIGHT;

  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createLinearGradient(
      0,
      0,
      FIRST_CONTACT_WIDTH,
      FIRST_CONTACT_HEIGHT
    );

    gradient.addColorStop(0, "#3355aa");
    gradient.addColorStop(0.5, "#dd8844");
    gradient.addColorStop(1, "#227755");
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIRST_CONTACT_WIDTH, FIRST_CONTACT_HEIGHT);
  }

  return JSON.stringify({
    nodes: [
      {
        height: FIRST_CONTACT_HEIGHT,
        id: "raster-first-contact",
        mimeType: "image/png",
        name: "Opaque Base",
        opacity: 1,
        parentId: "root",
        src: canvas.toDataURL("image/png"),
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "image",
        visible: true,
        width: FIRST_CONTACT_WIDTH,
      },
    ],
    version: "1.8",
  });
};

/**
 * First-contact cost on a large imported photo: the very first stroke on a
 * cold (never-hydrated) opaque base. Lazy hydration must keep the stroke and
 * its commit responsive — the merge hydrates only the tiles it touches while
 * the rest of the base streams in the background, and the migration commit's
 * full hydration plus encode run in budgeted chunks. Watch max frame.
 */
export const rasterBrushFirstContactBenchmark: PerformanceBenchmarkDefinition =
  {
    defaultOptions: {
      frames: 120,
      nodeCount: 1,
      warmupFrames: 12,
    },
    description:
      "Paints the first stroke on a cold 12400x10800 opaque base image and measures first-contact hydration, merge, and migration-commit frames.",
    id: "raster-brush-first-contact",
    label: "Raster Brush First Contact",
    setup: async ({ editor, waitForFrames }) => {
      editor.loadDocument(createOpaqueBaseDocument());
      editor.select("raster-first-contact");
      editor.setActiveTool("brush");
      editor.setBrushSettings({
        color: "#bb2233",
        hardness: 1,
        opacity: 1,
        size: 300,
        spacing: 0,
      });

      const viewport = { x: 1000, y: 1200, zoom: 0.08 };

      editor.viewerRef?.setTo?.(viewport);
      editor.setViewport(viewport);
      editor.onViewportChange?.();
      await waitForFrames(12);
    },
    run: async ({ editor, options, waitForFrame, waitForFrames }) => {
      const brush = editor.tools.get("brush");
      const node = editor.getNode("raster-first-contact");

      if (!(brush && node)) {
        throw new Error("Expected brush tool and raster node");
      }

      const pointsPerStroke = Math.max(
        8,
        (options.frames || 120) - SETTLE_FRAMES
      );
      const pointAt = (progress: number) => ({
        x: FIRST_CONTACT_WIDTH * (0.1 + progress * 0.8),
        y: FIRST_CONTACT_HEIGHT * (0.3 + progress * 0.4),
      });
      const session = brush.beginStroke({ node, point: pointAt(0) });

      if (!session) {
        throw new Error("Expected brush stroke session");
      }

      for (let step = 1; step < pointsPerStroke; step += 1) {
        await waitForFrame();
        session.update({ point: pointAt(step / (pointsPerStroke - 1)) });
      }

      const commitReady = session.complete({ point: pointAt(1) });

      await waitForFrames(SETTLE_FRAMES);
      await commitReady;
    },
    usesScratchDocument: true,
  };

export const rasterBrushStrokeHugeBenchmark = createRasterBrushStrokeBenchmark({
  brushSize: 1500,
  description:
    "Paints sweep strokes with a 1500px brush across a 38400x25088 tiled raster layer while zoomed far out. nodeCount is the stroke count.",
  frames: 192,
  id: "raster-brush-stroke-huge",
  label: "Raster Brush Stroke (Huge Layer)",
  strokeCount: 4,
  tileColumns: 75,
  tileRows: 49,
  viewport: { x: 2500, y: 3000, zoom: 0.04 },
});
