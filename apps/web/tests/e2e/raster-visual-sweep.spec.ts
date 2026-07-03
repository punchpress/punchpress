import { expect, test } from "@playwright/test";
import {
  gotoEditor,
  loadDocument,
  serializeDocument,
  setViewport,
} from "./helpers/editor";

/**
 * Visual validation sweep for the raster compositor
 * (apps/web/src/components/canvas/raster/canvas-raster-store-surface.tsx).
 *
 * Reproduces two user-confirmed bugs on a large (~29184x25600) brushed layer:
 *
 * 1. SEAMS: thin background-colored division lines at pyramid/tile boundaries
 *    crossing thick strokes at fractional zooms (35% -> level 1, 21% ->
 *    level 2, ...). The seams are partially transparent tile-edge feathering,
 *    so a plain "ink pixel" luminance threshold (as used by the seam tests in
 *    raster-brush.spec.ts) counts them as ink and misses them. This sweep
 *    scans stroke-crossing bands for BOTH hard background gaps and bright
 *    seam lines (columns/rows whose mean luminance pops above the stroke
 *    interior), at DPR 2 and DPR 1, across a zoom ladder.
 *
 * 2. LAG: dragging a huge stroke while zoomed way out (~3%) drops frames.
 *    Measured via rAF deltas while driving brush session.update once per
 *    frame, like a user drag.
 */

// channel "chromium" runs full Chromium in new-headless mode with real GPU
// (Metal) rasterization -- the default chrome-headless-shell rasterizes in
// software and does not reproduce the user's GPU-raster artifacts.
test.use({ channel: "chromium" });

const DOCUMENT_VERSION = "1.8";
const NODE_ID = "sweep-image-1";
// 57 x 50 tiles of 512 to mirror the user's ~29250x25707 layer.
const NODE_WIDTH = 29_184;
const NODE_HEIGHT = 25_600;
const BRUSH_SIZE = 450;
const HORIZONTAL_STROKE = { x0: 1500, x1: 27_500, y: 12_800 };
const VERTICAL_STROKE = { x: 14_592, y0: 1500, y1: 24_000 };
const DIAGONAL_STROKE = {
  from: { x: 3000, y: 3200 },
  to: { x: 26_000, y: 22_400 },
};
// Fractional/awkward zooms on purpose: pyramid level = floor(log2(1/zoom)),
// and levelSpan * zoom is non-integer at 0.35 / 0.21 / 0.1 / 0.05 / 0.01.
const SEAM_ZOOMS = [1, 0.5, 0.35, 0.21, 0.1, 0.05, 0.01];
const SWEEP_CENTER = {
  x: (HORIZONTAL_STROKE.x0 + HORIZONTAL_STROKE.x1) / 2,
  y: HORIZONTAL_STROKE.y,
};
const CLIP_EDGE_MARGIN = 24;
// Floating canvas UI (bottom-center toolbar) sits inside the host; keep the
// vertical scan band clear of it or it reads as a background gap.
const CLIP_BOTTOM_MARGIN = 180;
const STROKE_END_INSET = 400;
const RASTER_PYRAMID_MAX_LEVEL = 8;
const RASTER_TILE_SIZE = 512;

const createSweepDocument = (src) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-sweep-image-1",
        height: NODE_HEIGHT,
        id: NODE_ID,
        mimeType: "image/png",
        name: "Sweep Layer",
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
        width: NODE_WIDTH,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createTransparentImageDataUrl = (page) => {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    return canvas.toDataURL("image/png");
  });
};

const createOpaqueTileDataUrl = (page) => {
  return page.evaluate((tileSize) => {
    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;

    const context = canvas.getContext("2d");

    if (!context) {
      return "";
    }

    context.fillStyle = "#d9d2c4";
    context.fillRect(0, 0, tileSize, tileSize);
    context.fillStyle = "#b9b0a0";
    context.fillRect(64, 64, tileSize - 128, tileSize - 128);

    return canvas.toDataURL("image/png");
  }, RASTER_TILE_SIZE);
};

