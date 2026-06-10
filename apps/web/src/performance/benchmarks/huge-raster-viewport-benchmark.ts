import { incrementPerfCounter } from "@punchpress/engine";
import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";

const TILE_SIZE = 512;
const TILE_COLUMNS = 100;
const TILE_ROWS = 100;
const RASTER_WIDTH = TILE_COLUMNS * TILE_SIZE;
const RASTER_HEIGHT = TILE_ROWS * TILE_SIZE;

interface BenchmarkRasterTileSource {
  col: number;
  height: number;
  ref: string;
  row: number;
  src: string;
  width: number;
  x: number;
  y: number;
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
    context.fillStyle = "#111111";
    context.fillRect(0, 0, 1, 1);
  }

  tileSourceDataUrl = canvas.toDataURL("image/png");
  return tileSourceDataUrl;
};

const createHugeRasterDocument = () => {
  const src = getTileSourceDataUrl();
  const tileSources: BenchmarkRasterTileSource[] = [];

  for (let row = 0; row < TILE_ROWS; row += 1) {
    for (let col = 0; col < TILE_COLUMNS; col += 1) {
      tileSources.push({
        col,
        height: TILE_SIZE,
        ref: `assets/raster/huge-raster-viewport/tile-${col}-${row}.png`,
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
        assetId: "asset-huge-raster-viewport",
        baseHeight: RASTER_HEIGHT,
        baseWidth: RASTER_WIDTH,
        baseX: 0,
        baseY: 0,
        height: RASTER_HEIGHT,
        id: "huge-raster-viewport",
        mimeType: "image/png",
        name: "Huge Raster",
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

const setBenchmarkViewport = (editor, viewport) => {
  editor.viewerRef?.setTo?.(viewport);
  editor.setViewport(viewport);
  editor.onViewportChange?.();
};

const recordHugeRasterStats = (editor, phase = null) => {
  const node = editor.getNode("huge-raster-viewport");
  const totalTileCount =
    node?.type === "image" ? node.tileSources?.length || 0 : 0;
  const rasterGroups = document.querySelectorAll(
    "[data-raster-total-tile-count]"
  );
  const rasterGroup =
    document.querySelector(
      '[data-node-id="huge-raster-viewport"] [data-raster-total-tile-count]'
    ) || rasterGroups[0];
  const mountedTileImages = document.querySelectorAll(
    "[data-raster-tile-ref]"
  ).length;
  const activePreviewCount = document.querySelectorAll(
    '[data-raster-preview-active="true"]'
  ).length;
  const readyPreviewCount = document.querySelectorAll(
    '[data-raster-preview-ready="true"]'
  ).length;
  const visibleTileCount = Number(
    rasterGroup?.getAttribute("data-raster-visible-tile-count") || 0
  );

  incrementPerfCounter("hugeRaster.totalTiles", totalTileCount);
  incrementPerfCounter("hugeRaster.rasterGroups", rasterGroups.length);
  incrementPerfCounter("hugeRaster.visibleTiles", visibleTileCount);
  incrementPerfCounter("hugeRaster.mountedTileImages", mountedTileImages);
  incrementPerfCounter("hugeRaster.activePreviews", activePreviewCount);
  incrementPerfCounter("hugeRaster.readyPreviews", readyPreviewCount);

  if (phase) {
    incrementPerfCounter(`hugeRaster.${phase}.visibleTiles`, visibleTileCount);
    incrementPerfCounter(
      `hugeRaster.${phase}.mountedTileImages`,
      mountedTileImages
    );
    incrementPerfCounter(
      `hugeRaster.${phase}.activePreviews`,
      activePreviewCount
    );
    incrementPerfCounter(
      `hugeRaster.${phase}.readyPreviews`,
      readyPreviewCount
    );
  }
};

export const hugeRasterViewportBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 160,
    nodeCount: 0,
    stepX: 150,
    stepY: 110,
    warmupFrames: 12,
  },
  description:
    "Loads a synthetic 51200x51200 tiled raster layer and changes viewport pan and zoom for a deterministic 160-frame pass.",
  id: "huge-raster-viewport",
  label: "Huge Raster Viewport",
  setup: async ({ editor, waitForFrames }) => {
    editor.loadDocument(createHugeRasterDocument());
    editor.setSelectedNodes(["huge-raster-viewport"]);
    setBenchmarkViewport(editor, { x: 5200, y: 4800, zoom: 0.08 });
    await waitForFrames(12);
  },
  run: async ({ editor, options, waitForFrame }) => {
    recordHugeRasterStats(editor, "settledBefore");

    editor.setViewportInteracting(true);

    try {
      for (let index = 0; index < options.frames; index += 1) {
        await waitForFrame();

        if (index === 1) {
          recordHugeRasterStats(editor, "active");
        }

        const progress = index / Math.max(1, options.frames - 1);
        const phase = progress * Math.PI * 2;
        const zoom = 0.08 - progress * 0.06;

        setBenchmarkViewport(editor, {
          x: 5200 + Math.cos(phase) * options.stepX * 28,
          y: 4800 + Math.sin(phase * 1.2) * options.stepY * 24,
          zoom,
        });
      }
    } finally {
      editor.setViewportInteracting(false);
      await waitForFrame();
      recordHugeRasterStats(editor, "settledAfter");
    }
  },
  usesScratchDocument: true,
};
