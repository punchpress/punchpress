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

// A fully painted layer: width/height in committed 512px tiles, mirroring the
// user's fully-brushed documents (57x50 for the seam/lag-at-3% doc, 78x67 for
// the lag-at-1% doc).
const createDenseSweepDocument = (
  tileSrc,
  nodeWidth = NODE_WIDTH,
  nodeHeight = NODE_HEIGHT
) => {
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

  for (let row = 0; row < nodeHeight / RASTER_TILE_SIZE; row += 1) {
    for (let col = 0; col < nodeWidth / RASTER_TILE_SIZE; col += 1) {
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
        height: nodeHeight,
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
        width: nodeWidth,
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
      // editor.zoom accepts any value; the viewer clamps to its zoomRange.
      // A mismatch means the requested zoom is beyond what the app renders.
      viewerZoom: viewer.getZoom?.() ?? null,
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

/**
 * SYMPTOM 1 -- jagged edges at 200% zoom-in (user-confirmed, retina Mac).
 *
 * A slightly tilted thick stroke viewed at zoom 2 (DPR 2) shows chunky hard
 * stair-steps along its near-horizontal edge: ~8-15 device px flat runs with
 * abrupt 2-4 px rises and NO antialiasing gradient. Correct rendering: the
 * stroke's 1-store-px AA band upscales to a smooth ~4-device-px gradient, so
 * every screenshot column crossing the edge contains intermediate luminance
 * values and the quantized edge Y advances in ~1 px rises.
 *
 * Two draw variants discriminate WHERE the defect lives:
 * - drawn at zoom 0.5 (store pixels known-good AA) -> failure = render/upscale
 * - drawn at zoom 0.05 with a huge brush (the user's actual flow) -> failure
 *   only here = defect baked into the stored pixels (solid-dab AA band too
 *   thin at huge radii).
 */
const EDGE_STROKE_SLOPE = 0.07; // ~4 degrees; rise/run in layer px
const EDGE_STROKE_HALF_LENGTH = 2200;
const EDGE_CLIP_WIDTH = 600;
const EDGE_CLIP_HEIGHT = 240;
const EDGE_VIEW_ZOOMS = [2, 4];

const setUpTiltedEdgeDocument = async (page, brushSize, drawZoom) => {
  await gotoEditor(page);

  const src = await createTransparentImageDataUrl(page);

  await loadDocument(page, createSweepDocument(src));
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(
    ({ size, targetNodeId }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      editor?.select(targetNodeId);
      editor?.setBrushSettings({
        color: "#000000",
        hardness: 1,
        opacity: 1,
        size,
        spacing: 0,
      });
    },
    { size: brushSize, targetNodeId: NODE_ID }
  );
  await hydrateRasterStore(page, NODE_ID);
  await centerViewportOn(page, SWEEP_CENTER, drawZoom);
  await waitForAnimationFrames(page, 4);
  await drawCommittedBrushLine(
    page,
    NODE_ID,
    {
      x: SWEEP_CENTER.x - EDGE_STROKE_HALF_LENGTH,
      y: SWEEP_CENTER.y - EDGE_STROKE_HALF_LENGTH * EDGE_STROKE_SLOPE,
    },
    {
      x: SWEEP_CENTER.x + EDGE_STROKE_HALF_LENGTH,
      y: SWEEP_CENTER.y + EDGE_STROKE_HALF_LENGTH * EDGE_STROKE_SLOPE,
    }
  );
  await expect
    .poll(() => getCommittedTileSourceCount(page, NODE_ID))
    .toBeGreaterThan(0);
  await waitForAnimationFrames(page, 6);

  // Midpoint of the stroke's TOP edge (small-angle: perpendicular offset ~
  // vertical offset).
  return { x: SWEEP_CENTER.x, y: SWEEP_CENTER.y - brushSize / 2 };
};

const getEdgeClip = (projection, edgePoint) => {
  const { hostHeight, hostLeft, hostTop, hostWidth, nodeX, nodeY, zoom } =
    projection;
  const screenX =
    hostLeft + (nodeX + edgePoint.x - projection.scrollLeft) * zoom;
  const screenY = hostTop + (nodeY + edgePoint.y - projection.scrollTop) * zoom;

  return {
    height: EDGE_CLIP_HEIGHT,
    width: EDGE_CLIP_WIDTH,
    x: Math.round(
      clampToRange(
        screenX - EDGE_CLIP_WIDTH / 2,
        hostLeft + CLIP_EDGE_MARGIN,
        hostLeft + hostWidth - CLIP_EDGE_MARGIN - EDGE_CLIP_WIDTH
      )
    ),
    y: Math.round(
      clampToRange(
        screenY - EDGE_CLIP_HEIGHT / 2,
        hostTop + CLIP_EDGE_MARGIN,
        hostTop + hostHeight - CLIP_BOTTOM_MARGIN - EDGE_CLIP_HEIGHT
      )
    ),
  };
};

/**
 * Screenshot the top-edge clip and walk COLUMNS (device px) across the edge:
 * - per column: the background->ink luminance transition profile
 * - intermediateCount: pixels strictly inside the AA window (luminance
 *   strictly between ink+15% and ink+85% of the bg-ink range) -- 0 means a
 *   hard aliased edge in that column
 * - edgeRow: first row at or past 50% coverage -> flat-run/step analysis
 */
const analyzeEdgeProfile = async (page, clip) => {
  // Warm-up frame, as in analyzeStrokeBand: force a compositor BeginFrame so
  // lazily rasterized content settles before the asserted frame.
  await page.screenshot({ clip });
  await waitForAnimationFrames(page, 2);

  const screenshot = await page.screenshot({ clip });
  const src = `data:image/png;base64,${screenshot.toString("base64")}`;

  return page.evaluate(async (imageSrc) => {
    const image = new Image();

    image.src = imageSrc;
    await image.decode();

    const canvas = document.createElement("canvas");

    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Expected edge canvas context");
    }

    context.drawImage(image, 0, 0);

    const { width, height } = canvas;
    const data = context.getImageData(0, 0, width, height).data;
    const luminanceAt = (x, y) => {
      const offset = (y * width + x) * 4;

      return (
        0.2126 * data[offset] +
        0.7152 * data[offset + 1] +
        0.0722 * data[offset + 2]
      );
    };
    const medianOf = (values) => {
      const sorted = [...values].sort((first, second) => first - second);

      return sorted[Math.floor(sorted.length / 2)];
    };
    const topRow: number[] = [];
    const bottomRow: number[] = [];

    for (let x = 0; x < width; x += 1) {
      topRow.push(luminanceAt(x, 1));
      bottomRow.push(luminanceAt(x, height - 2));
    }

    const background = medianOf(topRow);
    const ink = medianOf(bottomRow);
    const range = background - ink;
    const low = ink + range * 0.15;
    const high = ink + range * 0.85;
    const mid = ink + range * 0.5;
    const columns: {
      edgeRow: number;
      intermediateCount: number;
      x: number;
    }[] = [];
    let missingEdgeColumns = 0;

    for (let x = 0; x < width; x += 1) {
      let edgeRow = -1;
      let intermediateCount = 0;

      for (let y = 0; y < height; y += 1) {
        const luminance = luminanceAt(x, y);

        if (edgeRow < 0 && luminance <= mid) {
          edgeRow = y;
        }

        if (luminance > low && luminance < high) {
          intermediateCount += 1;
        }
      }

      if (edgeRow <= 0) {
        missingEdgeColumns += 1;
        continue;
      }

      columns.push({ edgeRow, intermediateCount, x });
    }

    // Flat runs and rise sizes of the quantized edge Y across columns.
    const flatRuns: { edgeRow: number; from: number; length: number }[] = [];
    let maxRise = 0;
    let current: (typeof flatRuns)[number] | null = null;

    for (const column of columns) {
      if (
        current &&
        column.edgeRow === current.edgeRow &&
        column.x === current.from + current.length
      ) {
        current.length += 1;
      } else {
        if (current) {
          maxRise = Math.max(
            maxRise,
            Math.abs(column.edgeRow - current.edgeRow)
          );
        }

        current = { edgeRow: column.edgeRow, from: column.x, length: 1 };
        flatRuns.push(current);
      }
    }

    const maxFlatRun = flatRuns.reduce(
      (max, run) => (run.length > max.length ? run : max),
      { edgeRow: -1, from: -1, length: 0 }
    );
    const zeroAAColumns = columns.filter(
      (column) => column.intermediateCount === 0
    ).length;
    // Crisp-pixel metric (nearest-neighbor regime): every luminance
    // transition in a column must complete within a 2-row step group, i.e.
    // at most 1 intermediate-luminance px between two plateaus. A smoothing
    // gradient produces long runs of consecutive changing rows instead.
    let softColumns = 0;

    for (const column of columns) {
      let changingRun = 0;
      let maxChangingRun = 0;

      for (let y = 1; y < height; y += 1) {
        if (
          Math.abs(luminanceAt(column.x, y) - luminanceAt(column.x, y - 1)) > 12
        ) {
          changingRun += 1;
          maxChangingRun = Math.max(maxChangingRun, changingRun);
        } else {
          changingRun = 0;
        }
      }

      if (maxChangingRun > 2) {
        softColumns += 1;
      }
    }
    const intermediateCounts = columns.map(
      (column) => column.intermediateCount
    );
    // Vertical luminance transition profile of three sample columns
    // (quarter, middle, three-quarter), +/-8 rows around the edge.
    const sampleProfiles = [0.25, 0.5, 0.75].map((fraction) => {
      const column = columns[Math.floor((columns.length - 1) * fraction)];

      if (!column) {
        return { profile: [], x: -1 };
      }

      const profile: number[] = [];

      for (
        let y = Math.max(0, column.edgeRow - 8);
        y <= Math.min(height - 1, column.edgeRow + 8);
        y += 1
      ) {
        profile.push(Math.round(luminanceAt(column.x, y)));
      }

      return { profile, x: column.x };
    });

    return {
      background: Math.round(background * 10) / 10,
      columnCount: columns.length,
      height,
      ink: Math.round(ink * 10) / 10,
      maxFlatRun,
      maxRise,
      medianIntermediate: medianOf(
        intermediateCounts.length ? intermediateCounts : [0]
      ),
      missingEdgeColumns,
      range: Math.round(range * 10) / 10,
      sampleProfiles,
      softColumns,
      width,
      zeroAAColumns,
    };
  }, src);
};

/**
 * SYMPTOM 2 -- lag while drawing at 1% zoom on a huge hydrated layer
 * (user-confirmed). 78x67 committed tiles (~39936x34304 layer px). Steady
 * state (hydration prepaid and settled), then one screen-crossing scribble
 * through the real mouse pipeline while an rAF logger watches frame pacing.
 */
const LAG_NODE_WIDTH = 78 * RASTER_TILE_SIZE; // 39936
const LAG_NODE_HEIGHT = 67 * RASTER_TILE_SIZE; // 34304
const LAG_ZOOM = 0.01;

const installFrameLog = (page) => {
  return page.evaluate(() => {
    const log = { deltas: [] as number[], last: 0, running: true };

    (window as { __SWEEP_FRAME_LOG_2__?: typeof log }).__SWEEP_FRAME_LOG_2__ =
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
};

const resetFrameLog = (page) => {
  return page.evaluate(() => {
    const log = (
      window as {
        __SWEEP_FRAME_LOG_2__?: { deltas: number[]; last: number };
      }
    ).__SWEEP_FRAME_LOG_2__;

    if (log) {
      log.deltas.length = 0;
      log.last = 0;
    }
  });
};

const readFrameLog = (page, stop) => {
  return page.evaluate((stopLogging) => {
    const log = (
      window as {
        __SWEEP_FRAME_LOG_2__?: {
          deltas: number[];
          last: number;
          running: boolean;
        };
      }
    ).__SWEEP_FRAME_LOG_2__;

    if (!log) {
      throw new Error("Expected sweep frame log");
    }

    if (stopLogging) {
      log.running = false;
    }

    return [...log.deltas];
  }, stop);
};

const getFrameStats = (deltas) => {
  const sorted = [...deltas].sort((first, second) => first - second);

  return {
    max: sorted.at(-1) ?? 0,
    mean: deltas.reduce((sum, delta) => sum + delta, 0) / (deltas.length || 1),
    p50: sorted[Math.floor(0.5 * (sorted.length - 1))] ?? 0,
    p95: sorted[Math.floor(0.95 * (sorted.length - 1))] ?? 0,
    slowest: sorted.slice(-6),
  };
};

// Steady state: hydration/decode work drains until 30 consecutive rAF deltas
// stay under 40ms (or we give up after ~60s and report).
const waitForQuietFrames = async (page) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await resetFrameLog(page);
    await waitForAnimationFrames(page, 30);

    const deltas = await readFrameLog(page, false);
    const max = Math.max(...deltas, 0);

    if (deltas.length >= 20 && max < 40) {
      return { attempt, settled: true };
    }
  }

  return { attempt: 40, settled: false };
};

// Perf spans (optional diagnostics): aggregate engine measurePerf spans by
// label so a red frame budget also says where the time went.
const installPerfSpanAggregator = (page) => {
  return page.evaluate(() => {
    const totals: Record<
      string,
      { count: number; maxMs: number; totalMs: number }
    > = {};
    const counters: Record<string, number> = {};
    const record = (label, durationMs) => {
      if (!totals[label]) {
        totals[label] = { count: 0, maxMs: 0, totalMs: 0 };
      }

      const entry = totals[label];

      entry.count += 1;
      entry.totalMs += durationMs;
      entry.maxMs = Math.max(entry.maxMs, durationMs);
    };
    const sink = {
      incrementCounter: (name, amount = 1) => {
        counters[name] = (counters[name] || 0) + amount;
      },
      recordDuration: record,
      recordSpan: (span) => record(span.label, span.durationMs),
    };
    const host = {
      counters,
      reset: () => {
        for (const key of Object.keys(totals)) {
          delete totals[key];
        }

        for (const key of Object.keys(counters)) {
          delete counters[key];
        }
      },
      totals,
    };

    (window as { __SWEEP_PERF_AGG__?: typeof host }).__SWEEP_PERF_AGG__ = host;
    (
      window as { __PUNCHPRESS_PERF_SINK__?: typeof sink }
    ).__PUNCHPRESS_PERF_SINK__ = sink;
  });
};

const readPerfSpanAggregate = (page) => {
  return page.evaluate(() => {
    const host = (
      window as {
        __SWEEP_PERF_AGG__?: {
          counters: Record<string, number>;
          totals: Record<
            string,
            { count: number; maxMs: number; totalMs: number }
          >;
        };
      }
    ).__SWEEP_PERF_AGG__;

    if (!host) {
      return { counters: [], spans: [] };
    }

    return {
      counters: Object.entries(host.counters).map(([name, count]) => ({
        count,
        name,
      })),
      spans: Object.entries(host.totals)
        .map(([label, entry]) => ({
          count: entry.count,
          label,
          maxMs: Math.round(entry.maxMs * 10) / 10,
          totalMs: Math.round(entry.totalMs * 10) / 10,
        }))
        .sort((first, second) => second.totalMs - first.totalMs),
    };
  });
};

const resetPerfSpanAggregate = (page) => {
  return page.evaluate(() => {
    (
      window as { __SWEEP_PERF_AGG__?: { reset: () => void } }
    ).__SWEEP_PERF_AGG__?.reset();
  });
};

// Dark stroke pixel count in the center of the raster compositor surface --
// the drag guard used by the 3% lag test, hoisted for reuse.
const getSurfaceCenterInkCount = (page) => {
  return page.evaluate(() => {
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

  test("zoomed-in stroke edges keep an antialiased gradient at 200%", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(240_000);

    // Variant A isolates the render/upscale path (stroke drawn at mid zoom,
    // moderate radius). Variant B is the user's actual flow (drawn far
    // zoomed out with a huge brush); if only B fails, the defect is baked
    // into the stored pixels rather than the zoom-in render path.
    const variants = [
      { brushSize: 300, drawZoom: 0.5, label: "drawn@0.5/size300" },
      { brushSize: 500, drawZoom: 0.05, label: "drawn@0.05/size500" },
    ];

    for (const variant of variants) {
      const topEdgeMid = await setUpTiltedEdgeDocument(
        page,
        variant.brushSize,
        variant.drawZoom
      );

      for (const zoom of EDGE_VIEW_ZOOMS) {
        await centerViewportOn(page, topEdgeMid, zoom);
        await waitForAnimationFrames(page, 6);

        const projection = await getViewportProjection(page, NODE_ID);

        // Photoshop-parity deep zoom: MAX_ZOOM covers every rung and the
        // editor state and viewer must agree, or the rung silently renders
        // at a different zoom than asserted.
        expect(
          projection.zoom,
          `[edge ${variant.label}] editor.zoom must settle at ${zoom}`
        ).toBeCloseTo(zoom, 3);
        expect(
          projection.viewerZoom ?? zoom,
          `[edge ${variant.label}] viewer clamps zoom ${zoom} to ${projection.viewerZoom} -- editor/viewer zoom ceilings diverge`
        ).toBeCloseTo(zoom, 3);

        const clip = getEdgeClip(projection, topEdgeMid);
        const analysis = await analyzeEdgeProfile(page, clip);
        const label = `[edge ${variant.label}] view zoom ${zoom}`;
        // Assertion regime flips by zoom: at zoom >= 4 the compositor samples
        // nearest-neighbor (crisp squares); below that it smooths (AA edge).
        const crispRegime = zoom >= 4;
        // Slope is scale-invariant, so with smooth AA the integer-quantized
        // edge Y advances ~1 device px per 1/slope columns. Chunky
        // store-px-quantized steps produce flat runs of (zoom * dpr) / slope.
        const expectedStepPx = 1 / EDGE_STROKE_SLOPE;
        const maxAllowedFlatRun = Math.ceil(2 * expectedStepPx);
        const zeroAAFraction =
          analysis.columnCount > 0
            ? analysis.zeroAAColumns / analysis.columnCount
            : 1;

        console.log(
          `[sweep] edge ${variant.label} zoom=${zoom} regime=${crispRegime ? "crisp" : "smooth"} ` +
            `bg=${analysis.background} ink=${analysis.ink} ` +
            `cols=${analysis.columnCount} missing=${analysis.missingEdgeColumns} ` +
            `zeroAA=${analysis.zeroAAColumns} (${(zeroAAFraction * 100).toFixed(1)}%) ` +
            `medianAApx=${analysis.medianIntermediate} soft=${analysis.softColumns} ` +
            `maxFlatRun=${analysis.maxFlatRun.length}px@x${analysis.maxFlatRun.from} ` +
            `(allowed ${maxAllowedFlatRun}) maxRise=${analysis.maxRise}px`
        );

        for (const sample of analysis.sampleProfiles) {
          console.log(
            `[sweep] edge ${variant.label} zoom=${zoom} column x=${sample.x} ` +
              `transition profile: [${sample.profile.join(", ")}]`
          );
        }

        // Analysis sanity: the clip must actually contain the edge with
        // background above and solid ink below.
        expect(
          analysis.range,
          `${label}: background/ink contrast collapsed (bg=${analysis.background} ink=${analysis.ink}) -- clip missed the edge`
        ).toBeGreaterThanOrEqual(60);
        expect(
          analysis.missingEdgeColumns,
          `${label}: ${analysis.missingEdgeColumns} of ${analysis.width} columns never crossed the edge -- clip misplaced`
        ).toBeLessThanOrEqual(analysis.width * 0.05);

        if (crispRegime) {
          // Nearest-neighbor regime: store pixels must render as crisp
          // squares. Every luminance transition is HARD -- at most 1
          // intermediate-luminance px between plateaus per transition.
          const softFraction =
            analysis.columnCount > 0
              ? analysis.softColumns / analysis.columnCount
              : 1;

          expect
            .soft(
              softFraction,
              `${label}: ${analysis.softColumns}/${analysis.columnCount} columns show smoothed (multi-px) luminance transitions -- expected nearest-neighbor crisp pixels at deep zoom`
            )
            .toBeLessThanOrEqual(0.05);
          continue;
        }

        // (a) AA gradient: each column's transition must pass through
        // intermediate luminance. Hard aliased steps have none.
        expect
          .soft(
            zeroAAFraction,
            `${label}: ${analysis.zeroAAColumns}/${analysis.columnCount} columns cross the edge with NO intermediate luminance (hard aliased edge; median AA px per column ${analysis.medianIntermediate})`
          )
          .toBeLessThanOrEqual(0.1);

        // (b) Chunky steps: quantized edge Y must not sit flat for more than
        // 2x the step length the drawn slope predicts.
        expect
          .soft(
            analysis.maxFlatRun.length,
            `${label}: edge Y flat for ${analysis.maxFlatRun.length} device px starting x=${analysis.maxFlatRun.from} (expected ~${Math.round(expectedStepPx)}px steps for slope ${EDGE_STROKE_SLOPE}; max rise ${analysis.maxRise}px) -- chunky stair-steps`
          )
          .toBeLessThanOrEqual(maxAllowedFlatRun);
      }
    }
  });

  test("scribbling at 1% zoom on a hydrated 78x67-tile layer stays within frame budget", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000);
    await gotoEditor(page);
    await installPerfSpanAggregator(page);

    const tileSrc = await createOpaqueTileDataUrl(page);

    await loadDocument(
      page,
      createDenseSweepDocument(tileSrc, LAG_NODE_WIDTH, LAG_NODE_HEIGHT)
    );
    await setViewport(page, { x: 0, y: 0, zoom: 1 });
    await page.evaluate((targetNodeId) => {
      window.__PUNCHPRESS_EDITOR__?.select(targetNodeId);
    }, NODE_ID);

    // STEADY STATE on purpose (unlike the 3% first-contact test): pre-touch
    // the layer so hydration/decodes are fully prepaid, then wait for frame
    // pacing to go quiet. This test measures per-stroke dab cost only.
    await hydrateRasterStore(page, NODE_ID);
    await centerViewportOn(
      page,
      { x: LAG_NODE_WIDTH / 2, y: LAG_NODE_HEIGHT / 2 },
      LAG_ZOOM
    );
    await waitForAnimationFrames(page, 8);
    await page.screenshot();
    await installFrameLog(page);

    const quiet = await waitForQuietFrames(page);

    console.log(
      `[sweep] 1% lag: hydration settled=${quiet.settled} after ${quiet.attempt} probe windows`
    );

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

    const projection = await getViewportProjection(page, NODE_ID);

    expect(
      projection.zoom,
      `viewer must settle at zoom ${LAG_ZOOM} (got ${projection.zoom})`
    ).toBeCloseTo(LAG_ZOOM, 3);

    // The layer covers ~399x343 CSS px on screen at 1%; scribble inside it.
    // One continuous multi-segment drag crossing the on-screen layer 10
    // times at a vigorous-but-realistic swipe speed: browsers coalesce
    // pointermove to frame cadence, so a fast back-and-forth scribble lands
    // ~70 CSS px per event. Every screen px is 100 layer px, so each event
    // extends the stroke path by ~7000 layer px (~700 dabs at the spacing
    // floor of size * 0.02 = 10) and the whole gesture is ~600k layer px
    // (~60k dabs).
    const centerX = projection.hostLeft + projection.hostWidth / 2;
    const centerY = projection.hostTop + projection.hostHeight / 2;
    const sweepCount = 10;
    const waypoints = Array.from({ length: sweepCount }, (_, sweep) => {
      const direction = sweep % 2 === 0 ? 1 : -1;

      return {
        x: centerX + direction * 170,
        y: centerY + (sweep / (sweepCount - 1) - 0.5) * 240,
      };
    });
    const inkBeforeDrag = await getSurfaceCenterInkCount(page);

    await page.mouse.move(centerX - 170, centerY - 120);
    await resetPerfSpanAggregate(page);
    await resetFrameLog(page);
    await page.mouse.down();

    for (const waypoint of waypoints) {
      // steps 5 across a 340 px sweep = ~68 CSS px per pointermove event.
      await page.mouse.move(waypoint.x, waypoint.y, { steps: 5 });
    }

    const frameDeltas = await readFrameLog(page, true);
    const inkDuringDrag = await getSurfaceCenterInkCount(page);

    await page.mouse.up();

    const perf = await readPerfSpanAggregate(page);

    // Guard: the measured frames must belong to a live painting drag.
    expect(
      inkDuringDrag,
      `drag did not paint (ink before=${inkBeforeDrag}, during=${inkDuringDrag})`
    ).toBeGreaterThan(Math.max(0, inkBeforeDrag) + 2000);

    if (frameDeltas.length < 45) {
      throw new Error(
        `Drag finished in only ${frameDeltas.length} frames; not enough to measure pacing`
      );
    }

    const stats = getFrameStats(frameDeltas);
    const summary =
      `frames=${frameDeltas.length} mean=${stats.mean.toFixed(1)}ms ` +
      `p50=${stats.p50.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms ` +
      `max=${stats.max.toFixed(1)}ms ` +
      `slowest=[${stats.slowest.map((delta) => delta.toFixed(1)).join(", ")}]`;

    console.log(
      `[sweep] steady-state scribble @ zoom ${LAG_ZOOM} dpr 2 (78x67 tiles): ${summary}`
    );

    if (perf.spans.length) {
      for (const span of perf.spans.slice(0, 10)) {
        console.log(
          `[sweep] 1% lag perf span ${span.label}: total=${span.totalMs}ms count=${span.count} max=${span.maxMs}ms`
        );
      }
    } else {
      console.log(
        "[sweep] 1% lag perf spans: none recorded (perf sink saw no measurePerf traffic)"
      );
    }

    if (perf.counters.length) {
      console.log(
        `[sweep] 1% lag perf counters: ${perf.counters
          .map((counter) => `${counter.name}=${counter.count}`)
          .join(" ")}`
      );
    }

    // 30fps p95 floor + a hard hitch ceiling for steady-state stroking.
    expect
      .soft(
        stats.p95,
        `p95 frame time during steady-state 1% scribble too slow: ${summary}`
      )
      .toBeLessThanOrEqual(33);
    expect
      .soft(
        stats.max,
        `worst frame hitch during steady-state 1% scribble: ${summary}`
      )
      .toBeLessThanOrEqual(120);
  });

  test("max zoom probe: log the app's effective zoom ceiling", async ({
    page,
  }) => {
    // No assertions on purpose: this documents how far the editor lets a
    // user zoom in (Photoshop-parity deep zoom needs 32x+). MAX_ZOOM in
    // @punchpress/engine is the viewer's zoomRange ceiling; editor state may
    // accept more than the viewer honors.
    await gotoEditor(page);

    const src = await createTransparentImageDataUrl(page);

    await loadDocument(page, createSweepDocument(src));
    await setViewport(page, { x: 0, y: 0, zoom: 1 });

    for (const requestedZoom of [2, 4, 8, 16, 64]) {
      const probe = await page.evaluate(async (zoom) => {
        const editor = window.__PUNCHPRESS_EDITOR__;

        if (!editor) {
          throw new Error("Expected editor");
        }

        editor.setViewportInteracting(false);
        editor.setViewport({ zoom });
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const editorZoom = editor.zoom;
        const storeZoom = editor.getState?.().viewport?.zoom ?? null;

        editor.viewerRef?.setTo?.({
          x: editor.viewerRef?.getScrollLeft?.() ?? 0,
          y: editor.viewerRef?.getScrollTop?.() ?? 0,
          zoom,
        });
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const viewerZoom = editor.viewerRef?.getZoom?.() ?? null;

        return { editorZoom, storeZoom, viewerZoom };
      }, requestedZoom);

      console.log(
        `[sweep] max-zoom probe requested=${requestedZoom} editor.zoom=${probe.editorZoom} ` +
          `store.viewport.zoom=${probe.storeZoom} viewer.getZoom=${probe.viewerZoom}`
      );
    }

    await setViewport(page, { x: 0, y: 0, zoom: 1 });
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