// A fully painted layer: 57x50 committed tiles, mirroring the user's ~2850
// tile document.
const createDenseSweepDocument = (tileSrc) => {
  const tileSources: {
    col: number;
    height: number;
    ref: string;
    row: number;
    src: string;
    width: number;
    x: number;
    y: number;
  }[] = [];

  for (let row = 0; row < NODE_HEIGHT / RASTER_TILE_SIZE; row += 1) {
    for (let col = 0; col < NODE_WIDTH / RASTER_TILE_SIZE; col += 1) {
      tileSources.push({
        col,
        height: RASTER_TILE_SIZE,
        ref: `assets/raster/${NODE_ID}/tiles/seed_${col}_${row}.png`,
        row,
        src: tileSrc,
        width: RASTER_TILE_SIZE,
        x: col * RASTER_TILE_SIZE,
        y: row * RASTER_TILE_SIZE,
      });
    }
  }

  return JSON.stringify({
    nodes: [
      {
        assetId: "asset-sweep-image-1",
        height: NODE_HEIGHT,
        id: NODE_ID,
        mimeType: "image/png",
        name: "Sweep Layer",
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
        width: NODE_WIDTH,
      },
    ],
    version: DOCUMENT_VERSION,
  });
};

const waitForAnimationFrames = (page, count = 1) => {
  return page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
};

const hydrateRasterStore = (page, nodeId) => {
  return page.evaluate(async (targetNodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode(targetNodeId);

    if (!(editor && node)) {
      throw new Error("Expected raster node to hydrate");
    }

    await editor.rasterStores.ensureHydrated(node);
  }, nodeId);
};

const setStableViewport = async (page, viewport) => {
  await page.evaluate(async (targetViewport) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected editor");
    }

    editor.setViewportInteracting(false);
    editor.setViewport(targetViewport);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.(targetViewport);
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? targetViewport.x,
      y: editor.viewerRef?.getScrollTop?.() ?? targetViewport.y,
      zoom: targetViewport.zoom,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }, viewport);
};

const getHostSize = (page) => {
  return page.evaluate(() => {
    const rect = window.__PUNCHPRESS_EDITOR__?.hostRef?.getBoundingClientRect();

    if (!rect) {
      throw new Error("Expected canvas host rect");
    }

    return { height: rect.height, width: rect.width };
  });
};

const centerViewportOn = async (page, localPoint, zoom) => {
  const host = await getHostSize(page);

  await setStableViewport(page, {
    x: localPoint.x - host.width / (2 * zoom),
    y: localPoint.y - host.height / (2 * zoom),
    zoom,
  });
};

const getViewportProjection = (page, nodeId) => {
  return page.evaluate((targetNodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode(targetNodeId);
    const hostRect = editor?.hostRef?.getBoundingClientRect();
    const viewer = editor?.viewerRef;

    if (!(editor && node && hostRect && viewer)) {
      throw new Error("Expected editor projection state");
    }

    return {
      hostHeight: hostRect.height,
      hostLeft: hostRect.left,
      hostTop: hostRect.top,
      hostWidth: hostRect.width,
      nodeX: node.transform.x,
      nodeY: node.transform.y,
      scrollLeft: viewer.getScrollLeft(),
      scrollTop: viewer.getScrollTop(),
      zoom: editor.zoom,
    };
  }, nodeId);
};

const drawCommittedBrushLine = async (page, nodeId, from, to) => {
  await page.evaluate(
    async ({ from: fromPoint, nodeId: targetNodeId, to: toPoint }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const brush = editor?.tools.get("brush");
      const node = editor?.getNode(targetNodeId);

      if (!(editor && brush && node?.type === "image")) {
        throw new Error("Expected brush and image node");
      }

      const toWorldPoint = (point) => ({
        x: node.transform.x + point.x,
        y: node.transform.y + point.y,
      });
      const session = brush.beginStroke({ point: toWorldPoint(fromPoint) });

      if (!session) {
        throw new Error("Expected brush stroke session");
      }

      await session.ready;
      session.update({ point: toWorldPoint(toPoint) });
      await session.complete({ point: toWorldPoint(toPoint) });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    },
    { from, nodeId, to }
  );
};

const getCommittedTileSourceCount = (page, nodeId) => {
  return page.evaluate((targetNodeId) => {
    const node = window.__PUNCHPRESS_EDITOR__?.getNode(targetNodeId);

    return node?.type === "image" ? node.tileSources?.length || 0 : 0;
  }, nodeId);
};

const setUpSweepDocument = async (page) => {
  await gotoEditor(page);

  const src = await createTransparentImageDataUrl(page);

  await loadDocument(page, createSweepDocument(src));
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate((targetNodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select(targetNodeId);
    editor?.setBrushSettings({
      color: "#000000",
      hardness: 1,
      opacity: 1,
      size: 450,
      spacing: 0,
    });
  }, NODE_ID);
  await hydrateRasterStore(page, NODE_ID);
  // Draw at a mid zoom centered on the strokes, like the user did.
  await centerViewportOn(page, SWEEP_CENTER, 0.5);
  await waitForAnimationFrames(page, 4);
};

const drawSweepStrokes = async (page) => {
  await drawCommittedBrushLine(
    page,
    NODE_ID,
    { x: HORIZONTAL_STROKE.x0, y: HORIZONTAL_STROKE.y },
    { x: HORIZONTAL_STROKE.x1, y: HORIZONTAL_STROKE.y }
  );
  await drawCommittedBrushLine(
    page,
    NODE_ID,
    { x: VERTICAL_STROKE.x, y: VERTICAL_STROKE.y0 },
    { x: VERTICAL_STROKE.x, y: VERTICAL_STROKE.y1 }
  );
  await drawCommittedBrushLine(
    page,
    NODE_ID,
    DIAGONAL_STROKE.from,
    DIAGONAL_STROKE.to
  );
  await expect
    .poll(() => getCommittedTileSourceCount(page, NODE_ID))
    .toBeGreaterThan(0);
  await waitForAnimationFrames(page, 6);
};

const clampToRange = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Clip (CSS px) of a band along the horizontal stroke's interior. Height is
 * the central half of the stroke's on-screen thickness, so every column
 * should be solid ink; width is inset from the stroke caps and clamped to the
 * canvas host.
 */
const getHorizontalBandClip = (projection) => {
  const { hostLeft, hostTop, hostWidth, nodeX, nodeY, zoom } = projection;
  const toScreenX = (localX) =>
    hostLeft + (nodeX + localX - projection.scrollLeft) * zoom;
  const toScreenY = (localY) =>
    hostTop + (nodeY + localY - projection.scrollTop) * zoom;
  const bandHeight = Math.max(2, Math.floor(BRUSH_SIZE * zoom * 0.5));
  const rawX0 = toScreenX(HORIZONTAL_STROKE.x0 + STROKE_END_INSET);
  const rawX1 = toScreenX(HORIZONTAL_STROKE.x1 - STROKE_END_INSET);
  const x0 = clampToRange(
    rawX0,
    hostLeft + CLIP_EDGE_MARGIN,
    hostLeft + hostWidth - CLIP_EDGE_MARGIN
  );
  const x1 = clampToRange(
    rawX1,
    hostLeft + CLIP_EDGE_MARGIN,
    hostLeft + hostWidth - CLIP_EDGE_MARGIN
  );

  return {
    height: bandHeight,
    width: Math.floor(x1 - x0),
    x: Math.ceil(x0),
    y: Math.round(toScreenY(HORIZONTAL_STROKE.y) - bandHeight / 2),
  };
};

const getVerticalBandClip = (projection) => {
  const { hostHeight, hostLeft, hostTop, nodeX, nodeY, zoom } = projection;
  const toScreenX = (localX) =>
    hostLeft + (nodeX + localX - projection.scrollLeft) * zoom;
  const toScreenY = (localY) =>
    hostTop + (nodeY + localY - projection.scrollTop) * zoom;
  const bandWidth = Math.max(2, Math.floor(BRUSH_SIZE * zoom * 0.5));
  const rawY0 = toScreenY(VERTICAL_STROKE.y0 + STROKE_END_INSET);
  const rawY1 = toScreenY(VERTICAL_STROKE.y1 - STROKE_END_INSET);
  const y0 = clampToRange(
    rawY0,
    hostTop + CLIP_EDGE_MARGIN,
    hostTop + hostHeight - CLIP_BOTTOM_MARGIN
  );
  const y1 = clampToRange(
    rawY1,
    hostTop + CLIP_EDGE_MARGIN,
    hostTop + hostHeight - CLIP_BOTTOM_MARGIN
  );

  return {
    height: Math.floor(y1 - y0),
    width: bandWidth,
    x: Math.round(toScreenX(VERTICAL_STROKE.x) - bandWidth / 2),
    y: Math.ceil(y0),
  };
};

/**
 * Screenshot a stroke band and profile it along `axis` (device px):
 * - inkCounts: pixels with luminance < 140 across the band
 * - backgroundCounts: pixels with luminance >= 228 (hard background gaps)
 * - meanLuminance: bright seam lines that are still "ink" by threshold
 *   (fractional tile-edge feathering composites to ~60-160 luminance)
 *
 * gapRuns: positions where ink collapses or hard background shows through.
 * brightRuns: positions whose mean luminance pops >= 28 above the stroke
 * interior median -- the thin division lines the user reports.
 */
const analyzeStrokeBand = async (page, clip, axis) => {
  const alongSize = axis === "x" ? clip.width : clip.height;
  const acrossSize = axis === "x" ? clip.height : clip.width;

  if (!(alongSize >= 8 && acrossSize >= 2)) {
    throw new Error(`Stroke band clip too small: ${JSON.stringify(clip)}`);
  }

  // Warm-up frame: a screenshot forces a compositor BeginFrame so lazily
  // rasterized tiles finish before the frame asserted on.
  await page.screenshot({ clip });
  await waitForAnimationFrames(page, 2);

  const screenshot = await page.screenshot({ clip });
  const src = `data:image/png;base64,${screenshot.toString("base64")}`;

  return page.evaluate(
    async ({ axis: bandAxis, src: imageSrc }) => {
      const image = new Image();

      image.src = imageSrc;
      await image.decode();

      const canvas = document.createElement("canvas");

      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        throw new Error("Expected band canvas context");
      }

      context.drawImage(image, 0, 0);

      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const along = bandAxis === "x" ? canvas.width : canvas.height;
      const across = bandAxis === "x" ? canvas.height : canvas.width;
      const inkCounts = new Array(along).fill(0);
      const backgroundCounts = new Array(along).fill(0);
      const luminanceSums = new Array(along).fill(0);

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const offset = (y * canvas.width + x) * 4;
          const luminance =
            0.2126 * data[offset] +
            0.7152 * data[offset + 1] +
            0.0722 * data[offset + 2];
          const alpha = data[offset + 3];
          const index = bandAxis === "x" ? x : y;

          luminanceSums[index] += luminance;

          if (alpha > 200 && luminance < 140) {
            inkCounts[index] += 1;
          } else if (luminance >= 228) {
            backgroundCounts[index] += 1;
          }
        }
      }

      const meanLuminance = luminanceSums.map((sum) => sum / across);
      const medianOf = (values) => {
        const sorted = [...values].sort((first, second) => first - second);

        return sorted[Math.floor(sorted.length / 2)];
      };
      const medianInk = medianOf(inkCounts);
      const medianLuminance = medianOf(meanLuminance);
      const strongInkThreshold = Math.max(1, medianInk * 0.5);
      let firstStrong = -1;
      let lastStrong = -1;

      for (let index = 0; index < along; index += 1) {
        if (inkCounts[index] >= strongInkThreshold) {
          if (firstStrong < 0) {
            firstStrong = index;
          }

          lastStrong = index;
        }
      }

      // Bright-line detection only makes sense while the stroke interior is
      // solidly dark; at extreme zoom-out smoothing lifts the whole band.
      const brightDetectorActive = medianLuminance <= 110;
      const brightThreshold = medianLuminance + 28;
      const interiorStart = firstStrong + 2;
      const interiorEnd = lastStrong - 2;
      const collectRuns = (isFlagged) => {
        const runs: {
          from: number;
          maxBackground: number;
          maxMeanLuminance: number;
          minInk: number;
          to: number;
        }[] = [];
        let current: (typeof runs)[number] | null = null;

        for (let index = interiorStart; index <= interiorEnd; index += 1) {
          if (isFlagged(index)) {
            if (current && index === current.to + 1) {
              current.to = index;
              current.minInk = Math.min(current.minInk, inkCounts[index]);
              current.maxBackground = Math.max(
                current.maxBackground,
                backgroundCounts[index]
              );
              current.maxMeanLuminance = Math.max(
                current.maxMeanLuminance,
                Math.round(meanLuminance[index])
              );
            } else {
              current = {
                from: index,
                maxBackground: backgroundCounts[index],
                maxMeanLuminance: Math.round(meanLuminance[index]),
                minInk: inkCounts[index],
                to: index,
              };
              runs.push(current);
            }
          }
        }

        return runs;
      };
      const gapRuns = collectRuns(
        (index) =>
          inkCounts[index] < medianInk * 0.5 ||
          backgroundCounts[index] >= across * 0.5
      );
      const brightRuns = brightDetectorActive
        ? collectRuns((index) => meanLuminance[index] >= brightThreshold)
        : [];
      let maxInteriorMeanLuminance = 0;
      let maxInteriorIndex = -1;

      for (let index = interiorStart; index <= interiorEnd; index += 1) {
        if (meanLuminance[index] > maxInteriorMeanLuminance) {
          maxInteriorMeanLuminance = meanLuminance[index];
          maxInteriorIndex = index;
        }
      }

      return {
        maxInteriorIndex,
        maxInteriorMeanLuminance:
          Math.round(maxInteriorMeanLuminance * 10) / 10,
        across,
        along,
        brightDetectorActive,
        brightRuns,
        firstStrong,
        gapRuns,
        lastStrong,
        medianInk,
        medianLuminance: Math.round(medianLuminance * 10) / 10,
      };
    },
    { axis, src }
  );
};

const getPyramidLevelForZoom = (zoom) =>
  Math.min(
    RASTER_PYRAMID_MAX_LEVEL,
    Math.max(0, Math.floor(Math.log2(1 / zoom)))
  );

/**
 * Enrich device-px run positions with layer-local coordinates and the
 * nearest pyramid tile boundary at the active level, so a failure pins the
 * seam to a boundary for the fix.
 */
const describeRuns = (runs, clip, projection, axis, dpr) => {
  const level = getPyramidLevelForZoom(projection.zoom);
  const levelSpan = RASTER_TILE_SIZE * 2 ** level;
  const toLocal = (deviceIndex) => {
    if (axis === "x") {
      return (
        (clip.x + deviceIndex / dpr - projection.hostLeft) / projection.zoom +
        projection.scrollLeft -
        projection.nodeX
      );
    }

    return (
      (clip.y + deviceIndex / dpr - projection.hostTop) / projection.zoom +
      projection.scrollTop -
      projection.nodeY
    );
  };

  return runs.map((run) => {
    const localFrom = toLocal(run.from);
    const localTo = toLocal(run.to + 1);
    const nearestBoundary = Math.round(localFrom / levelSpan) * levelSpan;

    return {
      ...run,
      localFrom: Math.round(localFrom),
      localTo: Math.round(localTo),
      nearestLevelBoundary: nearestBoundary,
      pyramidLevel: level,
    };
  });
};

const scanZoomLadder = async (page, dpr, stateLabel) => {
  for (const zoom of SEAM_ZOOMS) {
    await test.step(`${stateLabel} zoom ${zoom} (pyramid level ${getPyramidLevelForZoom(zoom)})`, async () => {
      await centerViewportOn(page, SWEEP_CENTER, zoom);
      await waitForAnimationFrames(page, 6);

      const projection = await getViewportProjection(page, NODE_ID);

      expect
        .soft(
          projection.zoom,
          `[dpr ${dpr}] [${stateLabel}] requested zoom ${zoom} but viewer settled at ${projection.zoom}`
        )
        .toBeCloseTo(zoom, 3);

      const bands = [
        {
          axis: "x",
          clip: getHorizontalBandClip(projection),
          orientation: "horizontal stroke (column scan for vertical seams)",
        },
        {
          axis: "y",
          clip: getVerticalBandClip(projection),
          orientation: "vertical stroke (row scan for horizontal seams)",
        },
      ];

      for (const band of bands) {
        const analysis = await analyzeStrokeBand(page, band.clip, band.axis);
        const label = `[dpr ${dpr}] [${stateLabel}] zoom ${zoom} ${band.orientation}`;
        const gapRuns = describeRuns(
          analysis.gapRuns,
          band.clip,
          projection,
          band.axis,
          dpr
        );
        const brightRuns = describeRuns(
          analysis.brightRuns,
          band.clip,
          projection,
          band.axis,
          dpr
        );

        console.log(
          `[sweep] dpr=${dpr} state=${stateLabel} zoom=${zoom} axis=${band.axis} ` +
            `medianInk=${analysis.medianInk} medianLum=${analysis.medianLuminance} ` +
            `maxLum=${analysis.maxInteriorMeanLuminance}@${analysis.maxInteriorIndex} ` +
            `gapRuns=${gapRuns.length} brightRuns=${brightRuns.length} ` +
            `first=${analysis.firstStrong} last=${analysis.lastStrong} along=${analysis.along}`
        );

        // The stroke must render at all inside its own interior band.
        expect
          .soft(
            analysis.medianInk,
            `${label}: stroke band has almost no ink (median ${analysis.medianInk} of ${analysis.across} px) -- stroke missing or culled`
          )
          .toBeGreaterThanOrEqual(Math.max(1, analysis.across * 0.6));

        // No truncation: ink must reach both ends of the interior band.
        const endTolerance = Math.ceil(3 * dpr) + 2;

        expect
          .soft(
            analysis.firstStrong,
            `${label}: ink starts ${analysis.firstStrong} device px into the band -- stroke truncated at its leading edge`
          )
          .toBeLessThanOrEqual(endTolerance);
        expect
          .soft(
            analysis.lastStrong,
            `${label}: ink ends at ${analysis.lastStrong} of ${analysis.along} device px -- stroke truncated at its trailing edge`
          )
          .toBeGreaterThanOrEqual(analysis.along - 1 - endTolerance);

        // No hard background gaps interrupting the stroke.
        expect
          .soft(
            gapRuns,
            `${label}: background gap runs inside continuous stroke (medianInk ${analysis.medianInk})`
          )
          .toEqual([]);

        // No bright seam lines interrupting the stroke.
        expect
          .soft(
            brightRuns,
            `${label}: bright seam lines inside continuous stroke (medianLum ${analysis.medianLuminance}, threshold +28)`
          )
          .toEqual([]);
      }
    });
  }
};

const runSeamZoomLadder = async (page, testInfo) => {
  testInfo.setTimeout(420_000);
  await setUpSweepDocument(page);
  await drawSweepStrokes(page);

  const dpr = await page.evaluate(() => window.devicePixelRatio);

  // State 1: freshly painted layer -- committed pixels render through the
  // live raster store surface and its mipmap pyramid.
  await scanZoomLadder(page, dpr, "painted");

  // State 2: round-trip through persistence. Serialize the painted document
  // and load it into a fresh page: the reopened layer renders its committed
  // pixels from tileSources (SVG image tiles / preview canvas), the user's
  // regime when viewing a previously painted document. The existing seam
  // tests only ever exercise state 1.
  const serialized = await serializeDocument(page);

  if (!serialized) {
    throw new Error("Expected serialized sweep document");
  }

  await gotoEditor(page);
  await loadDocument(page, serialized);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await waitForAnimationFrames(page, 6);

  const reloadedTileCount = await getCommittedTileSourceCount(page, NODE_ID);

  expect(
    reloadedTileCount,
    "reloaded document should carry committed raster tiles"
  ).toBeGreaterThan(0);
  console.log(`[sweep] reloaded document tileSources=${reloadedTileCount}`);

  await scanZoomLadder(page, dpr, "reloaded");
};

test.describe("raster visual sweep @ DPR 2", () => {
  test.use({
    deviceScaleFactor: 2,
    viewport: { height: 1300, width: 2000 },
  });

  test("zoom ladder shows no seams or truncation across pyramid levels", async ({
    page,
  }, testInfo) => {
    await runSeamZoomLadder(page, testInfo);
  });

  test("dragging a huge stroke at 3% zoom stays within frame budget", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000);
    await gotoEditor(page);

    // A fully painted ~2850-tile layer, like the user's document: the
    // compositor redraws committed pyramid content under the live stroke
    // overlay on every frame of the drag.
    const tileSrc = await createOpaqueTileDataUrl(page);

    await loadDocument(page, createDenseSweepDocument(tileSrc));
    await setViewport(page, { x: 0, y: 0, zoom: 1 });
    await page.evaluate((targetNodeId) => {
      window.__PUNCHPRESS_EDITOR__?.select(targetNodeId);
    }, NODE_ID);

    // Deliberately NOT pre-hydrating the raster store: the user's session is
    // open document -> zoom way out -> start painting. The first stroke pays
    // first-contact hydration of ~2850 committed tiles, and that cost lands
    // inside the drag.
    await centerViewportOn(
      page,
      { x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 },
      0.03
    );
    await waitForAnimationFrames(page, 8);
    // Warm-up: force a full composite of the loaded document before the
    // measured drag.
    await page.screenshot();
    await waitForAnimationFrames(page, 8);

    // Max brush (size clamps at 500 layer px); the user paints "huge" strokes
    // zoomed out with the biggest brush available.
    await page.evaluate(() => {
      window.__PUNCHPRESS_EDITOR__?.setBrushSettings({
        color: "#000000",
        hardness: 1,
        opacity: 1,
        size: 500,
        spacing: 0,
      });
    });
    await page.keyboard.press("b");

    // Independent rAF logger: frame pacing is observed from inside the page
    // while real pointer events drive the stroke, exactly like a user drag.
    await page.evaluate(() => {
      const log = { deltas: [] as number[], last: 0, running: true };

      (window as { __SWEEP_FRAME_LOG__?: typeof log }).__SWEEP_FRAME_LOG__ =
        log;

      const tick = (timestamp) => {
        if (log.last > 0) {
          log.deltas.push(timestamp - log.last);
        }

        log.last = timestamp;

        if (log.running) {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
    });

    // Zigzag drag across the on-screen layer through the real pointer
    // pipeline. At 3% zoom every screen px is ~33 layer px, so this covers
    // ~25k layer px like the user's huge strokes.
    const host = await getHostSize(page);
    const hostBox = await page.evaluate(() => {
      const rect =
        window.__PUNCHPRESS_EDITOR__?.hostRef?.getBoundingClientRect();

      if (!rect) {
        throw new Error("Expected canvas host rect");
      }

      return { left: rect.left, top: rect.top };
    });
    const centerX = hostBox.left + host.width / 2;
    const centerY = hostBox.top + host.height / 2;
    // One long scribble: 12 full-width sweeps back and forth across the
    // on-screen layer while drifting vertically -- a single user drag that
    // covers most of the layer (each screen px is ~33 layer px at 3% zoom,
    // so this is ~300k layer px of stroke path in one gesture).
    const sweepCount = 12;
    const waypointsPerSweep = 10;
    const waypoints = Array.from(
      { length: sweepCount * waypointsPerSweep },
      (_, index) => {
        const sweep = Math.floor(index / waypointsPerSweep);
        const along = (index % waypointsPerSweep) / (waypointsPerSweep - 1);
        const direction = sweep % 2 === 0 ? 1 : -1;

        return {
          x: centerX + direction * (along * 2 - 1) * 400,
          y:
            centerY +
            (sweep / (sweepCount - 1) - 0.5) * 480 +
            Math.sin(index * 0.7) * 40,
        };
      }
    );

    const getCenterInkCount = () =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const rect = editor?.hostRef?.getBoundingClientRect();

        if (!rect) {
          throw new Error("Expected canvas host rect");
        }

        const probe = document.createElement("canvas");

        probe.width = 400;
        probe.height = 300;

        const context = probe.getContext("2d", { willReadFrequently: true });
        const surfaceCanvases = [
          ...document.querySelectorAll<HTMLCanvasElement>(
            "[data-raster-store-surface='true'] canvas"
          ),
        ];

        if (!(context && surfaceCanvases.length)) {
          return -1;
        }

        // Sample the compositor surface canvas directly: dark stroke pixels
        // over the light tile background.
        const surface = surfaceCanvases[0];

        context.drawImage(
          surface,
          surface.width / 2 - 200,
          surface.height / 2 - 150,
          400,
          300,
          0,
          0,
          400,
          300
        );

        const data = context.getImageData(0, 0, 400, 300).data;
        let inkCount = 0;

        for (let index = 0; index < data.length; index += 4) {
          const luminance =
            0.2126 * data[index] +
            0.7152 * data[index + 1] +
            0.0722 * data[index + 2];

          if (data[index + 3] > 200 && luminance < 100) {
            inkCount += 1;
          }
        }

        return inkCount;
      });
    const inkBeforeDrag = await getCenterInkCount();
    const resetFrameLog = () =>
      page.evaluate(() => {
        const log = (
          window as {
            __SWEEP_FRAME_LOG__?: { deltas: number[]; last: number };
          }
        ).__SWEEP_FRAME_LOG__;

        if (log) {
          log.deltas.length = 0;
          log.last = 0;
        }
      });
    const readFrameLog = (stop) =>
      page.evaluate((stopLogging) => {
        const log = (
          window as {
            __SWEEP_FRAME_LOG__?: {
              deltas: number[];
              last: number;
              running: boolean;
            };
          }
        ).__SWEEP_FRAME_LOG__;

        if (!log) {
          throw new Error("Expected sweep frame log");
        }

        if (stopLogging) {
          log.running = false;
        }

        return [...log.deltas];
      }, stop);
    const dragAlongWaypoints = async (points) => {
      await page.mouse.move(points[0].x, points[0].y);
      await page.mouse.down();

      for (const waypoint of points.slice(1)) {
        await page.mouse.move(waypoint.x, waypoint.y, { steps: 8 });
      }
    };

    // A painting session like the user's: the first huge scribble on the
    // freshly opened document (pays first-contact store hydration inside the
    // drag), commit on pointer-up, then IMMEDIATELY another huge scribble
    // (rides the commit's tile merge + persistence encode). Frame pacing is
    // measured across the whole session.
    const half = waypoints.length / 2;
    const firstScribble = waypoints.slice(0, half);
    const secondScribble = waypoints
      .slice(half)
      .map((point) => ({ x: point.x, y: point.y - 40 }));

    await page.mouse.move(firstScribble[0].x, firstScribble[0].y);
    await resetFrameLog();
    await page.mouse.down();

    for (const waypoint of firstScribble.slice(1)) {
      await page.mouse.move(waypoint.x, waypoint.y, { steps: 8 });
    }

    await page.mouse.up();
    await dragAlongWaypoints(secondScribble);

    const frameDeltas = await readFrameLog(true);
    const inkDuringDrag = await getCenterInkCount();

    await page.mouse.up();

    // Guard: the measured frames must belong to a live painting drag, not an
    // idle canvas.
    expect(
      inkDuringDrag,
      `drag did not paint (ink before=${inkBeforeDrag}, during=${inkDuringDrag})`
    ).toBeGreaterThan(Math.max(0, inkBeforeDrag) + 5000);

    if (frameDeltas.length < 30) {
      throw new Error(
        `Drag finished in only ${frameDeltas.length} frames; not enough to measure pacing`
      );
    }

    const getStats = (deltas) => {
      const sorted = [...deltas].sort((first, second) => first - second);

      return {
        max: sorted.at(-1),
        mean: deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length,
        p95: sorted[Math.floor(0.95 * (sorted.length - 1))],
        slowest: sorted.slice(-6),
      };
    };
    const third = Math.floor(frameDeltas.length / 3);
    const overall = getStats(frameDeltas);
    const firstThird = getStats(frameDeltas.slice(0, third));
    const lastThird = getStats(frameDeltas.slice(-third));
    const { max, p95 } = overall;
    const summary =
      `frames=${frameDeltas.length} mean=${overall.mean.toFixed(1)}ms ` +
      `p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms ` +
      `firstThird(p95=${firstThird.p95.toFixed(1)} max=${firstThird.max.toFixed(1)}) ` +
      `lastThird(p95=${lastThird.p95.toFixed(1)} max=${lastThird.max.toFixed(1)}) ` +
      `slowest=[${overall.slowest.map((delta) => delta.toFixed(1)).join(", ")}]`;

    console.log(`[sweep] drag frame budget @ zoom 0.03 dpr 2: ${summary}`);

    // 30fps p95 floor + a hard hitch ceiling: dragging must feel continuous.
    expect
      .soft(p95, `p95 frame time during zoomed-out drag too slow: ${summary}`)
      .toBeLessThanOrEqual(33);
    expect
      .soft(max, `worst frame hitch during zoomed-out drag: ${summary}`)
      .toBeLessThanOrEqual(150);
  });
});

test.describe("raster visual sweep @ DPR 1", () => {
  test.use({
    deviceScaleFactor: 1,
    viewport: { height: 1300, width: 2000 },
  });

  test("zoom ladder shows no seams or truncation across pyramid levels", async ({
    page,
  }, testInfo) => {
    await runSeamZoomLadder(page, testInfo);
  });
});
