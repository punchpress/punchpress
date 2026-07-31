import { expect, test } from "@playwright/test";
import type { RasterPresentationAcknowledgement } from "@punchpress/engine";
import {
  getStateSnapshot,
  gotoEditor,
  loadDocument,
  resetViewport,
  setViewport,
} from "./helpers/editor";

const DOCUMENT_VERSION = "1.8";
const RASTER_TILE_TEST_SIZE = 512;

const transform = (x, y, rotation = 0) => ({
  rotation,
  scaleX: 1,
  scaleY: 1,
  x,
  y,
});

const createArtboardDocument = () =>
  JSON.stringify({
    nodes: [
      {
        background: "#ffffff",
        height: 260,
        id: "artboard-1",
        locked: false,
        name: "Frame 1",
        parentId: "root",
        transform: transform(220, 160),
        type: "artboard",
        visible: true,
        width: 340,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createLargeArtboardDocument = () =>
  JSON.stringify({
    nodes: [
      {
        background: "#ffffff",
        height: 1400,
        id: "artboard-1",
        locked: false,
        name: "Artboard 1",
        parentId: "root",
        transform: transform(420, 160),
        type: "artboard",
        visible: true,
        width: 2200,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createExtremeArtboardDocument = () =>
  JSON.stringify({
    nodes: [
      {
        background: "#ffffff",
        height: 60_000,
        id: "artboard-1",
        locked: false,
        name: "Frame 1",
        parentId: "root",
        transform: transform(0, 0),
        type: "artboard",
        visible: true,
        width: 100_000,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createBloatedArtboardImageDocument = (src) =>
  JSON.stringify({
    nodes: [
      {
        background: "#ffffff",
        height: 260,
        id: "artboard-1",
        locked: false,
        name: "Frame 1",
        parentId: "root",
        transform: transform(220, 160),
        type: "artboard",
        visible: true,
        width: 340,
      },
      {
        assetId: "asset-image-1",
        height: 700,
        id: "image-1",
        mimeType: "image/png",
        name: "Layer",
        opacity: 1,
        parentId: "artboard-1",
        src,
        transform: transform(120, 80),
        type: "image",
        visible: true,
        width: 900,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createLargeImageDocument = (src) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-large-image-1",
        height: 1600,
        id: "large-image-1",
        mimeType: "image/png",
        name: "Large Image",
        opacity: 1,
        parentId: "root",
        src,
        transform: transform(220, 160),
        type: "image",
        visible: true,
        width: 2200,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createSmallImageDocument = (src) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-image-1",
        height: 96,
        id: "image-1",
        mimeType: "image/png",
        name: "Layer",
        opacity: 1,
        parentId: "root",
        src,
        transform: transform(520, 360),
        type: "image",
        visible: true,
        width: 96,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createTwoSmallImageDocument = (src) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-brush-image",
        height: 96,
        id: "brush-image",
        mimeType: "image/png",
        name: "Brush Layer",
        opacity: 1,
        parentId: "root",
        src,
        transform: transform(420, 360),
        type: "image",
        visible: true,
        width: 96,
      },
      {
        assetId: "asset-eraser-image",
        height: 96,
        id: "eraser-image",
        mimeType: "image/png",
        name: "Eraser Layer",
        opacity: 1,
        parentId: "root",
        src,
        transform: transform(660, 360),
        type: "image",
        visible: true,
        width: 96,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createResizedImportedImageDocument = (src) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-image-1",
        height: 5000,
        id: "image-1",
        mimeType: "image/png",
        name: "Imported Image",
        opacity: 1,
        parentId: "root",
        src,
        transform: transform(2500, 800),
        type: "image",
        visible: true,
        width: 5000,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createHugeImageDocument = (src) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-huge-image-1",
        height: 10_800,
        id: "huge-image-1",
        mimeType: "image/png",
        name: "Huge Image",
        opacity: 1,
        parentId: "root",
        src,
        transform: transform(220, 160),
        type: "image",
        visible: true,
        width: 12_400,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const createShapeDocument = () =>
  JSON.stringify({
    nodes: [
      {
        cornerRadius: 0,
        fill: "#3366ff",
        height: 120,
        id: "shape-1",
        opacity: 1,
        parentId: "root",
        shape: "polygon",
        stroke: null,
        strokeWidth: 0,
        transform: transform(320, 240),
        type: "shape",
        visible: true,
        width: 140,
      },
    ],
    version: DOCUMENT_VERSION,
  });

const getCanvasStagePoint = async (page, offset) => {
  const box = await page.getByTestId("canvas-stage").boundingBox();

  if (!box) {
    throw new Error("Missing canvas stage");
  }

  return {
    x: box.x + offset.x,
    y: box.y + offset.y,
  };
};

const getFrameClientPoint = async (page, xRatio, yRatio) => {
  const frameBox = await page
    .locator("[data-artboard-body]")
    .first()
    .boundingBox();

  if (!frameBox) {
    throw new Error("Expected a rendered Frame");
  }

  return {
    x: frameBox.x + frameBox.width * xRatio,
    y: frameBox.y + frameBox.height * yRatio,
  };
};

const setFrameBrushTestZoom = (page) =>
  page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected an editor");
    }

    const frame = editor.nodes.find((node) => node.type === "artboard");
    const bounds = frame ? editor.getNodeRenderFrame(frame.id)?.bounds : null;
    const hostRect = editor.hostRef?.getBoundingClientRect();
    const zoom = 0.1;
    const viewport = {
      ...editor.getState().viewport,
      ...(bounds && hostRect
        ? {
            x: bounds.minX + bounds.width / 2 - hostRect.width / (2 * zoom),
            y: bounds.minY + bounds.height / 2 - hostRect.height / (2 * zoom),
          }
        : {}),
      zoom,
    };

    editor.viewerRef?.setTo?.(viewport);
    editor.setViewport(viewport);
    editor.getState().setViewport(viewport);
    editor.onViewportChange?.();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
  });

const startFrameBrushSession = (page, ratios, { selectFrame = true } = {}) =>
  page.evaluate(
    async ({ nextRatios, shouldSelectFrame }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const brush = editor?.tools.get("brush");
      const frame = editor?.nodes.find((node) => node.type === "artboard");
      const bounds = frame
        ? editor?.getNodeRenderFrame(frame.id)?.bounds
        : null;

      if (!(editor && brush && frame && bounds)) {
        throw new Error("Expected active Frame brush target");
      }

      if (shouldSelectFrame) {
        editor.select(frame.id);
      }
      const toWorldPoint = (ratio) => ({
        x: bounds.minX + (bounds.maxX - bounds.minX) * ratio.x,
        y: bounds.minY + (bounds.maxY - bounds.minY) * ratio.y,
      });
      const [start, ...remaining] = nextRatios;
      const session = brush.beginStroke({ point: toWorldPoint(start) });

      if (!session) {
        throw new Error("Expected Frame brush stroke session");
      }

      window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = session;
      await session.ready;
      for (const ratio of remaining) {
        session.update({ point: toWorldPoint(ratio) });
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    },
    { nextRatios: ratios, shouldSelectFrame: selectFrame }
  );

const completeFrameBrushSession = (page, endRatio) =>
  page.evaluate(async (nextEndRatio) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const frame = editor?.nodes.find((node) => node.type === "artboard");
    const bounds = frame ? editor?.getNodeRenderFrame(frame.id)?.bounds : null;
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(bounds && session)) {
      throw new Error("Expected active Frame brush stroke session");
    }

    await session.complete({
      point: {
        x: bounds.minX + (bounds.maxX - bounds.minX) * nextEndRatio.x,
        y: bounds.minY + (bounds.maxY - bounds.minY) * nextEndRatio.y,
      },
    });
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
  }, endRatio);

const installBrushPerfCapture = async (page) => {
  await page.evaluate(() => {
    window.__PUNCHPRESS_BRUSH_PERF_CAPTURE__ = {
      counters: {},
      spans: {},
    };
    window.__PUNCHPRESS_PERF_SINK__ = {
      incrementCounter(name, amount = 1) {
        const capture = window.__PUNCHPRESS_BRUSH_PERF_CAPTURE__;

        if (!capture) {
          return;
        }

        capture.counters[name] = (capture.counters[name] || 0) + amount;
      },
      recordDuration(label, durationMs) {
        const capture = window.__PUNCHPRESS_BRUSH_PERF_CAPTURE__;

        if (!capture) {
          return;
        }

        capture.spans[label] ||= [];
        capture.spans[label].push(durationMs);
      },
    };
  });
};

const takeBrushPerfCapture = (page) => {
  return page.evaluate(() => {
    const capture = window.__PUNCHPRESS_BRUSH_PERF_CAPTURE__ || {
      counters: {},
      spans: {},
    };

    window.__PUNCHPRESS_PERF_SINK__ = undefined;
    window.__PUNCHPRESS_BRUSH_PERF_CAPTURE__ = undefined;

    return capture;
  });
};

const getBrushPreviewState = (page) => {
  return page.evaluate(() => {
    const preview = document.querySelector<HTMLElement>(
      "[data-brush-preview-node-id]"
    );

    if (!preview) {
      return null;
    }

    return {
      childTag: preview.firstElementChild?.tagName.toLowerCase() || null,
      childCount: preview.children.length,
      baseImageHeight:
        preview
          .querySelector("[data-brush-preview-image]")
          ?.getAttribute("height") || null,
      baseImageWidth:
        preview
          .querySelector("[data-brush-preview-image]")
          ?.getAttribute("width") || null,
      hasBaseImage: Boolean(
        preview.querySelector("[data-brush-preview-image]")
      ),
      height: preview.style.height,
      maxChildHeight: Math.max(
        0,
        ...[...preview.children].map((child) =>
          Number.parseFloat((child as HTMLElement).style.height || "0")
        )
      ),
      maxChildWidth: Math.max(
        0,
        ...[...preview.children].map((child) =>
          Number.parseFloat((child as HTMLElement).style.width || "0")
        )
      ),
      nodeId: preview.dataset.brushPreviewNodeId || null,
      replacesNode: preview.dataset.brushPreviewReplacesNode || null,
      transform: preview.style.transform,
      width: preview.style.width,
    };
  });
};

const getRasterWorkingSurfaceState = (page) => {
  return page.evaluate(() => {
    const surfaces = [
      ...document.querySelectorAll<SVGGElement>(
        "[data-raster-working-surface]"
      ),
    ];
    const tileCanvases = [
      ...document.querySelectorAll("[data-testid='raster-working-tile']"),
    ];
    const canvasSurfaces = [
      ...document.querySelectorAll("[data-testid='raster-working-canvas']"),
    ];

    return {
      canvasCount: canvasSurfaces.length,
      maxCanvasHeight: Math.max(
        0,
        ...[...canvasSurfaces, ...tileCanvases].map((element) =>
          Number.parseFloat(element.getAttribute("height") || "0")
        )
      ),
      maxCanvasWidth: Math.max(
        0,
        ...[...canvasSurfaces, ...tileCanvases].map((element) =>
          Number.parseFloat(element.getAttribute("width") || "0")
        )
      ),
      count: surfaces.length,
      tileCount: tileCanvases.length,
      tileSurfaceCount: surfaces.filter(
        (surface) => surface.dataset.rasterWorkingSurface === "tiles"
      ).length,
      totalTileCount: surfaces.reduce((total, surface) => {
        return (
          total +
          Number.parseInt(surface.dataset.rasterWorkingTileCount || "0", 10)
        );
      }, 0),
    };
  });
};

const getRasterWorkingTileRenderedBounds = (page) => {
  return page.evaluate(() => {
    const tiles = [
      ...document.querySelectorAll<SVGForeignObjectElement>(
        "[data-testid='raster-working-tile']"
      ),
    ];

    if (!tiles.length) {
      return null;
    }

    const bounds = tiles.reduce(
      (currentBounds, tile) => {
        const rect = tile.getBoundingClientRect();

        return {
          bottom: Math.max(currentBounds.bottom, rect.bottom),
          left: Math.min(currentBounds.left, rect.left),
          right: Math.max(currentBounds.right, rect.right),
          top: Math.min(currentBounds.top, rect.top),
        };
      },
      {
        bottom: Number.NEGATIVE_INFINITY,
        left: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
      }
    );

    return {
      ...bounds,
      height: bounds.bottom - bounds.top,
      tileCount: tiles.length,
      width: bounds.right - bounds.left,
    };
  });
};

const getScreenshotDarkPixelStats = async (page, clip) => {
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
      throw new Error("Expected screenshot canvas context");
    }

    context.drawImage(image, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let darkPixelCount = 0;
    let inkWeight = 0;
    let inkWeightedX = 0;
    let inkWeightedY = 0;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;

    for (let index = 0; index < imageData.data.length; index += 4) {
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];
      const alpha = imageData.data[index + 3];
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const pixelIndex = index / 4;
      const x = pixelIndex % canvas.width;
      const y = Math.floor(pixelIndex / canvas.width);

      if (alpha > 200 && luminance < 245) {
        const weight = 255 - luminance;

        inkWeight += weight;
        inkWeightedX += x * weight;
        inkWeightedY += y * weight;
      }

      if (alpha > 200 && red < 48 && green < 48 && blue < 48) {
        darkPixelCount += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    return {
      darkBounds:
        darkPixelCount > 0
          ? {
              height: maxY - minY + 1,
              maxX,
              maxY,
              minX,
              minY,
              width: maxX - minX + 1,
            }
          : null,
      darkPixelCount,
      height: canvas.height,
      inkCentroid:
        inkWeight > 0
          ? {
              x: inkWeightedX / inkWeight,
              y: inkWeightedY / inkWeight,
            }
          : null,
      inkWeight,
      width: canvas.width,
    };
  }, src);
};

const getScreenshotInkPixelStats = async (page, clip) => {
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
      throw new Error("Expected screenshot canvas context");
    }

    context.drawImage(image, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let inkPixelCount = 0;
    let inkWeight = 0;

    for (let index = 0; index < imageData.data.length; index += 4) {
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];
      const alpha = imageData.data[index + 3];
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

      if (alpha > 200 && luminance < 245) {
        inkPixelCount += 1;
        inkWeight += 255 - luminance;
      }
    }

    return {
      height: canvas.height,
      inkPixelCount,
      inkWeight,
      width: canvas.width,
    };
  }, src);
};

const captureScreencastFrames = async (
  page,
  action,
  { postRollMs = 1200, preRollMs = 200 } = {}
) => {
  const client = await page.context().newCDPSession(page);
  const frames: { data: string; timestamp: number }[] = [];
  const ackPromises = new Set<Promise<void>>();

  client.on("Page.screencastFrame", (event) => {
    frames.push({
      data: event.data,
      timestamp: event.metadata?.timestamp || 0,
    });

    const ackPromise: Promise<void> = client
      .send("Page.screencastFrameAck", {
        sessionId: event.sessionId,
      })
      .finally(() => {
        ackPromises.delete(ackPromise);
      });

    ackPromises.add(ackPromise);
  });

  await client.send("Page.startScreencast", {
    everyNthFrame: 1,
    format: "jpeg",
    quality: 80,
  });
  await page.waitForTimeout(preRollMs);

  try {
    await action();
    await page.waitForTimeout(postRollMs);
  } finally {
    await Promise.all([...ackPromises]);
    await client.send("Page.stopScreencast").catch(() => undefined);
  }

  return frames;
};

const getScreencastInkFrameStats = async (page, frames, clip) => {
  return await page.evaluate(
    async ({ clip, frames }) => {
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(clip.width));
      canvas.height = Math.max(1, Math.round(clip.height));

      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        throw new Error("Expected screencast frame canvas context");
      }

      const stats: {
        index: number;
        inkPixelCount: number;
        inkWeight: number;
        timestamp: number;
      }[] = [];

      for (const [index, frame] of frames.entries()) {
        const image = new Image();

        image.src = `data:image/jpeg;base64,${frame.data}`;
        await image.decode();
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
          image,
          clip.x,
          clip.y,
          clip.width,
          clip.height,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );
        let inkPixelCount = 0;
        let inkWeight = 0;

        for (
          let pixelIndex = 0;
          pixelIndex < imageData.data.length;
          pixelIndex += 4
        ) {
          const red = imageData.data[pixelIndex];
          const green = imageData.data[pixelIndex + 1];
          const blue = imageData.data[pixelIndex + 2];
          const alpha = imageData.data[pixelIndex + 3];
          const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

          if (alpha > 200 && luminance < 245) {
            inkPixelCount += 1;
            inkWeight += 255 - luminance;
          }
        }

        stats.push({
          index,
          inkPixelCount,
          inkWeight,
          timestamp: frame.timestamp,
        });
      }

      return stats;
    },
    { clip, frames }
  );
};

const getRasterFrameDiagnostic = async ({
  clip,
  frameIndex,
  page,
  phase,
  strokeIndex,
}) => {
  const pixelStats = await getScreenshotDarkPixelStats(page, clip);
  const state = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const rasterRoot = document.querySelector("[data-raster-node-id]");
    const workingGroup = editor
      ?.getRasterWorkingPresentation?.("huge-image-1")
      ?.groups.at(-1);
    const workingSurfaceElement = document.querySelector(
      "[data-raster-working-surface]"
    );

    return {
      committedTileCount: node?.tileSources?.length || 0,
      exactTileDomCount: document.querySelectorAll("[data-raster-tile-ref]")
        .length,
      exactTilesReady:
        rasterRoot?.getAttribute("data-raster-exact-tiles-ready") || null,
      loadedExactTileCount: Number(
        rasterRoot?.getAttribute("data-raster-loaded-exact-tile-count") || 0
      ),
      node:
        node?.type === "image"
          ? {
              baseX: node.baseX ?? 0,
              baseY: node.baseY ?? 0,
              height: node.height,
              transform: node.transform,
              width: node.width,
            }
          : null,
      previewActive:
        document.querySelector('[data-raster-preview-active="true"]') !== null,
      previewEligible:
        document.querySelector('[data-raster-preview-eligible="true"]') !==
        null,
      previewReady:
        document.querySelector('[data-raster-preview-ready="true"]') !== null,
      presentationOwner:
        rasterRoot?.getAttribute("data-raster-presentation-owner") || null,
      totalTileCount: Number(
        rasterRoot?.getAttribute("data-raster-total-tile-count") || 0
      ),
      viewport: editor?.viewport || null,
      visibleTileCount: Number(
        rasterRoot?.getAttribute("data-raster-visible-tile-count") || 0
      ),
      workingSurfaceCompleted:
        workingSurfaceElement?.getAttribute("data-raster-working-completed") ||
        null,
      workingSurfaceType:
        workingSurfaceElement?.getAttribute("data-raster-working-surface") ||
        null,
      workingTileCount:
        workingGroup?.content.kind === "tiles"
          ? workingGroup.content.tiles.length
          : 0,
      workingTileDomCount: document.querySelectorAll(
        "[data-testid='raster-working-tile']"
      ).length,
    };
  });

  return {
    frameIndex,
    phase,
    pixels: pixelStats,
    state,
    strokeIndex,
  };
};

const getRasterWorkingCanvasPlacement = (page, nodeId = "image-1") => {
  return page.evaluate((targetNodeId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const host = editor?.hostRef;
    const viewer = editor?.viewerRef;
    const workingCanvas = document.querySelector<SVGForeignObjectElement>(
      "[data-testid='raster-working-canvas']"
    );
    const group = editor
      ?.getRasterWorkingPresentation?.(targetNodeId)
      ?.groups.at(-1);

    if (
      !(
        editor &&
        host &&
        viewer &&
        workingCanvas &&
        group?.content.kind === "canvas"
      )
    ) {
      return null;
    }

    const hostRect = host.getBoundingClientRect();
    const rect = workingCanvas.getBoundingClientRect();
    const zoom = editor.zoom || 1;

    return {
      renderedHeight: rect.height / zoom,
      renderedWidth: rect.width / zoom,
      renderedX: viewer.getScrollLeft() + (rect.left - hostRect.left) / zoom,
      renderedY: viewer.getScrollTop() + (rect.top - hostRect.top) / zoom,
      surfaceHeight: group.content.height,
      surfaceMatrix: group.matrix,
      surfaceWidth: group.content.width,
      surfaceX: group.content.x,
      surfaceY: group.content.y,
      type: group.content.kind,
    };
  }, nodeId);
};

const getRasterNodeArtOpacity = (page, nodeId) => {
  return page.evaluate((targetNodeId) => {
    const hitTarget = document.querySelector(
      `[data-node-id="${targetNodeId}"]`
    );
    const shell = hitTarget?.parentElement;
    const artGroup = shell?.querySelector("svg > g");

    return artGroup?.getAttribute("opacity") || null;
  }, nodeId);
};

const getRasterShellState = (page) => {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(
      "[data-node-shell='true']"
    );

    if (!shell) {
      return null;
    }

    return {
      height: shell.style.height,
      transform: shell.style.transform,
      width: shell.style.width,
    };
  });
};

const parsePixelSize = (value) => Number.parseFloat(value || "0");

const getRasterToolSettings = (page, tool = "brush") => {
  return page.evaluate((toolId) => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    return editor?.getBrushToolSettings?.(toolId) || null;
  }, tool);
};

const getCommittedImageSample = (page, samplePoint) => {
  return page.evaluate(async (point) => {
    const imageNode = window.__PUNCHPRESS_EDITOR__?.nodes.find(
      (node) => node.type === "image"
    );

    if (!imageNode?.src) {
      return null;
    }

    const loadImage = async (src) => {
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      image.src = src;
      await loaded;
      return image;
    };
    const image = await loadImage(imageNode.src);
    const tileImages = await Promise.all(
      (imageNode.tileSources || []).map(async (tile) => ({
        image: await loadImage(tile.src),
        tile,
      }))
    );
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    const x = Math.max(0, Math.min(imageNode.width - 1, point.x));
    const y = Math.max(0, Math.min(imageNode.height - 1, point.y));
    const drawSample = (sourceImage, sourceRect) => {
      if (
        x < sourceRect.x ||
        y < sourceRect.y ||
        x >= sourceRect.x + sourceRect.width ||
        y >= sourceRect.y + sourceRect.height
      ) {
        return;
      }

      const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
      const sourceHeight = sourceImage.naturalHeight || sourceImage.height;
      const sourceX = Math.max(
        0,
        Math.min(
          sourceWidth - 1,
          Math.floor(((x - sourceRect.x) / sourceRect.width) * sourceWidth)
        )
      );
      const sourceY = Math.max(
        0,
        Math.min(
          sourceHeight - 1,
          Math.floor(((y - sourceRect.y) / sourceRect.height) * sourceHeight)
        )
      );

      context.drawImage(sourceImage, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
    };

    if (tileImages.length) {
      drawSample(image, {
        height: imageNode.baseHeight ?? imageNode.height,
        width: imageNode.baseWidth ?? imageNode.width,
        x: imageNode.baseX ?? 0,
        y: imageNode.baseY ?? 0,
      });
    } else {
      drawSample(image, {
        height: imageNode.height,
        width: imageNode.width,
        x: 0,
        y: 0,
      });
    }

    for (const { image: tileImage, tile } of tileImages) {
      drawSample(tileImage, tile);
    }

    const data = [...context.getImageData(0, 0, 1, 1).data];

    return {
      a: data[3],
      b: data[2],
      g: data[1],
      imageHeight: imageNode.height,
      imageWidth: imageNode.width,
      r: data[0],
    };
  }, samplePoint);
};

const getCommittedImageSampleAtClientPoint = (page, clientPoint) => {
  return page.evaluate(async (point) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const imageNode = editor?.nodes.find((node) => node.type === "image");
    const host = editor?.hostRef;
    const viewer = editor?.viewerRef;

    if (!(imageNode?.src && host && viewer)) {
      return null;
    }

    const hostRect = host.getBoundingClientRect();
    const canvasPoint = {
      x: viewer.getScrollLeft() + (point.x - hostRect.left) / editor.zoom,
      y: viewer.getScrollTop() + (point.y - hostRect.top) / editor.zoom,
    };
    const rotation = ((imageNode.transform.rotation || 0) * Math.PI) / 180;
    const scaleX = imageNode.transform.scaleX || 1;
    const scaleY = imageNode.transform.scaleY || 1;
    const localCenter = {
      x: imageNode.width / 2,
      y: imageNode.height / 2,
    };
    const worldCenter = {
      x: imageNode.transform.x + localCenter.x,
      y: imageNode.transform.y + localCenter.y,
    };
    const offsetX = canvasPoint.x - worldCenter.x;
    const offsetY = canvasPoint.y - worldCenter.y;
    const localPoint = {
      x: Math.round(
        localCenter.x +
          (offsetX * Math.cos(-rotation) - offsetY * Math.sin(-rotation)) /
            scaleX
      ),
      y: Math.round(
        localCenter.y +
          (offsetX * Math.sin(-rotation) + offsetY * Math.cos(-rotation)) /
            scaleY
      ),
    };
    const residentCanvas = editor.rasterSurface?.getPresentation?.(
      imageNode.id
    )?.canvas;

    if (residentCanvas && !imageNode.tileSources?.length) {
      const context = residentCanvas.getContext("2d");
      const sampleX = Math.max(
        0,
        Math.min(
          residentCanvas.width - 1,
          localPoint.x - (imageNode.baseX ?? 0)
        )
      );
      const sampleY = Math.max(
        0,
        Math.min(
          residentCanvas.height - 1,
          localPoint.y - (imageNode.baseY ?? 0)
        )
      );
      const data = context?.getImageData(sampleX, sampleY, 1, 1).data;

      return data
        ? {
            a: data[3],
            b: data[2],
            g: data[1],
            imageHeight: imageNode.height,
            imageWidth: imageNode.width,
            r: data[0],
          }
        : null;
    }

    const loadImage = async (src) => {
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      image.src = src;
      await loaded;
      return image;
    };
    const image = await loadImage(imageNode.src);
    const tileImages = await Promise.all(
      (imageNode.tileSources || []).map(async (tile) => ({
        image: await loadImage(tile.src),
        tile,
      }))
    );
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    const x = Math.max(0, Math.min(imageNode.width - 1, localPoint.x));
    const y = Math.max(0, Math.min(imageNode.height - 1, localPoint.y));
    const drawSample = (sourceImage, sourceRect) => {
      if (
        x < sourceRect.x ||
        y < sourceRect.y ||
        x >= sourceRect.x + sourceRect.width ||
        y >= sourceRect.y + sourceRect.height
      ) {
        return;
      }

      const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
      const sourceHeight = sourceImage.naturalHeight || sourceImage.height;
      const sourceX = Math.max(
        0,
        Math.min(
          sourceWidth - 1,
          Math.floor(((x - sourceRect.x) / sourceRect.width) * sourceWidth)
        )
      );
      const sourceY = Math.max(
        0,
        Math.min(
          sourceHeight - 1,
          Math.floor(((y - sourceRect.y) / sourceRect.height) * sourceHeight)
        )
      );

      context.drawImage(sourceImage, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
    };

    if (tileImages.length) {
      drawSample(image, {
        height: imageNode.baseHeight ?? imageNode.height,
        width: imageNode.baseWidth ?? imageNode.width,
        x: imageNode.baseX ?? 0,
        y: imageNode.baseY ?? 0,
      });
    } else {
      drawSample(image, {
        height: imageNode.height,
        width: imageNode.width,
        x: 0,
        y: 0,
      });
    }

    for (const { image: tileImage, tile } of tileImages) {
      drawSample(tileImage, tile);
    }

    const data = [...context.getImageData(0, 0, 1, 1).data];

    return {
      a: data[3],
      b: data[2],
      g: data[1],
      imageHeight: imageNode.height,
      imageWidth: imageNode.width,
      localX: x,
      localY: y,
      r: data[0],
    };
  }, clientPoint);
};

const getCommittedImageState = (page) => {
  return page.evaluate(() => {
    const imageNode = window.__PUNCHPRESS_EDITOR__?.nodes.find(
      (node) => node.type === "image"
    );

    if (!imageNode) {
      return null;
    }

    return {
      baseHeight: imageNode.baseHeight,
      baseWidth: imageNode.baseWidth,
      baseX: imageNode.baseX,
      baseY: imageNode.baseY,
      height: imageNode.height,
      id: imageNode.id,
      parentId: imageNode.parentId,
      src: imageNode.src || "",
      tileSourceCount: imageNode.tileSources?.length || 0,
      tileSources: imageNode.tileSources || [],
      transform: imageNode.transform,
      width: imageNode.width,
      x: imageNode.transform.x,
      y: imageNode.transform.y,
    };
  });
};

const loadRasterTestDocument = async (page, contents) => {
  await loadDocument(page, contents);
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
};

const createOpaqueImageDataUrl = (page) => {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext("2d");

    if (!context) {
      return "";
    }

    context.fillStyle = "#111111";
    context.fillRect(0, 0, 1, 1);

    return canvas.toDataURL("image/png");
  });
};

const createTransparentImageDataUrl = (page) => {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    return canvas.toDataURL("image/png");
  });
};

const createWhiteImageDataUrl = (page) => {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext("2d");

    if (!context) {
      return "";
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 1, 1);

    return canvas.toDataURL("image/png");
  });
};

const getCommittedTileSamples = (page, points) => {
  return page.evaluate(async (samplePoints) => {
    const imageNode = window.__PUNCHPRESS_EDITOR__?.nodes.find(
      (node) => node.type === "image"
    );

    if (!imageNode) {
      return null;
    }

    const loadImage = async (src) => {
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      image.src = src;
      await loaded;
      return image;
    };
    const tileImages = await Promise.all(
      (imageNode.tileSources || []).map(async (tile) => ({
        image: await loadImage(tile.src),
        tile,
      }))
    );

    return samplePoints.map((point) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      const coveringTiles = tileImages.filter(({ tile }) => {
        return (
          point.x >= tile.x &&
          point.y >= tile.y &&
          point.x < tile.x + tile.width &&
          point.y < tile.y + tile.height
        );
      });

      if (context) {
        for (const { image, tile } of coveringTiles) {
          context.drawImage(image, tile.x - point.x, tile.y - point.y);
        }
      }

      const data = context
        ? [...context.getImageData(0, 0, 1, 1).data]
        : [0, 0, 0, 0];

      return {
        a: data[3],
        b: data[2],
        coveringTileCount: coveringTiles.length,
        g: data[1],
        r: data[0],
        x: point.x,
        y: point.y,
      };
    });
  }, points);
};

const setBrushSliderValue = async (page, name, value) => {
  const slider = page.getByRole("slider", { exact: true, name });

  await slider.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type(String(value));
  await page.keyboard.press("Enter");
};

const setBrushHexColor = async (page, hex) => {
  const colorInput = page.getByLabel("Hex color");

  await colorInput.fill(hex.replace("#", ""));
  await colorInput.blur();
};

const dragBrush = async (page, points, { release = true, steps = 8 } = {}) => {
  const [start, ...rest] = points;

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  for (const point of rest) {
    await page.mouse.move(point.x, point.y, { steps });
  }

  if (release) {
    await page.mouse.up();
  }
};

const gotoRasterFrameEditor = async (page) => {
  await gotoEditor(page);
  await loadRasterTestDocument(page, createArtboardDocument());
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.clearSelection();
  });
};

test("brush shows a footprint cursor over the canvas", async ({ page }) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  const point = await getCanvasStagePoint(page, { x: 320, y: 240 });
  await page.mouse.move(point.x, point.y);

  const cursor = page.getByTestId("brush-cursor");

  await expect(cursor).toBeVisible();
  await expect
    .poll(async () =>
      cursor.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        width: element.getBoundingClientRect().width,
      }))
    )
    .toEqual({
      height: 24,
      width: 24,
    });
});

test("brush cursor appears immediately when switching tools under the pointer", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);

  const point = await getCanvasStagePoint(page, { x: 320, y: 240 });
  await page.mouse.move(point.x, point.y);

  await expect(page.getByTestId("brush-cursor")).toBeHidden();

  await page.keyboard.press("b");

  await expect(page.getByTestId("brush-cursor")).toBeVisible();
});

test("brush properties update settings and the brush cursor", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  await expect(page.getByText("Brush")).toBeVisible();

  await setBrushHexColor(page, "#FF0033");
  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 50);
  await setBrushSliderValue(page, "Brush hardness", 25);
  await setBrushSliderValue(page, "Brush spacing", 150);

  await expect
    .poll(() => getRasterToolSettings(page, "brush"))
    .toMatchObject({
      color: "#FF0033",
      hardness: 0.25,
      opacity: 0.5,
      size: 40,
      spacing: 1.5,
    });

  const point = await getCanvasStagePoint(page, { x: 320, y: 240 });
  await page.mouse.move(point.x, point.y);

  await expect
    .poll(async () =>
      page.getByTestId("brush-cursor").evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        width: element.getBoundingClientRect().width,
      }))
    )
    .toEqual({
      height: 40,
      width: 40,
    });
});

test("brush and eraser remember separate raster settings", async ({ page }) => {
  await gotoRasterFrameEditor(page);

  await page.keyboard.press("b");
  await expect(page.getByText("Brush")).toBeVisible();
  await setBrushSliderValue(page, "Brush hardness", 0);
  await setBrushSliderValue(page, "Brush size", 40);

  await page.keyboard.press("e");
  await expect(page.getByText("Eraser")).toBeVisible();
  await setBrushSliderValue(page, "Brush hardness", 100);
  await setBrushSliderValue(page, "Brush size", 80);

  await expect
    .poll(() => getRasterToolSettings(page, "brush"))
    .toMatchObject({
      hardness: 0,
      size: 40,
    });
  await expect
    .poll(() => getRasterToolSettings(page, "eraser"))
    .toMatchObject({
      hardness: 1,
      size: 80,
    });

  await page.keyboard.press("b");
  await expect(page.getByText("Brush")).toBeVisible();
  await expect(page.getByLabel("Brush size").getByText("40")).toBeVisible();
  await expect(page.getByLabel("Brush hardness").getByText("0%")).toBeVisible();

  await page.keyboard.press("e");
  await expect(page.getByText("Eraser")).toBeVisible();
  await expect(page.getByLabel("Brush size").getByText("80")).toBeVisible();
  await expect(
    page.getByLabel("Brush hardness").getByText("100%")
  ).toBeVisible();
});

test("brush properties affect subsequently committed pixels", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  await setBrushHexColor(page, "#FF0033");
  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 50);
  await setBrushSliderValue(page, "Brush hardness", 100);
  await setBrushSliderValue(page, "Brush spacing", 200);

  const start = await getCanvasStagePoint(page, { x: 320, y: 240 });
  const end = await getCanvasStagePoint(page, { x: 440, y: 240 });

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 1 });
  await page.mouse.up();

  const centerSample = await getCommittedImageSample(page, { x: 20, y: 20 });
  const gapSample = await getCommittedImageSample(page, { x: 50, y: 20 });

  expect(centerSample).toMatchObject({
    g: 0,
    imageHeight: 40,
    r: 255,
  });
  expect(centerSample?.a).toBeGreaterThan(100);
  expect(centerSample?.a).toBeLessThan(255);
  expect(centerSample?.b).toBeGreaterThan(45);
  expect(centerSample?.b).toBeLessThan(56);
  expect(centerSample?.imageWidth).toBeGreaterThan(120);
  expect(gapSample?.a).toBe(0);
});

test("brush writes into a raster working surface before pointerup", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  const start = await getCanvasStagePoint(page, { x: 320, y: 240 });
  const end = await getCanvasStagePoint(page, { x: 480, y: 240 });

  await dragBrush(page, [start, end], { release: false });

  await expect.poll(() => getBrushPreviewState(page)).toBeNull();
  await expect
    .poll(() => getRasterWorkingSurfaceState(page))
    .toMatchObject({
      canvasCount: 1,
      count: 1,
    });

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return {
        imageCount: state.nodes.filter((node) => node.type === "image").length,
        selectedCount: state.selectedNodeIds.length,
      };
    })
    .toEqual({
      imageCount: 1,
      selectedCount: 1,
    });

  await page.mouse.up();

  await expect.poll(() => getBrushPreviewState(page)).toBeNull();
  await expect
    .poll(() => getRasterWorkingSurfaceState(page))
    .toMatchObject({
      count: 0,
    });
});

test("eraser removes committed brush pixels through the shared brush path", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 72);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const start = await getCanvasStagePoint(page, { x: 320, y: 260 });
  const end = await getCanvasStagePoint(page, { x: 520, y: 260 });
  const samplePoint = await getCanvasStagePoint(page, { x: 420, y: 260 });

  await dragBrush(page, [start, end]);

  const beforeErase = await getCommittedImageSampleAtClientPoint(
    page,
    samplePoint
  );

  await page.keyboard.press("e");
  await setBrushSliderValue(page, "Brush size", 72);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);
  await dragBrush(page, [samplePoint, samplePoint]);

  const afterErase = await getCommittedImageSampleAtClientPoint(
    page,
    samplePoint
  );

  expect(beforeErase?.a).toBe(255);
  expect(afterErase?.a).toBe(0);
});

test("soft eraser opacity reduces alpha with brush falloff", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 100);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const paintPoint = await getCanvasStagePoint(page, { x: 420, y: 300 });

  await dragBrush(page, [paintPoint, paintPoint]);

  await page.keyboard.press("e");
  await setBrushSliderValue(page, "Brush size", 100);
  await setBrushSliderValue(page, "Brush opacity", 50);
  await setBrushSliderValue(page, "Brush hardness", 0);

  const edgePoint = await getCanvasStagePoint(page, { x: 460, y: 300 });

  await dragBrush(page, [paintPoint, paintPoint]);

  const centerSample = await getCommittedImageSampleAtClientPoint(
    page,
    paintPoint
  );
  const edgeSample = await getCommittedImageSampleAtClientPoint(
    page,
    edgePoint
  );

  expect(centerSample?.a).toBeGreaterThan(100);
  expect(centerSample?.a).toBeLessThan(255);
  expect(edgeSample?.a).toBeGreaterThan(centerSample?.a || 0);
  expect(edgeSample?.a).toBeLessThan(255);
});

test("brush can start on an artboard body", async ({ page }) => {
  await gotoEditor(page);
  await loadRasterTestDocument(page, createArtboardDocument());
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("artboard-1");
  });
  await page.keyboard.press("b");

  const point = await getCanvasStagePoint(page, { x: 320, y: 240 });

  await dragBrush(page, [point, point]);

  const imageState = await getCommittedImageState(page);

  expect(imageState?.parentId).toBe("artboard-1");

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      const imageNodes = state.nodes.filter((node) => node.type === "image");

      return {
        artboardCount: state.nodes.filter((node) => node.type === "artboard")
          .length,
        imageCount: imageNodes.length,
        selectedNodeIds: state.selectedNodeIds,
      };
    })
    .toEqual({
      artboardCount: 1,
      imageCount: 1,
      selectedNodeIds: expect.any(Array),
    });

  const sample = await getCommittedImageSampleAtClientPoint(page, point);

  expect(sample?.a).toBe(255);
});

test("Frame Raster accepts a later stroke beyond its initial content bounds", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.getByRole("button", { name: "Add artboard" }).click();
  await setFrameBrushTestZoom(page);
  await expect
    .poll(async () => {
      const box = await page
        .locator("[data-artboard-body]")
        .first()
        .boundingBox();
      const viewport = page.viewportSize();

      return Boolean(
        box &&
          viewport &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width &&
          box.y + box.height <= viewport.height
      );
    })
    .toBe(true);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const firstPoint = await getFrameClientPoint(page, 0.2, 0.2);
  const secondPoint = await getFrameClientPoint(page, 0.78, 0.72);

  await dragBrush(page, [firstPoint, firstPoint]);
  await expect.poll(() => getCommittedImageState(page)).not.toBeNull();

  const firstState = await getCommittedImageState(page);

  expect(firstState?.parentId).not.toBe("root");
  expect(firstState?.width).toBeLessThan(300);
  expect(firstState?.height).toBeLessThan(300);

  await dragBrush(page, [secondPoint, secondPoint]);
  await expect
    .poll(async () => (await getCommittedImageState(page))?.width)
    .toBeGreaterThan(firstState?.width || 0);

  const secondState = await getCommittedImageState(page);
  const firstSample = await getCommittedImageSampleAtClientPoint(
    page,
    firstPoint
  );
  const secondSample = await getCommittedImageSampleAtClientPoint(
    page,
    secondPoint
  );
  const state = await getStateSnapshot(page);

  expect(secondState?.id).toBe(firstState?.id);
  expect(state.nodes.filter((node) => node.type === "image")).toHaveLength(1);
  expect(secondState?.width).toBeGreaterThan(firstState?.width || 0);
  expect(secondState?.height).toBeGreaterThan(firstState?.height || 0);
  expect(secondState?.tileSourceCount).toBeGreaterThan(0);
  expect(firstSample?.a).toBe(255);
  expect(secondSample?.a).toBe(255);
});

test("canvas-backed Frame Raster stays aligned while expanding into its writable boundary", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 260,
          id: "artboard-1",
          locked: false,
          name: "Frame 1",
          parentId: "root",
          transform: transform(220, 160),
          type: "artboard",
          visible: true,
          width: 340,
        },
        {
          assetId: "asset-image-1",
          baseHeight: 80,
          baseWidth: 80,
          baseX: 1,
          baseY: 1,
          height: 80,
          id: "image-1",
          mimeType: "image/png",
          name: "Layer",
          opacity: 1,
          parentId: "artboard-1",
          src,
          transform: transform(452, 312),
          type: "image",
          visible: true,
          width: 80,
        },
      ],
      version: DOCUMENT_VERSION,
    })
  );
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("image-1");
  });
  await page.keyboard.press("b");
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 40,
        smoothing: 0.1,
        spacing: 0,
      },
      "brush"
    );
  });

  const start = await getFrameClientPoint(page, 0.8, 0.8);
  const expanded = await getFrameClientPoint(page, 0.03, 0.03);
  const end = await getFrameClientPoint(page, 0.2, 0.8);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(expanded.x, expanded.y);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

  await expect
    .poll(() => getRasterWorkingSurfaceState(page))
    .toMatchObject({ canvasCount: 1 });

  const expansionState = await page.evaluate((clientPoint) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const session = brush?.activeSession?.delegate;
    const raster = editor?.nodes.find((node) => node.type === "image");
    const hostRect = editor?.hostRef?.getBoundingClientRect();

    if (!(editor?.viewerRef && session && raster && hostRect)) {
      throw new Error("Expected an expanded canvas-backed Frame Raster");
    }

    const worldPoint = {
      x:
        editor.viewerRef.getScrollLeft() +
        (clientPoint.x - hostRect.left) / editor.zoom,
      y:
        editor.viewerRef.getScrollTop() +
        (clientPoint.y - hostRect.top) / editor.zoom,
    };
    const localPoint = session.getLocalPoint(worldPoint);
    const writableBounds = editor.getRasterWritableBounds(raster.id);
    const group = editor
      .getRasterWorkingPresentation?.(raster.id)
      ?.groups.at(-1);

    return {
      expectedLocalPoint: {
        x: worldPoint.x - raster.transform.x - session.canvasInputOffset.x,
        y: worldPoint.y - raster.transform.y - session.canvasInputOffset.y,
      },
      localPoint,
      presentationBounds: group?.bounds || null,
      writableBounds,
    };
  }, end);

  expect(expansionState.localPoint.x).toBeCloseTo(
    expansionState.expectedLocalPoint.x,
    4
  );
  expect(expansionState.localPoint.y).toBeCloseTo(
    expansionState.expectedLocalPoint.y,
    4
  );
  expect(expansionState.presentationBounds).toEqual(
    expansionState.writableBounds
      ? {
          height: expansionState.writableBounds.height,
          maxX:
            expansionState.writableBounds.x +
            expansionState.writableBounds.width,
          maxY:
            expansionState.writableBounds.y +
            expansionState.writableBounds.height,
          minX: expansionState.writableBounds.x,
          minY: expansionState.writableBounds.y,
          width: expansionState.writableBounds.width,
        }
      : null
  );

  await page.mouse.move(end.x, end.y);
  await page.mouse.up();

  await expect
    .poll(() => getRasterWorkingSurfaceState(page))
    .toMatchObject({ count: 0 });

  const [expandedSample, endSample] = await Promise.all([
    getCommittedImageSampleAtClientPoint(page, expanded),
    getCommittedImageSampleAtClientPoint(page, end),
  ]);

  expect(expandedSample?.a).toBe(255);
  expect(endSample?.a).toBe(255);
});

test("Frame Raster stays stationary when an active tiled stroke commits", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.getByRole("button", { name: "Add artboard" }).click();
  await setFrameBrushTestZoom(page);
  await page.keyboard.press("b");
  await expect(page.getByRole("heading", { name: "Brush" })).toBeVisible();

  const strokeRatios = [
    { x: 0.5, y: 0.5 },
    { x: 0.35, y: 0.3 },
    { x: 0.65, y: 0.3 },
    { x: 0.65, y: 0.65 },
    { x: 0.35, y: 0.65 },
    { x: 0.55, y: 0.42 },
  ];
  const clipStart = await getFrameClientPoint(page, 0.25, 0.2);
  const clipEnd = await getFrameClientPoint(page, 0.75, 0.75);
  const inkClip = {
    height: Math.round(clipEnd.y - clipStart.y),
    width: Math.round(clipEnd.x - clipStart.x),
    x: Math.round(clipStart.x),
    y: Math.round(clipStart.y),
  };

  await startFrameBrushSession(page, strokeRatios);

  await expect
    .poll(() => getRasterWorkingSurfaceState(page))
    .toMatchObject({ tileSurfaceCount: 1 });
  const activeInk = await getScreenshotDarkPixelStats(page, inkClip);

  await completeFrameBrushSession(page, strokeRatios.at(-1));
  await expect
    .poll(() => getRasterWorkingSurfaceState(page))
    .toMatchObject({ count: 0 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
  const committedInk = await getScreenshotDarkPixelStats(page, inkClip);

  expect(activeInk.darkPixelCount).toBeGreaterThan(200);
  expect(committedInk.darkPixelCount).toBeGreaterThan(200);
  expect(activeInk.darkBounds).not.toBeNull();
  expect(committedInk.darkBounds).not.toBeNull();
  for (const edge of ["minX", "minY", "maxX", "maxY"] as const) {
    expect(
      Math.abs(committedInk.darkBounds[edge] - activeInk.darkBounds[edge])
    ).toBeLessThanOrEqual(1);
  }
});

test("a Frame Raster expands across distant low-zoom strokes", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.getByRole("button", { name: "Add artboard" }).click();
  await setFrameBrushTestZoom(page);
  await page.keyboard.press("b");
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setBrushSettings(
      { hardness: 1, opacity: 1, size: 100, spacing: 0 },
      "brush"
    );
  });

  const firstStroke = [
    { x: 0.2, y: 0.65 },
    { x: 0.25, y: 0.7 },
  ];
  const secondStroke = [
    { x: 0.75, y: 0.35 },
    { x: 0.8, y: 0.4 },
  ];

  await startFrameBrushSession(page, firstStroke);
  await completeFrameBrushSession(page, firstStroke.at(-1));
  const firstNode = await page.evaluate(() => {
    const raster = window.__PUNCHPRESS_EDITOR__?.nodes.find(
      (node) => node.type === "image"
    );

    return raster
      ? { height: raster.height, id: raster.id, width: raster.width }
      : null;
  });

  await startFrameBrushSession(page, secondStroke, { selectFrame: false });
  const activeSurface = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const raster = editor?.nodes.find((node) => node.type === "image");

    return raster
      ? editor?.getRasterWorkingPresentation?.(raster.id)?.groups.at(-1)
      : null;
  });
  await completeFrameBrushSession(page, secondStroke.at(-1));

  const { committedNode, localPoints } = await page.evaluate(
    ({ firstRatio, secondRatio }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const frame = editor?.nodes.find((node) => node.type === "artboard");
      const raster = editor?.nodes.find((node) => node.type === "image");
      const bounds = frame
        ? editor?.getNodeRenderFrame(frame.id)?.bounds
        : null;

      if (!(bounds && raster?.type === "image")) {
        throw new Error("Expected committed Frame Raster");
      }

      const toLocalPoint = (ratio) => ({
        x:
          bounds.minX +
          (bounds.maxX - bounds.minX) * ratio.x -
          raster.transform.x,
        y:
          bounds.minY +
          (bounds.maxY - bounds.minY) * ratio.y -
          raster.transform.y,
      });

      return {
        committedNode: {
          height: raster.height,
          id: raster.id,
          width: raster.width,
        },
        localPoints: [toLocalPoint(firstRatio), toLocalPoint(secondRatio)],
      };
    },
    {
      firstRatio: firstStroke.at(-1),
      secondRatio: secondStroke.at(-1),
    }
  );
  const [firstSample, secondSample] =
    (await getCommittedTileSamples(page, localPoints)) || [];

  expect(activeSurface).toMatchObject({
    allowOverflow: true,
    content: { kind: "tiles" },
  });
  expect(committedNode?.id).toBe(firstNode?.id);
  expect(committedNode?.width).toBeGreaterThan(firstNode?.width || 0);
  expect(committedNode?.height).toBeGreaterThan(firstNode?.height || 0);
  expect(firstSample?.a).toBeGreaterThan(240);
  expect(secondSample?.a).toBeGreaterThan(240);
});

test("rapid Frame strokes queue on their pointer-down Raster target", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 5400,
          id: "queued-frame",
          locked: false,
          name: "Queued Frame",
          parentId: "root",
          transform: transform(0, 0),
          type: "artboard",
          visible: true,
          width: 4500,
        },
      ],
      version: DOCUMENT_VERSION,
    })
  );
  await setFrameBrushTestZoom(page);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const frame = editor?.getNode("queued-frame");
    const bounds = editor?.getNodeRenderFrame("queued-frame")?.bounds;

    if (!(editor && brush && frame?.type === "artboard" && bounds)) {
      throw new Error("Expected a large Frame brush target");
    }

    editor.select(frame.id);
    editor.setActiveTool("brush");
    editor.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 100,
        smoothing: 0,
        spacing: 0,
      },
      "brush"
    );
    const toWorldPoint = (ratio) => ({
      x: bounds.minX + bounds.width * ratio.x,
      y: bounds.minY + bounds.height * ratio.y,
    });
    const firstRatios = [
      { x: 0.5, y: 0.5 },
      { x: 0.02, y: 0.02 },
      { x: 0.98, y: 0.02 },
      { x: 0.98, y: 0.98 },
      { x: 0.02, y: 0.98 },
    ];
    const first = brush.beginStroke({
      point: toWorldPoint(firstRatios[0]),
    });

    if (!first) {
      throw new Error("Expected the first Frame stroke");
    }

    for (const ratio of firstRatios.slice(1)) {
      first.update({ point: toWorldPoint(ratio) });
    }
    const firstGroup = brush
      .getWorkingGroups()
      .find((group) => group.content.kind === "tiles");
    const firstTileCount =
      firstGroup?.content.kind === "tiles"
        ? firstGroup.content.tiles.length
        : 0;
    const acknowledgePresentation =
      editor.acknowledgeRasterPresentation.bind(editor);

    editor.acknowledgeRasterPresentation = () => false;
    const firstCommit = first.complete({
      point: toWorldPoint(firstRatios.at(-1)),
    });
    const secondStart = { x: 0.78, y: 0.78 };
    const secondEnd = { x: 0.85, y: 0.85 };
    const second = brush.beginStroke({
      point: toWorldPoint(secondStart),
    });

    if (!second) {
      throw new Error("Expected the queued Frame stroke");
    }

    const activatedBeforeFirstCommit = Boolean(second.delegate);
    second.update({ point: toWorldPoint(secondEnd) });
    const secondCommit = second.complete({
      point: toWorldPoint(secondEnd),
    });
    const thirdStart = { x: 0.2, y: 0.75 };
    const thirdEnd = { x: 0.25, y: 0.8 };
    const third = brush.beginStroke({
      point: toWorldPoint(thirdStart),
    });

    if (!third) {
      throw new Error("Expected the third queued Frame stroke");
    }

    const thirdActivatedBeforeSecondCommit = Boolean(third.delegate);
    third.update({ point: toWorldPoint(thirdEnd) });
    const thirdCommit = third.complete({
      point: toWorldPoint(thirdEnd),
    });

    editor.select(frame.id);

    await firstCommit;
    await secondCommit;
    await thirdCommit;

    const rasters = editor.nodes.filter(
      (node) => node.type === "image" && node.parentId === frame.id
    );
    const raster = rasters[0];

    if (raster?.type !== "image") {
      throw new Error("Expected the committed Frame Raster");
    }

    const pendingGroups = brush
      .getWorkingGroups()
      .filter((group) => group.nodeId === raster.id);
    const pendingCommitTileRefs = new Set(
      pendingGroups.flatMap((group) => group.replacement?.resourceIds || [])
    );

    editor.acknowledgeRasterPresentation = acknowledgePresentation;
    for (const group of pendingGroups) {
      if (group.replacement) {
        acknowledgePresentation({
          commitId: group.replacement.commitId,
          groupId: group.groupId,
          nodeId: group.nodeId,
        });
      }
    }

    return {
      activatedBeforeFirstCommit,
      combinedCommitTileRefCount: pendingCommitTileRefs.size,
      firstTileCount,
      pendingCommitTileRefCount: pendingCommitTileRefs.size,
      rasterCount: rasters.length,
      thirdActivatedBeforeSecondCommit,
      localPoints: [firstRatios.at(-1), secondEnd, thirdEnd].map((ratio) => ({
        x: toWorldPoint(ratio).x - raster.transform.x,
        y: toWorldPoint(ratio).y - raster.transform.y,
      })),
    };
  });
  const samples = await getCommittedTileSamples(page, result.localPoints);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__PUNCHPRESS_EDITOR__
            ?.getRasterWorkingPresentations?.()
            .flatMap((presentation) => presentation.groups).length || 0
      )
    )
    .toBe(0);
  expect(result.activatedBeforeFirstCommit, JSON.stringify(result)).toBe(false);
  expect(result.thirdActivatedBeforeSecondCommit, JSON.stringify(result)).toBe(
    false
  );
  expect(result.combinedCommitTileRefCount).toBe(
    result.pendingCommitTileRefCount
  );
  expect(result.combinedCommitTileRefCount).toBeGreaterThan(0);
  expect(result.rasterCount).toBe(1);
  expect(samples?.[0]?.a).toBeGreaterThan(240);
  expect(samples?.[1]?.a).toBeGreaterThan(240);
  expect(samples?.[2]?.a).toBeGreaterThan(240);
});

test("rapid Brush to Eraser switching waits for the shared Raster commit", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 5400,
          id: "shared-runtime-frame",
          locked: false,
          name: "Shared Runtime Frame",
          parentId: "root",
          transform: transform(0, 0),
          type: "artboard",
          visible: true,
          width: 4500,
        },
      ],
      version: DOCUMENT_VERSION,
    })
  );
  await setFrameBrushTestZoom(page);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const eraser = editor?.tools.get("eraser");
    const frame = editor?.getNode("shared-runtime-frame");
    const bounds = editor?.getNodeRenderFrame(frame?.id)?.bounds;

    if (!(editor && brush && eraser && frame?.type === "artboard" && bounds)) {
      throw new Error("Expected shared Raster runtime tools and Frame");
    }

    editor.select(frame.id);
    editor.setActiveTool("brush");
    editor.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 100,
        smoothing: 0,
        spacing: 0,
      },
      "brush"
    );
    const toWorldPoint = (ratio) => ({
      x: bounds.minX + bounds.width * ratio.x,
      y: bounds.minY + bounds.height * ratio.y,
    });
    const firstPoints = [
      { x: 0.5, y: 0.5 },
      { x: 0.02, y: 0.02 },
      { x: 0.98, y: 0.02 },
      { x: 0.98, y: 0.98 },
      { x: 0.02, y: 0.98 },
    ];
    const first = brush.beginStroke({
      point: toWorldPoint(firstPoints[0]),
    });

    if (!first) {
      throw new Error("Expected first Brush stroke");
    }

    for (const point of firstPoints.slice(1)) {
      first.update({ point: toWorldPoint(point) });
    }

    const firstCommit = first.complete({
      point: toWorldPoint(firstPoints.at(-1)),
    });
    const raster = editor.nodes.find(
      (node) =>
        node.type === "image" && node.parentId === "shared-runtime-frame"
    );

    if (raster?.type !== "image") {
      throw new Error("Expected materialized Raster");
    }

    editor.select(raster.id);
    editor.setActiveTool("eraser");
    const second = eraser.beginStroke({
      point: toWorldPoint({ x: 0.48, y: 0.48 }),
    });

    if (!second) {
      throw new Error("Expected queued Eraser stroke");
    }

    const secondActivatedBeforeCommit = Boolean(second.delegate);
    second.cancel();
    const third = eraser.beginStroke({
      point: toWorldPoint({ x: 0.52, y: 0.52 }),
    });

    if (!third) {
      throw new Error("Expected replacement queued Eraser stroke");
    }

    const thirdActivatedBeforeCommit = Boolean(third.delegate);

    await firstCommit;
    await third.ready;
    const thirdActivatedAfterCommit = Boolean(third.delegate);

    third.cancel();

    return {
      secondActivatedBeforeCommit,
      thirdActivatedAfterCommit,
      thirdActivatedBeforeCommit,
    };
  });

  expect(result).toEqual({
    secondActivatedBeforeCommit: false,
    thirdActivatedAfterCommit: true,
    thirdActivatedBeforeCommit: false,
  });
});

test("a completed Frame handoff keeps the held follow-up stroke visible", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 5400,
          id: "handoff-frame",
          locked: false,
          name: "Handoff Frame",
          parentId: "root",
          transform: transform(0, 0),
          type: "artboard",
          visible: true,
          width: 4500,
        },
      ],
      version: DOCUMENT_VERSION,
    })
  );
  await setFrameBrushTestZoom(page);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const frame = editor?.getNode("handoff-frame");
    const bounds = editor?.getNodeRenderFrame("handoff-frame")?.bounds;

    if (!(editor && brush && frame?.type === "artboard" && bounds)) {
      throw new Error("Expected a large Frame brush target");
    }

    editor.select(frame.id);
    editor.setActiveTool("brush");
    editor.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 100,
        smoothing: 0,
        spacing: 0,
      },
      "brush"
    );
    Reflect.set(
      window,
      "__PUNCHPRESS_TEST_RASTER_ACK__",
      editor.acknowledgeRasterPresentation.bind(editor)
    );
    editor.acknowledgeRasterPresentation = () => false;

    const toWorldPoint = (ratio) => ({
      x: bounds.minX + bounds.width * ratio.x,
      y: bounds.minY + bounds.height * ratio.y,
    });
    const firstEnd = toWorldPoint({ x: 0.08, y: 0.08 });
    const first = brush.beginStroke({
      point: toWorldPoint({ x: 0.4, y: 0.4 }),
    });

    if (!first) {
      throw new Error("Expected the first Frame stroke");
    }

    first.update({ point: firstEnd });
    await first.complete({ point: firstEnd });

    const secondEnd = toWorldPoint({ x: 0.8, y: 0.8 });
    const second = brush.beginStroke({
      point: toWorldPoint({ x: 0.75, y: 0.75 }),
    });

    if (!second) {
      throw new Error("Expected the held follow-up stroke");
    }

    second.update({ point: secondEnd });
    await second.ready;

    const raster = editor.nodes.find(
      (node) => node.type === "image" && node.parentId === frame.id
    );

    if (raster?.type !== "image") {
      throw new Error("Expected the committed Frame Raster");
    }

    const groups = brush
      .getWorkingGroups()
      .filter((group) => group.nodeId === raster.id);
    const inProgressGroups = groups.filter(
      (group) => group.phase !== "awaiting-presentation"
    );

    return {
      combinedSurface: {
        completed: groups.every((group) => group.phase !== "active"),
        inProgressTileCount: inProgressGroups.reduce(
          (count, group) =>
            count +
            (group.content.kind === "tiles" ? group.content.tiles.length : 0),
          0
        ),
        type: "tiles",
      },
      firstTileSourceCount: raster.tileSources?.length || 0,
      nodeId: raster.id,
      surfaces: groups.map((group) => ({
        commitTileRefCount: group.replacement?.resourceIds.length || 0,
        completed: group.phase !== "active",
        matrix: group.matrix,
        nodeId: group.nodeId,
        tileCount:
          group.content.kind === "tiles" ? group.content.tiles.length : 0,
        type: group.content.kind,
      })),
    };
  });
  const raster = page.locator(`[data-raster-node-id="${result.nodeId}"]`);

  await expect(raster).toHaveAttribute("data-raster-atomic-handoff", "true");
  expect(result.combinedSurface, JSON.stringify(result.surfaces)).toMatchObject(
    {
      completed: false,
      inProgressTileCount: expect.any(Number),
      type: "tiles",
    }
  );
  expect(result.combinedSurface?.inProgressTileCount).toBeGreaterThan(0);
  expect(
    new Set(result.surfaces.map((surface) => JSON.stringify(surface.matrix)))
      .size
  ).toBeGreaterThan(1);
  const workingSurface = raster
    .locator('[data-raster-working-surface="tiles"]')
    .last();

  await expect(workingSurface).toHaveAttribute(
    "data-raster-working-tile-count",
    String(result.combinedSurface?.inProgressTileCount),
    { timeout: 5000 }
  );
  const secondPoint = await getFrameClientPoint(page, 0.8, 0.8);
  const workingTileBoxes = await raster
    .getByTestId("raster-working-tile")
    .evaluateAll((tiles) =>
      tiles.map((tile) => {
        const rect = tile.getBoundingClientRect();

        return {
          maxX: rect.right,
          maxY: rect.bottom,
          minX: rect.left,
          minY: rect.top,
        };
      })
    );

  expect(
    workingTileBoxes.some(
      (box) =>
        secondPoint.x >= box.minX &&
        secondPoint.x <= box.maxX &&
        secondPoint.y >= box.minY &&
        secondPoint.y <= box.maxY
    )
  ).toBe(true);
  const presentedAlpha = await workingSurface.evaluate((surface) => {
    return [...surface.querySelectorAll("canvas")].reduce(
      (maxAlpha, canvas) => {
        const context = canvas.getContext("2d");

        if (!context) {
          return maxAlpha;
        }

        const data = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        ).data;
        let canvasMaxAlpha = maxAlpha;

        for (let index = 3; index < data.length; index += 4) {
          if (data[index] > canvasMaxAlpha) {
            canvasMaxAlpha = data[index];
          }
        }

        return canvasMaxAlpha;
      },
      0
    );
  });

  expect(presentedAlpha).toBeGreaterThan(240);

  const asyncCommitState = await page.evaluate(({ nodeId }) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const frame = editor?.getNode("handoff-frame");
    const bounds = editor?.getNodeRenderFrame("handoff-frame")?.bounds;
    const session = brush?.activeSession;

    if (!(editor && brush && frame?.type === "artboard" && bounds && session)) {
      throw new Error("Expected the held follow-up Frame stroke");
    }

    const toWorldPoint = (ratio) => ({
      x: bounds.minX + bounds.width * ratio.x,
      y: bounds.minY + bounds.height * ratio.y,
    });
    const ratios = Array.from({ length: 6 }, (_, row) => {
      const y = 0.08 + row * 0.16;

      return row % 2 === 0
        ? [
            { x: 0.08, y },
            { x: 0.92, y },
          ]
        : [
            { x: 0.92, y },
            { x: 0.08, y },
          ];
    }).flat();
    const points = ratios.map(toWorldPoint);

    for (const point of points) {
      session.update({ point });
    }

    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let heldEncodeFrame: FrameRequestCallback | null = null;

    window.requestAnimationFrame = (callback) => {
      heldEncodeFrame = callback;
      return 1_000_000;
    };
    session.complete({ point: points.at(-1) });
    window.requestAnimationFrame = originalRequestAnimationFrame;

    if (!heldEncodeFrame) {
      throw new Error("Expected an async tiled commit frame");
    }

    Reflect.set(
      window,
      "__PUNCHPRESS_TEST_HELD_RASTER_FRAME__",
      heldEncodeFrame
    );
    editor.notifyInteractionPreviewChanged();

    const groups = brush
      .getWorkingGroups()
      .filter((group) => group.nodeId === nodeId);
    const inProgressGroups = groups.filter(
      (group) => group.phase !== "awaiting-presentation"
    );

    return {
      commitTileRefCount: groups.reduce(
        (count, group) => count + (group.replacement?.resourceIds.length || 0),
        0
      ),
      completed: groups.every((group) => group.phase !== "active"),
      inProgressTileCount: inProgressGroups.reduce(
        (count, group) =>
          count +
          (group.content.kind === "tiles" ? group.content.tiles.length : 0),
        0
      ),
    };
  }, result);

  expect(asyncCommitState).toMatchObject({
    completed: true,
    inProgressTileCount: expect.any(Number),
  });
  expect(asyncCommitState?.commitTileRefCount).toBeGreaterThan(0);
  expect(asyncCommitState?.inProgressTileCount).toBeGreaterThan(16);
  await expect(workingSurface).toHaveAttribute(
    "data-raster-working-tile-count",
    String(asyncCommitState?.inProgressTileCount)
  );
  const releasedAlpha = await workingSurface.evaluate((surface) => {
    return [...surface.querySelectorAll("canvas")].reduce(
      (maxAlpha, canvas) => {
        const context = canvas.getContext("2d");

        if (!context) {
          return maxAlpha;
        }

        const data = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        ).data;
        let canvasMaxAlpha = maxAlpha;

        for (let index = 3; index < data.length; index += 4) {
          if (data[index] > canvasMaxAlpha) {
            canvasMaxAlpha = data[index];
          }
        }

        return canvasMaxAlpha;
      },
      0
    );
  });

  expect(releasedAlpha).toBeGreaterThan(240);

  await page.evaluate(() => {
    const heldEncodeFrame = Reflect.get(
      window,
      "__PUNCHPRESS_TEST_HELD_RASTER_FRAME__"
    );

    Reflect.deleteProperty(window, "__PUNCHPRESS_TEST_HELD_RASTER_FRAME__");
    heldEncodeFrame(performance.now());
  });
  await expect
    .poll(async () => (await getCommittedImageState(page))?.tileSourceCount)
    .toBeGreaterThan(result.firstTileSourceCount);
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const acknowledgePresentation = Reflect.get(
      window,
      "__PUNCHPRESS_TEST_RASTER_ACK__"
    );

    Reflect.deleteProperty(window, "__PUNCHPRESS_TEST_RASTER_ACK__");
    if (!(editor && acknowledgePresentation)) {
      throw new Error("Expected held Raster acknowledgement");
    }

    editor.acknowledgeRasterPresentation = acknowledgePresentation;
    for (const presentation of editor.getRasterWorkingPresentations()) {
      for (const group of presentation.groups) {
        if (group.replacement) {
          acknowledgePresentation({
            commitId: group.replacement.commitId,
            groupId: group.groupId,
            nodeId: group.nodeId,
          });
        }
      }
    }
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__PUNCHPRESS_EDITOR__
            ?.getRasterWorkingPresentations?.()
            .flatMap((presentation) => presentation.groups).length || 0
      )
    )
    .toBe(0);
});

test("newer acknowledged tiles stay above an older pending working group", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 5400,
          id: "ordered-frame",
          locked: false,
          name: "Ordered Frame",
          parentId: "root",
          transform: transform(0, 0),
          type: "artboard",
          visible: true,
          width: 4500,
        },
      ],
      version: DOCUMENT_VERSION,
    })
  );
  await setFrameBrushTestZoom(page);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const frame = editor?.getNode("ordered-frame");
    const bounds = editor?.getNodeRenderFrame("ordered-frame")?.bounds;

    if (!(editor && brush && frame?.type === "artboard" && bounds)) {
      throw new Error("Expected brush and ordered Frame");
    }

    editor.select(frame.id);
    editor.setActiveTool("brush");
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 100,
      smoothing: 0,
      spacing: 0,
    });
    const toWorldPoint = (ratio) => ({
      x: bounds.minX + bounds.width * ratio.x,
      y: bounds.minY + bounds.height * ratio.y,
    });
    const initial = brush.beginStroke({
      point: toWorldPoint({ x: 0.1, y: 0.1 }),
    });

    if (!initial) {
      throw new Error("Expected initial Frame stroke");
    }

    initial.update({ point: toWorldPoint({ x: 0.2, y: 0.2 }) });
    await initial.complete({ point: toWorldPoint({ x: 0.2, y: 0.2 }) });
    for (let frameIndex = 0; frameIndex < 20; frameIndex += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));

      if (
        editor
          .getRasterWorkingPresentations()
          .flatMap((presentation) => presentation.groups).length === 0
      ) {
        break;
      }
    }

    const raster = editor.nodes.find(
      (node) => node.type === "image" && node.parentId === frame.id
    );

    if (raster?.type !== "image") {
      throw new Error("Expected initialized Frame Raster");
    }

    const hostRect = editor.hostRef?.getBoundingClientRect();
    const zoom = 1;
    const viewport = {
      ...editor.getState().viewport,
      ...(hostRect
        ? {
            x: bounds.minX + bounds.width / 2 - hostRect.width / (2 * zoom),
            y: bounds.minY + bounds.height / 2 - hostRect.height / (2 * zoom),
          }
        : {}),
      zoom,
    };

    editor.viewerRef?.setTo?.(viewport);
    editor.setViewport(viewport);
    editor.getState().setViewport(viewport);
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const acknowledgePresentation =
      editor.acknowledgeRasterPresentation.bind(editor);
    const heldAcknowledgements = new Map<
      string,
      RasterPresentationAcknowledgement
    >();

    editor.acknowledgeRasterPresentation = (acknowledgement) => {
      heldAcknowledgements.set(acknowledgement.groupId, acknowledgement);
      return false;
    };
    const olderSession = brush.beginStroke({
      point: toWorldPoint({ x: 0.35, y: 0.35 }),
    });

    if (!olderSession) {
      throw new Error("Expected older tiled Frame stroke");
    }

    olderSession.update({ point: toWorldPoint({ x: 0.45, y: 0.45 }) });
    const olderCommit = olderSession.complete({
      point: toWorldPoint({ x: 0.45, y: 0.45 }),
    });
    const newerSession = brush.beginStroke({
      point: toWorldPoint({ x: 0.4, y: 0.4 }),
    });

    if (!newerSession) {
      throw new Error("Expected newer queued Frame stroke");
    }

    newerSession.update({ point: toWorldPoint({ x: 0.5, y: 0.5 }) });
    const newerCommit = newerSession.complete({
      point: toWorldPoint({ x: 0.5, y: 0.5 }),
    });

    await olderCommit;
    await newerCommit;

    for (
      let frame = 0;
      frame < 20 && heldAcknowledgements.size < 2;
      frame += 1
    ) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const groups = [
      ...(editor.getRasterWorkingPresentation?.(raster.id)?.groups ?? []),
    ].sort((left, right) => left.sequence - right.sequence);
    const older = groups[0];
    const newer = groups[1];

    if (!(older?.replacement && newer?.replacement)) {
      throw new Error("Expected two pending tile replacements");
    }

    editor.failRasterPresentation({
      commitId: older.replacement.commitId,
      groupId: older.groupId,
      nodeId: older.nodeId,
      reason: "decode-failed",
    });
    acknowledgePresentation({
      commitId: newer.replacement.commitId,
      groupId: newer.groupId,
      nodeId: newer.nodeId,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const renderer = document.querySelector(
      `[data-raster-node-id="${raster.id}"]`
    );
    const olderWorking = renderer?.querySelector(
      `[data-raster-working-group-id="${older.groupId}"]`
    );
    const newerCommittedTile = renderer?.querySelector(
      `[data-raster-tile-ref="${newer.replacement.resourceIds[0]}"]`
    );
    const remainingGroupIds =
      editor
        .getRasterWorkingPresentation?.(raster.id)
        ?.groups.map((group) => group.groupId) ?? [];
    const newerTileFollowsOlderWorking = Boolean(
      olderWorking &&
        newerCommittedTile &&
        olderWorking.compareDocumentPosition(newerCommittedTile) ===
          Node.DOCUMENT_POSITION_FOLLOWING
    );

    editor.acknowledgeRasterPresentation = acknowledgePresentation;
    for (const group of groups) {
      if (group.replacement) {
        acknowledgePresentation({
          commitId: group.replacement.commitId,
          groupId: group.groupId,
          nodeId: group.nodeId,
        });
      }
    }

    return {
      newerCommittedTileMounted: Boolean(newerCommittedTile),
      newerTileFollowsOlderWorking,
      olderGroupId: older.groupId,
      olderWorkingMounted: Boolean(olderWorking),
      presentationOwner:
        renderer?.getAttribute("data-raster-presentation-owner") ?? null,
      remainingGroupIds,
    };
  });

  expect(result.remainingGroupIds).toEqual([result.olderGroupId]);
  expect(result.newerTileFollowsOlderWorking, JSON.stringify(result)).toBe(
    true
  );
});

test("a first Frame stroke stays visible and stationary through pointer release", async ({
  page,
}, testInfo) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 5400,
          id: "release-frame",
          locked: false,
          name: "Release Frame",
          parentId: "root",
          transform: transform(0, 0),
          type: "artboard",
          visible: true,
          width: 4500,
        },
      ],
      version: DOCUMENT_VERSION,
    })
  );
  await setFrameBrushTestZoom(page);
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("release-frame");
    editor?.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 145,
        smoothing: 0.1,
        spacing: 0,
      },
      "brush"
    );
  });
  await page.keyboard.press("b");

  const frameBox = await page
    .locator("[data-artboard-body]")
    .first()
    .boundingBox();

  if (!frameBox) {
    throw new Error("Expected the Frame body");
  }

  const clip = {
    height: Math.min(frameBox.height, page.viewportSize()?.height || 720),
    width: Math.min(frameBox.width, page.viewportSize()?.width || 1280),
    x: Math.max(0, frameBox.x),
    y: Math.max(0, frameBox.y),
  };
  const ratios = [
    { x: 0.48, y: 0.68 },
    { x: 0.5, y: 0.38 },
    { x: 0.62, y: 0.35 },
    { x: 0.64, y: 0.48 },
    { x: 0.57, y: 0.51 },
    { x: 0.42, y: 0.54 },
    { x: 0.4, y: 0.65 },
    { x: 0.52, y: 0.73 },
    { x: 0.67, y: 0.61 },
  ];
  const controlPoints = ratios.map((ratio) => ({
    x: frameBox.x + frameBox.width * ratio.x,
    y: frameBox.y + frameBox.height * ratio.y,
  }));
  const points = controlPoints.flatMap((point, index) => {
    if (index === 0) {
      return [point];
    }

    const previousPoint = controlPoints[index - 1];

    return Array.from({ length: 8 }, (_, segmentIndex) => {
      const progress = (segmentIndex + 1) / 8;

      return {
        x: previousPoint.x + (point.x - previousPoint.x) * progress,
        y: previousPoint.y + (point.y - previousPoint.y) * progress,
      };
    });
  });
  const baseline = await getScreenshotInkPixelStats(page, clip);
  const [startPoint, ...strokePoints] = points;
  const screencastFrames = await captureScreencastFrames(
    page,
    async () => {
      await page.mouse.move(startPoint.x, startPoint.y);
      await page.mouse.down();

      for (const point of strokePoints) {
        await page.mouse.move(point.x, point.y);
        await page.waitForTimeout(8);
      }

      await page.waitForTimeout(120);
      await page.mouse.up();
    },
    { postRollMs: 900, preRollMs: 100 }
  );
  const frames = await getScreencastInkFrameStats(page, screencastFrames, clip);
  const baselineInkWeight = Math.min(
    baseline.inkWeight,
    ...frames.slice(0, 3).map((frame) => frame.inkWeight)
  );
  const visibleWeights = frames.map(
    (frame) => frame.inkWeight - baselineInkWeight
  );
  const maxVisibleInkWeight = Math.max(...visibleWeights);
  const firstHighFrameIndex = visibleWeights.findIndex(
    (visibleInkWeight) => visibleInkWeight >= maxVisibleInkWeight * 0.8
  );
  const dips = frames.flatMap((frame, index) => {
    if (index <= firstHighFrameIndex) {
      return [];
    }

    const visibleInkWeight = visibleWeights[index];
    const laterHighFrame = visibleWeights
      .slice(index + 1)
      .some((candidate) => candidate >= maxVisibleInkWeight * 0.7);

    return visibleInkWeight < maxVisibleInkWeight * 0.35 && laterHighFrame
      ? [
          {
            frameIndex: frame.index,
            timestamp: frame.timestamp,
            visibleInkWeight,
          },
        ]
      : [];
  });
  await testInfo.attach("first-frame-stroke-release", {
    body: JSON.stringify(
      {
        baselineInkWeight,
        dips,
        frames,
        maxVisibleInkWeight,
        screencastFrameCount: screencastFrames.length,
      },
      null,
      2
    ),
    contentType: "application/json",
  });
  expect(maxVisibleInkWeight).toBeGreaterThan(300);
  expect(dips).toEqual([]);
});

test("default Frame Hard Round uses the native tiled path", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.getByRole("button", { name: "Add artboard" }).click();
  await setFrameBrushTestZoom(page);
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  const ratios = [
    { x: 0.5, y: 0.5 },
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
    { x: 0.5, y: 0.2 },
    { x: 0.8, y: 0.5 },
    { x: 0.5, y: 0.8 },
    { x: 0.2, y: 0.5 },
  ];

  await startFrameBrushSession(page, ratios);
  await completeFrameBrushSession(page, ratios.at(-1));
  const perf = await takeBrushPerfCapture(page);

  expect(perf.counters["brush.tile.nativeStroke.segment"] || 0).toBeGreaterThan(
    0
  );
  expect(perf.counters["brush.tile.hardRoundDab"] || 0).toBe(0);
  expect(perf.counters["brush.tile.dab"] || 0).toBe(0);
});

test("Frame brush mounts newly painted tiles in the same presentation frame", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.getByRole("button", { name: "Add artboard" }).click();
  await setFrameBrushTestZoom(page);
  await page.keyboard.press("b");
  await expect(page.getByRole("heading", { name: "Brush" })).toBeVisible();

  await startFrameBrushSession(page, [{ x: 0.45, y: 0.5 }]);
  const getWorkingTileCount = () =>
    page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const group = editor
        ?.getRasterWorkingPresentations?.()
        .flatMap((presentation) => presentation.groups)
        .find((candidate) => candidate.content.kind === "tiles");

      return group?.content.kind === "tiles" ? group.content.tiles.length : 0;
    });

  await expect.poll(getWorkingTileCount).toBeGreaterThan(0);
  const initialTileCount = await getWorkingTileCount();
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const frame = editor?.nodes.find((node) => node.type === "artboard");
    const bounds = frame ? editor?.getNodeRenderFrame(frame.id)?.bounds : null;
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(bounds && session)) {
      throw new Error("Expected active Frame brush session");
    }

    const point = {
      x: bounds.minX + bounds.width * 0.75,
      y: bounds.minY + bounds.height * 0.5,
    };

    requestAnimationFrame(() => session.update({ point }));
    requestAnimationFrame(() => {
      const group = editor
        ?.getRasterWorkingPresentations?.()
        .flatMap((presentation) => presentation.groups)
        .find((candidate) => candidate.content.kind === "tiles");

      (
        window as typeof window & {
          __PUNCHPRESS_TILE_PRESENTATION_TEST__?: {
            allConnected: boolean;
            tileCount: number;
          };
        }
      ).__PUNCHPRESS_TILE_PRESENTATION_TEST__ =
        group?.content.kind === "tiles"
          ? {
              allConnected: group.content.tiles.every(
                (tile) => tile.canvas.isConnected
              ),
              tileCount: group.content.tiles.length,
            }
          : {
              allConnected: false,
              tileCount: 0,
            };
    });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __PUNCHPRESS_TILE_PRESENTATION_TEST__?: {
                allConnected: boolean;
                tileCount: number;
              };
            }
          ).__PUNCHPRESS_TILE_PRESENTATION_TEST__
      )
    )
    .not.toBeUndefined();
  const presentation = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __PUNCHPRESS_TILE_PRESENTATION_TEST__?: {
            allConnected: boolean;
            tileCount: number;
          };
        }
      ).__PUNCHPRESS_TILE_PRESENTATION_TEST__
  );

  await completeFrameBrushSession(page, { x: 0.75, y: 0.5 });
  expect(presentation?.tileCount).toBeGreaterThan(initialTileCount);
  expect(presentation?.allConnected).toBe(true);
});

test("Frame brush uses its writable plane while selection stays content-tight", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.getByRole("button", { name: "Add artboard" }).click();
  await setFrameBrushTestZoom(page);
  await page.keyboard.press("b");
  await startFrameBrushSession(page, [{ x: 0.5, y: 0.5 }]);

  const frameBox = await page
    .locator("[data-artboard-body]")
    .first()
    .boundingBox();
  const rasterShellBox = await page
    .locator('[data-node-shell="true"]')
    .first()
    .boundingBox();
  const activeState = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const raster = editor?.nodes.find((node) => node.type === "image");
    const group = raster
      ? editor?.getRasterWorkingPresentation?.(raster.id)?.groups.at(-1)
      : null;
    const selectionFrame = raster
      ? editor?.getNodeSelectionFrame(raster.id)
      : null;

    return {
      presentationBounds: group?.bounds || null,
      selectionBounds: selectionFrame?.bounds || null,
    };
  });

  await completeFrameBrushSession(page, { x: 0.5, y: 0.5 });
  const committedState = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const raster = editor?.nodes.find((node) => node.type === "image");
    const selectionFrame = raster
      ? editor?.getNodeSelectionFrame(raster.id)
      : null;

    return {
      rasterId: raster?.id || null,
      selectionBounds: selectionFrame?.bounds || null,
      writableBounds: raster
        ? editor?.getRasterWritableBounds?.(raster.id)
        : null,
    };
  });
  const committedRasterShell = page.locator(
    `[data-node-shell="true"]:has([data-node-id="${committedState.rasterId}"])`
  );
  const committedRasterShellBox = await committedRasterShell.boundingBox();
  const committedRasterHitBox = await committedRasterShell
    .getByRole("button")
    .boundingBox();

  expect(frameBox).not.toBeNull();
  expect(rasterShellBox).not.toBeNull();
  expect(activeState.presentationBounds).not.toBeNull();
  expect(activeState.selectionBounds).not.toBeNull();
  expect(activeState.presentationBounds?.width).toBeGreaterThan(
    (activeState.selectionBounds?.width || 0) * 10
  );
  expect(activeState.presentationBounds?.height).toBeGreaterThan(
    (activeState.selectionBounds?.height || 0) * 10
  );
  expect(Math.abs((rasterShellBox?.width || 0) - (frameBox?.width || 0))).toBe(
    0
  );
  expect(
    Math.abs((rasterShellBox?.height || 0) - (frameBox?.height || 0))
  ).toBe(0);
  expect(committedState.writableBounds).not.toBeNull();
  expect(committedState.selectionBounds).not.toBeNull();
  expect(committedRasterShellBox).not.toBeNull();
  expect(committedRasterHitBox).not.toBeNull();
  expect(
    Math.abs((committedRasterShellBox?.width || 0) - (frameBox?.width || 0))
  ).toBeLessThan(0.01);
  expect(
    Math.abs((committedRasterShellBox?.height || 0) - (frameBox?.height || 0))
  ).toBeLessThan(0.01);
  expect(committedRasterHitBox?.width || 0).toBeLessThan(
    (committedRasterShellBox?.width || 0) / 10
  );
  expect(committedRasterHitBox?.height || 0).toBeLessThan(
    (committedRasterShellBox?.height || 0) / 10
  );

  await page.keyboard.press("v");
  await page.mouse.click(
    (frameBox?.x || 0) + (frameBox?.width || 0) * 0.1,
    (frameBox?.y || 0) + (frameBox?.height || 0) * 0.1
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        return editor?.selectedNodeId || null;
      })
    )
    .toBeNull();
});

test("Frame brush publishes mutations inside an existing working tile", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.getByRole("button", { name: "Add artboard" }).click();
  await setFrameBrushTestZoom(page);
  await page.keyboard.press("b");
  await startFrameBrushSession(page, [{ x: 0.5, y: 0.5 }]);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const frame = editor?.nodes.find((node) => node.type === "artboard");
    const bounds = frame ? editor?.getNodeRenderFrame(frame.id)?.bounds : null;
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;
    const before = editor
      ?.getRasterWorkingPresentations?.()
      .flatMap((presentation) => presentation.groups)
      .find((candidate) => candidate.content.kind === "tiles");
    const tile =
      before?.content.kind === "tiles" ? before.content.tiles[0] : null;

    if (!(bounds && session && tile?.subscribeToSource)) {
      throw new Error("Expected a subscribable Frame working tile");
    }

    let mutationCount = 0;
    const unsubscribe = tile.subscribeToSource(() => {
      mutationCount += 1;
    });

    session.update({
      point: {
        x: bounds.minX + bounds.width * 0.5 + 10,
        y: bounds.minY + bounds.height * 0.5,
      },
    });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    unsubscribe();

    const after = editor
      ?.getRasterWorkingPresentations?.()
      .flatMap((presentation) => presentation.groups)
      .find((candidate) => candidate.content.kind === "tiles");

    return {
      afterTileCount:
        after?.content.kind === "tiles" ? after.content.tiles.length : 0,
      beforeTileCount:
        before?.content.kind === "tiles" ? before.content.tiles.length : 0,
      mutationCount,
    };
  });

  await completeFrameBrushSession(page, { x: 0.5, y: 0.5 });
  expect(result.afterTileCount).toBe(result.beforeTileCount);
  expect(result.mutationCount).toBeGreaterThan(0);
});

test("batched Hard Round preserves canonical edge coverage", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 500,
          id: "fast-frame",
          locked: false,
          name: "Fast Frame",
          parentId: "root",
          transform: transform(0, 0),
          type: "artboard",
          visible: true,
          width: 499.5,
        },
        {
          background: "#ffffff",
          height: 500,
          id: "canonical-frame",
          locked: false,
          name: "Canonical Frame",
          parentId: "root",
          transform: transform(1000, 0),
          type: "artboard",
          visible: true,
          width: 499.5,
        },
      ],
      version: DOCUMENT_VERSION,
    })
  );
  await resetViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 0.1 });

  const comparison = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");

    if (!(editor && brush)) {
      throw new Error("Expected Brush");
    }

    editor.setActiveTool("brush");
    const paint = async (frameId, frameX, opacity) => {
      const viewport = {
        ...editor.getState().viewport,
        zoom: 0.1,
      };

      editor.viewerRef?.setTo?.(viewport);
      editor.setViewport(viewport);
      editor.getState().setViewport(viewport);
      editor.onViewportChange?.();
      editor.select(frameId);
      editor.setBrushSettings(
        {
          hardness: 1,
          opacity,
          size: 14,
          smoothing: 0.1,
          spacing: 0,
        },
        "brush"
      );
      const startPoint = { x: frameX + 400, y: 100.25 };
      const edgePoint = { x: frameX + 493, y: 100.25 };
      const session = brush.beginStroke({ point: startPoint });

      if (!session) {
        throw new Error("Expected Frame brush stroke");
      }

      session.update({ point: edgePoint });
      await session.complete({
        point: { x: edgePoint.x + 1, y: edgePoint.y },
      });
      await session.delegate?.ready;
      return editor.nodes.find(
        (node) => node.type === "image" && node.parentId === frameId
      );
    };
    const fast = await paint("fast-frame", 0, 1);
    const canonical = await paint("canonical-frame", 1000, 0.999);

    if (
      !(
        fast?.type === "image" &&
        canonical?.type === "image" &&
        fast.src &&
        canonical.src
      )
    ) {
      throw new Error(
        `Expected committed tiled Rasters: ${JSON.stringify(
          editor.nodes.map((node) => ({
            id: node.id,
            parentId: node.parentId,
            tileSourceCount:
              node.type === "image" ? node.tileSources?.length || 0 : null,
            type: node.type,
          }))
        )}`
      );
    }

    const loadImage = async (src) => {
      const image = new Image();

      image.src = src;
      await image.decode();
      return image;
    };
    const renderNode = async (node) => {
      const canvas = document.createElement("canvas");

      canvas.width = node.width;
      canvas.height = node.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        throw new Error("Expected Canvas2D context");
      }

      const baseImage = await loadImage(node.src);

      context.drawImage(
        baseImage,
        node.tileSources?.length ? (node.baseX ?? 0) : 0,
        node.tileSources?.length ? (node.baseY ?? 0) : 0,
        node.tileSources?.length ? (node.baseWidth ?? node.width) : node.width,
        node.tileSources?.length
          ? (node.baseHeight ?? node.height)
          : node.height
      );
      for (const tile of node.tileSources || []) {
        const tileImage = await loadImage(tile.src);

        context.drawImage(tileImage, tile.x, tile.y, tile.width, tile.height);
      }

      return context;
    };
    const fastContext = await renderNode(fast);
    const canonicalContext = await renderNode(canonical);
    const getAlpha = (context) => {
      const { data } = context.getImageData(
        0,
        0,
        context.canvas.width,
        context.canvas.height
      );
      const alpha: number[] = [];

      for (let index = 3; index < data.length; index += 4) {
        alpha.push(data[index]);
      }

      return alpha;
    };
    const fastAlpha = getAlpha(fastContext);
    const canonicalAlpha = getAlpha(canonicalContext);
    let maxBoundaryAlphaDifference = 0;
    const alphaCount = Math.min(fastAlpha.length, canonicalAlpha.length);

    for (let index = 0; index < alphaCount; index += 1) {
      const difference = Math.abs(fastAlpha[index] - canonicalAlpha[index]);
      const x = index % fastContext.canvas.width;

      if (x >= fastContext.canvas.width - 2) {
        maxBoundaryAlphaDifference = Math.max(
          maxBoundaryAlphaDifference,
          difference
        );
      }
    }

    return {
      canonicalTileCount: canonical.tileSources?.length || 0,
      fastTileCount: fast.tileSources?.length || 0,
      maxBoundaryAlphaDifference,
    };
  });

  expect(comparison.canonicalTileCount).toBeGreaterThan(0);
  expect(comparison.fastTileCount).toBeGreaterThan(0);
  expect(
    comparison.maxBoundaryAlphaDifference,
    JSON.stringify(comparison)
  ).toBeLessThanOrEqual(1);
});

test("a Hard Round edge crossing preserves its interior segment", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    editor.select(node.id);
    editor.setActiveTool("brush");
    editor.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 48,
        smoothing: 0,
        spacing: 0,
      },
      "brush"
    );
    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const outside = toWorldPoint({ x: -1000, y: 800 });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 2000, y: 800 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    await session.ready;
    session.update({ point: outside });
    await session.complete({ point: outside });
  });

  const interiorSample = await getCommittedImageSample(page, {
    x: 1000,
    y: 800,
  });

  expect(interiorSample?.a).toBe(255);
});

test("artboard brush strokes do not grow raster payloads outside the frame", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadRasterTestDocument(page, createArtboardDocument());
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("artboard-1");
  });
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const start = await getCanvasStagePoint(page, { x: 360, y: 260 });
  const outside = await getCanvasStagePoint(page, { x: 1280, y: 920 });

  await dragBrush(page, [start, outside], { steps: 60 });

  const imageState = await getCommittedImageState(page);

  expect(imageState?.parentId).toBe("artboard-1");
  expect(imageState?.width).toBeLessThanOrEqual(340);
  expect(imageState?.height).toBeLessThanOrEqual(260);
  expect((imageState?.x || 0) + (imageState?.width || 0)).toBeLessThanOrEqual(
    560
  );
  expect((imageState?.y || 0) + (imageState?.height || 0)).toBeLessThanOrEqual(
    420
  );
});

test("painting a Frame-crossing imported Raster preserves its bounds", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createBloatedArtboardImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("image-1");
  });
  await page.keyboard.press("b");

  const point = await getCanvasStagePoint(page, { x: 360, y: 260 });

  await dragBrush(page, [point, point], { release: false });

  const workingSurface = await getRasterWorkingSurfaceState(page);

  expect(await getBrushPreviewState(page)).toBeNull();
  expect(workingSurface.canvasCount).toBe(1);
  expect(workingSurface.count).toBe(1);

  await page.mouse.up();

  const imageState = await getCommittedImageState(page);

  expect(imageState?.id).toBe("image-1");
  expect(imageState?.parentId).toBe("artboard-1");
  expect(imageState?.width).toBe(900);
  expect(imageState?.height).toBe(700);
  expect(imageState?.x).toBe(120);
  expect(imageState?.y).toBe(80);
});

test("large raster brush paints through the working raster surface", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("large-image-1");
  });
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 48);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const start = await getCanvasStagePoint(page, { x: 360, y: 260 });
  const end = await getCanvasStagePoint(page, { x: 440, y: 300 });

  await dragBrush(page, [start, end], { release: false, steps: 4 });

  const workingSurface = await getRasterWorkingSurfaceState(page);

  expect(await getBrushPreviewState(page)).toBeNull();
  expect(workingSurface.canvasCount).toBe(1);
  expect(workingSurface.count).toBe(1);
  expect(await getRasterNodeArtOpacity(page, "large-image-1")).not.toBe("0");

  await page.mouse.up();
});

test("brush commits on an existing raster layer preserve its raster plane", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("large-image-1");
  });
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 48);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const beforeStroke = await getCommittedImageState(page);
  const point = await getCanvasStagePoint(page, { x: 360, y: 260 });

  await dragBrush(page, [point, point]);

  const afterStroke = await getCommittedImageState(page);
  const sample = await getCommittedImageSampleAtClientPoint(page, point);

  expect(afterStroke).toMatchObject({
    height: beforeStroke?.height,
    id: beforeStroke?.id,
    transform: beforeStroke?.transform,
    width: beforeStroke?.width,
  });
  expect(sample?.a).toBe(255);
});

test("huge raster brush strokes mutate dirty tiles instead of a full layer canvas", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  await setBrushSliderValue(page, "Brush size", 64);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const start = await getCanvasStagePoint(page, { x: 340, y: 250 });
  const middle = await getCanvasStagePoint(page, { x: 760, y: 520 });
  const end = await getCanvasStagePoint(page, { x: 980, y: 360 });

  await dragBrush(page, [start, middle, end], { release: false, steps: 32 });

  const workingSurface = await getRasterWorkingSurfaceState(page);

  expect(await getBrushPreviewState(page)).toBeNull();
  expect(workingSurface.tileSurfaceCount).toBe(1);
  expect(workingSurface.totalTileCount).toBeGreaterThan(0);
  expect(await getRasterNodeArtOpacity(page, "huge-image-1")).not.toBe("0");

  await page.mouse.up();

  const imageState = await getCommittedImageState(page);
  const perf = await takeBrushPerfCapture(page);

  expect(imageState?.id).toBe("huge-image-1");
  expect(imageState?.width).toBe(12_400);
  expect(imageState?.height).toBe(10_800);
  expect(imageState?.tileSourceCount).toBeGreaterThan(0);
  expect(perf.counters["brush.tile.session"] || 0).toBe(1);
  expect(perf.counters["brush.tile.touched"] || 0).toBeGreaterThan(0);
  expect(perf.counters["brush.canvas.expand"] || 0).toBe(0);
  expect(perf.spans["brush.stroke.createFloatPixels"] || []).toHaveLength(0);
  expect(perf.spans["brush.commit.encode"] || []).toHaveLength(0);
});

test("huge tiled live paint uses touched working tiles at zoom-out", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("huge-image-1");
    editor?.setViewport({ x: 0, y: 0, zoom: 0.2 });
    editor?.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 24,
        smoothing: 0,
        spacing: 0,
      },
      "brush"
    );
  });
  await installBrushPerfCapture(page);

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("huge-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected huge image brush target");
    }

    const start = {
      x: node.transform.x + node.width / 2,
      y: node.transform.y + node.height / 2,
    };
    const end = {
      x: start.x + 40_000,
      y: start.y + 7800,
    };
    const session = brush.beginStroke({ point: start });

    if (!session) {
      throw new Error("Expected brush session");
    }

    window.__PUNCHPRESS_STRESS_BRUSH_SESSION__ = session;
    session.update({ point: end });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const workingSurface = await getRasterWorkingSurfaceState(page);
  const perf = await takeBrushPerfCapture(page);

  expect(await getBrushPreviewState(page)).toBeNull();
  expect(workingSurface.tileSurfaceCount).toBe(1);
  expect(perf.counters["brush.nativeStroke.segment"] || 0).toBeGreaterThan(0);
  expect(perf.counters["brush.dab"] || 0).toBe(0);
  expect(workingSurface.totalTileCount).toBeGreaterThan(10);
  expect(workingSurface.totalTileCount).toBeLessThan(30);
  expect(perf.spans["brush.tile.working.tiles"] || []).not.toHaveLength(0);

  await page.evaluate(() => {
    const session = window.__PUNCHPRESS_STRESS_BRUSH_SESSION__;
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");

    if (session && node?.type === "image") {
      const point = {
        x: node.transform.x + node.width / 2 + 40_000,
        y: node.transform.y + node.height / 2 + 7800,
      };

      session.complete({ point });
    }

    window.__PUNCHPRESS_STRESS_BRUSH_SESSION__ = undefined;
  });
});

test("default brush updates working tiles during fast full-screen strokes at 4% zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    editor.setViewportInteracting(false);
    editor.setViewport({ x: 0, y: 0, zoom: 0.04 });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.({ x: 0, y: 0, zoom: 0.04 });
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? 0,
      y: editor.viewerRef?.getScrollTop?.() ?? 0,
      zoom: 0.04,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  const points = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const viewerRect = editor?.viewerRef
      ?.getContainer?.()
      ?.getBoundingClientRect?.();
    const viewport = editor?.viewport;

    if (!(editor && node?.type === "image" && viewerRect && viewport)) {
      return null;
    }

    const toScreen = (point) => ({
      x: viewerRect.left + (point.x - viewport.x) * viewport.zoom,
      y: viewerRect.top + (point.y - viewport.y) * viewport.zoom,
    });
    const start = toScreen({
      x: node.transform.x + node.width * 0.9,
      y: node.transform.y + node.height * 0.5,
    });

    return {
      end: {
        x: viewerRect.right - Math.min(420, viewerRect.width * 0.28),
        y: start.y,
      },
      start,
      viewport: { ...viewport },
      viewerRect: {
        height: viewerRect.height,
        left: viewerRect.left,
        top: viewerRect.top,
        width: viewerRect.width,
      },
    };
  });

  if (!points) {
    throw new Error("Missing brush test geometry");
  }

  const { end, start } = points;
  const steps = 18;

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;

    await page.mouse.move(
      start.x + (end.x - start.x) * progress,
      start.y + (end.y - start.y) * progress
    );
    await page.waitForTimeout(6);
  }

  const workingSurface = await getRasterWorkingSurfaceState(page);

  await page.mouse.up();
  await page.waitForTimeout(50);

  const perf = await takeBrushPerfCapture(page);
  const diagnostic = JSON.stringify({ perf, points, workingSurface });

  expect(await getBrushPreviewState(page)).toBeNull();
  expect(workingSurface.tileSurfaceCount, diagnostic).toBe(1);
  expect(workingSurface.totalTileCount, diagnostic).toBeGreaterThan(0);
  expect(perf.counters["brush.tile.session"] || 0).toBe(1);
  expect(perf.counters["brush.canvas.expand"] || 0).toBe(0);
});

test("default brush shows a working tile on the first down at 4% zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    editor.select("huge-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({ x: 0, y: 0, zoom: 0.04 });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.({ x: 0, y: 0, zoom: 0.04 });
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? 0,
      y: editor.viewerRef?.getScrollTop?.() ?? 0,
      zoom: 0.04,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  const point = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const viewerRect = editor?.viewerRef
      ?.getContainer?.()
      ?.getBoundingClientRect?.();
    const viewport = editor?.viewport;

    if (!(node?.type === "image" && viewerRect && viewport)) {
      return null;
    }

    return {
      x:
        viewerRect.left +
        (node.transform.x + 6000 - viewport.x) * viewport.zoom,
      y:
        viewerRect.top + (node.transform.y + 5400 - viewport.y) * viewport.zoom,
    };
  });

  if (!point) {
    throw new Error("Missing brush point");
  }

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(25);

  const workingSurface = await getRasterWorkingSurfaceState(page);
  await takeBrushPerfCapture(page);

  expect(await getBrushPreviewState(page)).toBeNull();
  expect(workingSurface.tileSurfaceCount).toBe(1);
  expect(workingSurface.totalTileCount).toBeGreaterThan(0);

  await page.mouse.up();
});

test("default brush uses working tiles on a normal raster after zooming out", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    const node = editor.getNode("large-image-1");

    if (node?.type !== "image") {
      return;
    }

    editor.updateNode("large-image-1", {
      baseHeight: 48,
      baseWidth: 48,
      height: 337,
      width: 306,
    });
    editor.select("large-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 1,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 1,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.setViewport({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.04,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.04,
    });
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? node.transform.x - 600,
      y: editor.viewerRef?.getScrollTop?.() ?? node.transform.y - 500,
      zoom: 0.04,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  await installBrushPerfCapture(page);
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    editor.setActiveTool("brush");
    const point = {
      x: node.transform.x + node.width / 2,
      y: node.transform.y + node.height / 2,
    };
    const session = brush.beginStroke({ point });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    window.__PUNCHPRESS_TEST_BRUSH_SESSION__ = session;
    await session.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  const workingSurface = await getRasterWorkingSurfaceState(page);
  const perf = await takeBrushPerfCapture(page);

  expect(await getBrushPreviewState(page)).toBeNull();
  expect(workingSurface.tileSurfaceCount).toBe(1);
  expect(workingSurface.totalTileCount).toBeGreaterThan(0);
  expect(await getRasterNodeArtOpacity(page, "large-image-1")).not.toBe("0");
  expect(perf.counters["brush.tile.session"] || 0).toBe(1);

  await page.evaluate(() => {
    const session = window.__PUNCHPRESS_TEST_BRUSH_SESSION__;
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("large-image-1");

    if (session && node?.type === "image") {
      session.complete({
        point: {
          x: node.transform.x + node.width / 2,
          y: node.transform.y + node.height / 2,
        },
      });
    }

    window.__PUNCHPRESS_TEST_BRUSH_SESSION__ = undefined;
  });
});

test("zoomed-out broad strokes on small rasters commit dirty tiles instead of a full PNG", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    const node = editor.getNode("large-image-1");

    if (node?.type !== "image") {
      return;
    }

    editor.updateNode("large-image-1", {
      baseHeight: 337,
      baseWidth: 306,
      height: 337,
      width: 306,
    });
    editor.select("large-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.04,
    });
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.04,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.onViewportChange?.();
  });
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 120, y: 160 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    await session.ready;
    session.update({ point: toWorldPoint({ x: 6800, y: 3600 }) });
    session.complete({ point: toWorldPoint({ x: 6800, y: 3600 }) });

    const imageNode = editor.getNode("large-image-1");

    if (imageNode?.type !== "image") {
      throw new Error("Expected committed image node");
    }

    return {
      baseHeight: imageNode.baseHeight,
      baseWidth: imageNode.baseWidth,
      height: imageNode.height,
      tileSourceCount: imageNode.tileSources?.length || 0,
      width: imageNode.width,
    };
  });
  const perf = await takeBrushPerfCapture(page);

  expect(result.baseHeight).toBe(337);
  expect(result.baseWidth).toBe(306);
  expect(result.width).toBeGreaterThan(6500);
  expect(result.height).toBeGreaterThan(3400);
  expect(result.tileSourceCount).toBeGreaterThan(10);
  expect(result.tileSourceCount).toBeLessThan(60);
  expect(perf.counters["brush.tile.session"] || 0).toBe(1);
  expect(perf.counters["brush.canvas.expand"] || 0).toBe(0);
  expect(perf.spans["brush.commit.encode"] || []).toHaveLength(0);
  expect(perf.spans["brush.tile.commit.encode"] || []).not.toHaveLength(0);
});

test("extreme zoom sweep strokes drain tile work before pointerup", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    const node = editor.getNode("large-image-1");

    if (node?.type !== "image") {
      return;
    }

    editor.updateNode("large-image-1", {
      baseHeight: 337,
      baseWidth: 306,
      height: 337,
      width: 306,
    });
    editor.select("large-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.onViewportChange?.();
  });
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  const liveResult = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 120, y: 160 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    window.__PUNCHPRESS_TEST_BRUSH_SESSION__ = session;
    await session.ready;

    const pointCount = 96;

    for (let index = 1; index <= pointCount; index += 1) {
      const progress = index / pointCount;

      session.update({
        point: toWorldPoint({
          x: 120 + 42_000 * progress,
          y: 160 + Math.sin(progress * Math.PI * 1.2) * 18_000,
        }),
      });
    }

    for (let index = 0; index < 6; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    return {
      queuedPointCount: session.points.length - (session.pointReadIndex || 0),
      totalPointCount: session.points.length,
    };
  });

  expect(liveResult.queuedPointCount).toBeLessThan(70);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const session = window.__PUNCHPRESS_TEST_BRUSH_SESSION__;
    const node = editor?.getNode("large-image-1");

    if (session && node?.type === "image") {
      session.complete({
        point: {
          x: node.transform.x + 42_120,
          y: node.transform.y + 160,
        },
      });
    }

    window.__PUNCHPRESS_TEST_BRUSH_SESSION__ = undefined;
  });

  const perf = await takeBrushPerfCapture(page);

  expect(perf.counters["brush.tile.session"] || 0).toBe(1);
  expect(perf.counters["brush.stroke.flushPointChunk"] || 0).toBeGreaterThan(0);
  expect(perf.spans["brush.commit.encode"] || []).toHaveLength(0);
});

test("extreme zoom sweep pointerup does not block on tile encoding", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    const node = editor.getNode("large-image-1");

    if (node?.type !== "image") {
      return;
    }

    editor.updateNode("large-image-1", {
      baseHeight: 337,
      baseWidth: 306,
      height: 337,
      width: 306,
    });
    editor.select("large-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.onViewportChange?.();
  });
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 120, y: 160 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    await session.ready;

    const pointCount = 160;

    for (let index = 1; index <= pointCount; index += 1) {
      const progress = index / pointCount;

      session.update({
        point: toWorldPoint({
          x: 120 + 72_000 * progress,
          y: 160 + Math.sin(progress * Math.PI * 1.6) * 52_000,
        }),
      });
    }

    for (let index = 0; index < 10; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const completeStartedAt = performance.now();

    session.complete({
      point: toWorldPoint({
        x: 72_120,
        y: 160,
      }),
    });

    const completeElapsedMs = performance.now() - completeStartedAt;

    return {
      completeElapsedMs,
    };
  });
  const perf = await takeBrushPerfCapture(page);

  expect(result.completeElapsedMs).toBeLessThan(80);
  expect(perf.counters["brush.tile.session"] || 0).toBe(1);
  expect(perf.spans["brush.commit.encode"] || []).toHaveLength(0);
});

test("pending async working tiles stay mounted when the next stroke starts", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    const node = editor.getNode("large-image-1");

    if (node?.type !== "image") {
      return;
    }

    editor.updateNode("large-image-1", {
      baseHeight: 337,
      baseWidth: 306,
      height: 337,
      width: 306,
    });
    editor.select("large-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.onViewportChange?.();
  });
  await page.keyboard.press("b");

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const firstSession = brush.beginStroke({
      point: toWorldPoint({ x: 120, y: 160 }),
    });

    if (!firstSession) {
      throw new Error("Expected first brush stroke session");
    }

    await firstSession.ready;

    for (let index = 1; index <= 160; index += 1) {
      const progress = index / 160;

      firstSession.update({
        point: toWorldPoint({
          x: 120 + 72_000 * progress,
          y: 160 + Math.sin(progress * Math.PI * 1.6) * 52_000,
        }),
      });
    }

    const firstCommit = firstSession.complete({
      point: toWorldPoint({
        x: 72_120,
        y: 160,
      }),
    });
    const secondSession = brush.beginStroke({
      point: toWorldPoint({ x: 420, y: 260 }),
    });

    if (!secondSession) {
      throw new Error("Expected second brush stroke session");
    }

    secondSession.update({ point: toWorldPoint({ x: 34_000, y: 18_000 }) });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const previewCount = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;
    const workingGroups =
      editor
        .getRasterWorkingPresentations?.()
        .flatMap((presentation) => presentation.groups) || [];
    const targetGroups =
      editor.getRasterWorkingPresentation?.("large-image-1")?.groups || [];

    const secondActivated = Boolean(secondSession.delegate);
    secondSession.cancel();
    await firstCommit;

    return {
      mergedTileCount: targetGroups.reduce(
        (count, group) =>
          count +
          (group.content.kind === "tiles" ? group.content.tiles.length : 0),
        0
      ),
      previewCount,
      secondActivated,
      workingSurfaceCount: workingGroups.length,
    };
  });

  expect(result.previewCount).toBe(0);
  expect(result.secondActivated).toBe(false);
  expect(result.workingSurfaceCount).toBe(1);
  expect(result.mergedTileCount).toBeGreaterThan(0);
});

test("canvas handoff remains pending until its typed acknowledgement", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(page, createSmallImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("image-1");
    const brush = editor?.tools.get("brush");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected small Raster brush target");
    }

    editor.updateNode(node.id, {
      baseHeight: node.height,
      baseWidth: node.width,
      height: node.height * 2,
      width: node.width * 2,
    });
    editor.select(node.id);
    editor.setActiveTool("brush");
    Reflect.set(
      window,
      "__PUNCHPRESS_TEST_RASTER_ACK__",
      editor.acknowledgeRasterPresentation.bind(editor)
    );
    editor.acknowledgeRasterPresentation = () => false;
    const session = brush.beginStroke({
      point: {
        x: node.transform.x + 48,
        y: node.transform.y + 48,
      },
    });

    if (!session) {
      throw new Error("Expected Canvas Raster stroke");
    }

    await session.ready;
    await session.complete({
      point: {
        x: node.transform.x + 72,
        y: node.transform.y + 72,
      },
    });
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__PUNCHPRESS_EDITOR__
            ?.getRasterWorkingPresentations?.()
            .flatMap((presentation) => presentation.groups)
            .find((group) => group.content.kind === "canvas")?.phase || null
      )
    )
    .toBe("awaiting-presentation");

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("image-1");
    const acknowledgePresentation = Reflect.get(
      window,
      "__PUNCHPRESS_TEST_RASTER_ACK__"
    );

    if (
      !(editor && brush && node?.type === "image" && acknowledgePresentation)
    ) {
      throw new Error("Expected pending Canvas Raster handoff");
    }

    const point = {
      x: node.transform.x + 96,
      y: node.transform.y + 96,
    };
    const followup = brush.beginStroke({ point });

    if (!followup) {
      throw new Error("Expected queued follow-up stroke");
    }

    const activatedBeforeAcknowledgement = Boolean(followup.delegate);
    const pendingGroups = editor
      .getRasterWorkingPresentations()
      .flatMap((presentation) => presentation.groups);

    editor.acknowledgeRasterPresentation = acknowledgePresentation;
    Reflect.deleteProperty(window, "__PUNCHPRESS_TEST_RASTER_ACK__");
    for (const group of pendingGroups) {
      if (group.replacement) {
        acknowledgePresentation({
          commitId: group.replacement.commitId,
          groupId: group.groupId,
          nodeId: group.nodeId,
        });
      }
    }
    await followup.ready;
    const activatedAfterAcknowledgement = Boolean(followup.delegate);

    followup.cancel();
    return {
      activatedAfterAcknowledgement,
      activatedBeforeAcknowledgement,
      pendingCanvasGroupCount: pendingGroups.filter(
        (group) => group.content.kind === "canvas"
      ).length,
    };
  });

  expect(result).toEqual({
    activatedAfterAcknowledgement: true,
    activatedBeforeAcknowledgement: false,
    pendingCanvasGroupCount: 1,
  });
});

test("pending hidden Raster handoff does not block an unrelated Raster stroke", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(page, createTwoSmallImageDocument(src));
  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const firstNode = editor?.getNode("brush-image");
    const secondNode = editor?.getNode("eraser-image");

    if (
      !(
        editor &&
        brush &&
        firstNode?.type === "image" &&
        secondNode?.type === "image"
      )
    ) {
      throw new Error("Expected two Raster brush targets");
    }

    Object.assign(editor, { rasterSurface: null });
    const acknowledgePresentation =
      editor.acknowledgeRasterPresentation.bind(editor);

    editor.acknowledgeRasterPresentation = () => false;
    editor.select(firstNode.id);
    editor.setActiveTool("brush");
    const firstSession = brush.beginStroke({
      point: {
        x: firstNode.transform.x + 24,
        y: firstNode.transform.y + 24,
      },
    });

    if (!firstSession) {
      throw new Error("Expected first Canvas Raster stroke");
    }

    await firstSession.ready;
    await firstSession.complete({
      point: {
        x: firstNode.transform.x + 72,
        y: firstNode.transform.y + 72,
      },
    });
    editor.updateNode(firstNode.id, { visible: false });
    editor.select(secondNode.id);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const secondSession = brush.beginStroke({
      point: {
        x: secondNode.transform.x + 24,
        y: secondNode.transform.y + 24,
      },
    });

    if (!secondSession) {
      throw new Error("Expected unrelated Canvas Raster stroke");
    }

    const pendingFirstGroup = editor
      .getRasterWorkingPresentation(firstNode.id)
      ?.groups.at(-1);
    const secondActivated = Boolean(secondSession.delegate);

    secondSession.cancel();
    editor.acknowledgeRasterPresentation = acknowledgePresentation;

    return {
      pendingFirstPhase: pendingFirstGroup?.phase ?? null,
      secondActivated,
    };
  });

  expect(result).toEqual({
    pendingFirstPhase: "awaiting-presentation",
    secondActivated: true,
  });
});

test("canvas durable source publication includes matching handoff metadata", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(page, createSmallImageDocument(src));
  const observations = await page.evaluate(async (initialSrc) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected Canvas Raster brush target");
    }

    editor.select(node.id);
    editor.setActiveTool("brush");
    editor.rasterSurface?.retainTargets?.([]);
    const durableObservations: {
      commitId: string | null;
      phase: string | null;
      resourceCount: number;
    }[] = [];
    const unsubscribe = editor.store.subscribe(() => {
      const durableNode = editor.getNode(node.id);

      if (!(durableNode?.type === "image" && durableNode.src !== initialSrc)) {
        return;
      }

      const group = editor.getRasterWorkingPresentation(node.id)?.groups.at(-1);

      durableObservations.push({
        commitId: group?.replacement?.commitId ?? null,
        phase: group?.phase ?? null,
        resourceCount: group?.replacement?.resourceIds.length ?? 0,
      });
    });
    const session = brush.beginStroke({
      point: {
        x: node.transform.x + 24,
        y: node.transform.y + 24,
      },
    });

    if (!session) {
      throw new Error("Expected Canvas Raster stroke");
    }

    await session.ready;
    await session.complete({
      point: {
        x: node.transform.x + 72,
        y: node.transform.y + 72,
      },
    });
    unsubscribe();

    return durableObservations;
  }, src);

  expect(observations.length).toBeGreaterThan(0);
  expect(observations).toEqual(
    observations.map(() => ({
      commitId: expect.any(String),
      phase: "awaiting-presentation",
      resourceCount: 1,
    }))
  );
});

test("tiled durable resource publication includes matching handoff metadata", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(page, createResizedImportedImageDocument(src));
  const observations = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected tiled Raster brush target");
    }

    editor.select(node.id);
    editor.setActiveTool("brush");
    const durableObservations: {
      commitId: string | null;
      hasExactResources: boolean;
      phase: string | null;
    }[] = [];
    const unsubscribe = editor.store.subscribe(() => {
      const durableNode = editor.getNode(node.id);

      if (
        !(
          durableNode?.type === "image" &&
          (durableNode.tileSources?.length ?? 0) > 0
        )
      ) {
        return;
      }

      const group = editor.getRasterWorkingPresentation(node.id)?.groups.at(-1);
      const durableRefs =
        durableNode.tileSources?.map((tile) => tile.ref) ?? [];
      const replacementRefs = group?.replacement?.resourceIds ?? [];

      durableObservations.push({
        commitId: group?.replacement?.commitId ?? null,
        hasExactResources:
          durableRefs.length === replacementRefs.length &&
          durableRefs.every((ref) => replacementRefs.includes(ref)),
        phase: group?.phase ?? null,
      });
    });
    const session = brush.beginStroke({
      point: {
        x: node.transform.x + 120,
        y: node.transform.y + 120,
      },
    });

    if (!session) {
      throw new Error("Expected tiled Raster stroke");
    }

    await session.ready;
    await session.complete({
      point: {
        x: node.transform.x + 360,
        y: node.transform.y + 240,
      },
    });
    unsubscribe();

    return durableObservations;
  });

  expect(observations.length).toBeGreaterThan(0);
  expect(observations).toEqual(
    observations.map(() => ({
      commitId: expect.any(String),
      hasExactResources: true,
      phase: "awaiting-presentation",
    }))
  );
});

test("Editor aggregates Brush and Eraser handoffs and retires exact matches", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createWhiteImageDataUrl(page);

  await loadRasterTestDocument(page, createTwoSmallImageDocument(src));
  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const eraser = editor?.tools.get("eraser");
    const brushNode = editor?.getNode("brush-image");
    const eraserNode = editor?.getNode("eraser-image");

    if (
      !(
        editor &&
        brush &&
        eraser &&
        brushNode?.type === "image" &&
        eraserNode?.type === "image"
      )
    ) {
      throw new Error("Expected Brush and Eraser Raster targets");
    }

    const acknowledgePresentation =
      editor.acknowledgeRasterPresentation.bind(editor);

    editor.acknowledgeRasterPresentation = () => false;

    const commitStroke = async (tool, toolId, node) => {
      editor.select(node.id);
      editor.setActiveTool(toolId);
      editor.rasterSurface?.retainTargets?.([]);
      const session = tool.beginStroke({
        point: {
          x: node.transform.x + 24,
          y: node.transform.y + 24,
        },
      });

      if (!session) {
        throw new Error(`Expected ${toolId} stroke`);
      }

      await session.ready;
      await session.complete({
        point: {
          x: node.transform.x + 72,
          y: node.transform.y + 72,
        },
      });
    };

    await commitStroke(brush, "brush", brushNode);
    await commitStroke(eraser, "eraser", eraserNode);

    const aggregated = editor
      .getRasterWorkingPresentations()
      .flatMap((presentation) => presentation.groups);
    const brushGroup = aggregated.find(
      (group) => group.nodeId === brushNode.id
    );
    const eraserGroup = aggregated.find(
      (group) => group.nodeId === eraserNode.id
    );

    if (!(brushGroup?.replacement && eraserGroup?.replacement)) {
      throw new Error("Expected pending Brush and Eraser handoffs");
    }

    const brushAcknowledgement = {
      commitId: brushGroup.replacement.commitId,
      groupId: brushGroup.groupId,
      nodeId: brushGroup.nodeId,
    };
    const eraserAcknowledgement = {
      commitId: eraserGroup.replacement.commitId,
      groupId: eraserGroup.groupId,
      nodeId: eraserGroup.nodeId,
    };

    editor.acknowledgeRasterPresentation = acknowledgePresentation;
    const acknowledgedEraser = acknowledgePresentation(eraserAcknowledgement);
    const afterEraser = editor
      .getRasterWorkingPresentations()
      .flatMap((presentation) => presentation.groups)
      .map((group) => group.groupId);
    const duplicateEraser = acknowledgePresentation(eraserAcknowledgement);
    const staleBrush = acknowledgePresentation({
      ...brushAcknowledgement,
      commitId: `${brushAcknowledgement.commitId}-stale`,
    });
    const afterStale = editor
      .getRasterWorkingPresentations()
      .flatMap((presentation) => presentation.groups)
      .map((group) => group.groupId);
    const acknowledgedBrush = acknowledgePresentation(brushAcknowledgement);

    return {
      acknowledgedBrush,
      acknowledgedEraser,
      afterEraser,
      afterStale,
      brushGroupId: brushGroup.groupId,
      brushOwnedCount: brush.getWorkingGroups().length,
      duplicateEraser,
      eraserGroupId: eraserGroup.groupId,
      eraserOwnedCount: eraser.getWorkingGroups().length,
      finalCount: editor
        .getRasterWorkingPresentations()
        .flatMap((presentation) => presentation.groups).length,
      initialCount: aggregated.length,
      staleBrush,
    };
  });

  expect(result).toEqual({
    acknowledgedBrush: true,
    acknowledgedEraser: true,
    afterEraser: [result.brushGroupId],
    afterStale: [result.brushGroupId],
    brushGroupId: expect.any(String),
    brushOwnedCount: 0,
    duplicateEraser: false,
    eraserGroupId: expect.any(String),
    eraserOwnedCount: 0,
    finalCount: 0,
    initialCount: 2,
    staleBrush: false,
  });
});

test("canvas encode failure rolls back history and releases handoff readiness", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(page, createSmallImageDocument(src));
  const result = await page.evaluate(async (initialSrc) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected Canvas Raster brush target");
    }

    editor.select(node.id);
    editor.setActiveTool("brush");
    editor.resetHistory();
    editor.rasterSurface?.retainTargets?.([]);
    const session = brush.beginStroke({
      point: {
        x: node.transform.x + 24,
        y: node.transform.y + 24,
      },
    });

    if (!session) {
      throw new Error("Expected Canvas Raster stroke");
    }

    await session.ready;
    const group = editor.getRasterWorkingPresentation(node.id)?.groups.at(-1);

    if (group?.content.kind !== "canvas") {
      throw new Error("Expected Canvas working presentation");
    }

    group.content.canvas.toDataURL = () => {
      throw new Error("forced encode failure");
    };

    let errorMessage: string | null = null;

    try {
      await session.complete({
        point: {
          x: node.transform.x + 72,
          y: node.transform.y + 72,
        },
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const handoffReleased = await Promise.race([
      session.getHandoffReady().then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
    ]);
    const durableNode = editor.getNode(node.id);

    return {
      canUndo: editor.canUndo,
      durableSource:
        durableNode?.type === "image" ? (durableNode.src ?? null) : null,
      errorMessage,
      groupCount:
        editor.getRasterWorkingPresentation(node.id)?.groups.length ?? 0,
      handoffReleased,
      initialSrc,
    };
  }, src);

  expect(result).toEqual({
    canUndo: false,
    durableSource: src,
    errorMessage: "forced encode failure",
    groupCount: 0,
    handoffReleased: true,
    initialSrc: src,
  });
});

test("canvas update failure rolls back its exact history mark and handoff", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(page, createSmallImageDocument(src));
  const result = await page.evaluate(async (initialSrc) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected Canvas Raster brush target");
    }

    editor.select(node.id);
    editor.setActiveTool("brush");
    editor.resetHistory();
    editor.rasterSurface?.retainTargets?.([]);
    const session = brush.beginStroke({
      point: {
        x: node.transform.x + 24,
        y: node.transform.y + 24,
      },
    });

    if (!session) {
      throw new Error("Expected Canvas Raster stroke");
    }

    await session.ready;
    const state = editor.getState();
    const updateNodeById = state.updateNodeById;

    state.updateNodeById = () => {
      throw new Error("forced update failure");
    };

    let errorMessage: string | null = null;

    try {
      await session.complete({
        point: {
          x: node.transform.x + 72,
          y: node.transform.y + 72,
        },
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      editor.getState().updateNodeById = updateNodeById;
    }

    const handoffReleased = await Promise.race([
      session.getHandoffReady().then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
    ]);
    const durableNode = editor.getNode(node.id);

    return {
      canUndo: editor.canUndo,
      durableSource:
        durableNode?.type === "image" ? (durableNode.src ?? null) : null,
      errorMessage,
      groupCount:
        editor.getRasterWorkingPresentation(node.id)?.groups.length ?? 0,
      handoffReleased,
      initialSrc,
    };
  }, src);

  expect(result).toEqual({
    canUndo: false,
    durableSource: src,
    errorMessage: "forced update failure",
    groupCount: 0,
    handoffReleased: true,
    initialSrc: src,
  });
});

test("async Frame tile failure releases its queued follow-up session", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 5400,
          id: "failure-frame",
          locked: false,
          name: "Failure Frame",
          parentId: "root",
          transform: transform(0, 0),
          type: "artboard",
          visible: true,
          width: 4500,
        },
        {
          assetId: "failure-raster-asset",
          height: 5400,
          id: "failure-raster",
          mimeType: "image/png",
          name: "Failure Raster",
          opacity: 1,
          parentId: "failure-frame",
          src,
          transform: transform(0, 0),
          type: "image",
          visible: true,
          width: 4500,
        },
      ],
      version: DOCUMENT_VERSION,
    })
  );
  await setFrameBrushTestZoom(page);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const frame = editor?.getNode("failure-frame");
    const raster = editor?.getNode("failure-raster");
    const bounds = editor?.getNodeRenderFrame("failure-frame")?.bounds;

    if (
      !(
        editor &&
        brush &&
        frame?.type === "artboard" &&
        raster?.type === "image" &&
        bounds
      )
    ) {
      throw new Error("Expected large Frame Raster target");
    }

    editor.select(raster.id);
    editor.setActiveTool("brush");
    editor.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 100,
        smoothing: 0,
        spacing: 0,
      },
      "brush"
    );
    const toWorldPoint = (ratio) => ({
      x: bounds.minX + bounds.width * ratio.x,
      y: bounds.minY + bounds.height * ratio.y,
    });
    const points = Array.from({ length: 8 }, (_, row) => {
      const y = 0.06 + row * 0.12;

      return row % 2 === 0
        ? [
            { x: 0.06, y },
            { x: 0.94, y },
          ]
        : [
            { x: 0.94, y },
            { x: 0.06, y },
          ];
    })
      .flat()
      .map(toWorldPoint);
    const first = brush.beginStroke({ point: points[0] });

    if (!first) {
      throw new Error("Expected first Frame stroke");
    }

    for (const point of points.slice(1)) {
      first.update({ point });
    }

    const group = editor
      .getRasterWorkingPresentations()
      .flatMap((presentation) => presentation.groups)
      .at(-1);

    if (group?.content.kind !== "tiles") {
      throw new Error("Expected tiled working presentation");
    }

    if (group.content.tiles.length <= 16) {
      throw new Error("Expected async tiled commit");
    }

    const toDataUrl = HTMLCanvasElement.prototype.toDataURL;

    HTMLCanvasElement.prototype.toDataURL = () => {
      throw new Error("forced async tile encode failure");
    };

    const firstCommit = first.complete({ point: points.at(-1) });
    const second = brush.beginStroke({
      point: toWorldPoint({ x: 0.25, y: 0.25 }),
    });

    if (!second) {
      throw new Error("Expected queued Frame follow-up");
    }

    let firstError: string | null = null;
    let secondError: string | null = null;

    try {
      await second.ready;
    } catch (error) {
      secondError = error instanceof Error ? error.message : String(error);
    }
    try {
      await firstCommit;
    } catch (error) {
      firstError = error instanceof Error ? error.message : String(error);
    }
    HTMLCanvasElement.prototype.toDataURL = toDataUrl;

    const third = brush.beginStroke({
      point: toWorldPoint({ x: 0.75, y: 0.75 }),
    });

    if (!third) {
      throw new Error("Expected follow-up after failed commit");
    }

    const thirdActivated = Boolean(third.delegate);

    third.cancel();
    return {
      firstError,
      secondError,
      thirdActivated,
    };
  });

  expect(result).toEqual({
    firstError: "forced async tile encode failure",
    secondError: "forced async tile encode failure",
    thirdActivated: true,
  });
});

test("replacement decode failure preserves later history and settles standalone follow-up", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(page, createSmallImageDocument(src));
  const result = await page.evaluate(async (initialSrc) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected Canvas Raster brush target");
    }

    editor.select(node.id);
    editor.setActiveTool("brush");
    editor.resetHistory();
    editor.rasterSurface?.retainTargets?.([]);
    const session = brush.beginStroke({
      point: {
        x: node.transform.x + 24,
        y: node.transform.y + 24,
      },
    });

    if (!session) {
      throw new Error("Expected Canvas Raster stroke");
    }

    await session.ready;
    const group = editor.getRasterWorkingPresentation(node.id)?.groups.at(-1);

    if (group?.content.kind !== "canvas") {
      throw new Error("Expected Canvas working presentation");
    }

    group.content.canvas.toDataURL = () =>
      "data:image/png;base64,not-a-decodable-png";
    await session.complete({
      point: {
        x: node.transform.x + 72,
        y: node.transform.y + 72,
      },
    });
    editor.addShapeNode({ x: 900, y: 500 });
    const laterShape = editor.nodes.find(
      (candidate) => candidate.type === "shape"
    );
    const handoffReleased = await Promise.race([
      session.getHandoffReady().then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 500)),
    ]);
    editor.select(node.id);
    editor.setActiveTool("brush");
    const followup = brush.beginStroke({
      point: {
        x: node.transform.x + 48,
        y: node.transform.y + 48,
      },
    });
    const followupSettled = followup
      ? await Promise.race([
          followup.ready.then(() => true),
          new Promise<false>((resolve) =>
            setTimeout(() => resolve(false), 100)
          ),
        ])
      : false;
    const followupActivated = Boolean(followup?.delegate);

    followup?.cancel();
    const durableNode = editor.getNode(node.id);
    const failedGroup = editor
      .getRasterWorkingPresentation(node.id)
      ?.groups.at(-1);

    return {
      canUndo: editor.canUndo,
      durableSource:
        durableNode?.type === "image" ? (durableNode.src ?? null) : null,
      failedContentKind: failedGroup?.content.kind ?? null,
      failedPhase: failedGroup?.phase ?? null,
      followupActivated,
      followupSettled,
      groupCount:
        editor.getRasterWorkingPresentation(node.id)?.groups.length ?? 0,
      handoffReleased,
      initialSrc,
      laterShapeType: laterShape ? editor.getNode(laterShape.id)?.type : null,
    };
  }, src);

  expect(result).toEqual({
    canUndo: true,
    durableSource: "data:image/png;base64,not-a-decodable-png",
    failedContentKind: "canvas",
    failedPhase: "presentation-failed",
    followupActivated: false,
    followupSettled: true,
    groupCount: 1,
    handoffReleased: true,
    initialSrc: src,
    laterShapeType: "shape",
  });
});

test("deleting an active Raster releases its stroke history mark", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);

  await loadRasterTestDocument(page, createLargeImageDocument(src));
  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected large Raster brush target");
    }

    editor.select(node.id);
    editor.setActiveTool("brush");
    const session = brush.beginStroke({
      point: {
        x: node.transform.x + 120,
        y: node.transform.y + 160,
      },
    });

    if (!session) {
      throw new Error("Expected Raster stroke");
    }

    await session.ready;
    session.update({
      point: {
        x: node.transform.x + 320,
        y: node.transform.y + 260,
      },
    });
    editor.deleteNode(node.id);
    const groupCountAfterDelete = editor
      .getRasterWorkingPresentations()
      .flatMap((presentation) => presentation.groups).length;
    const didUndo = editor.undo();

    return {
      didUndo,
      groupCountAfterDelete,
      restoredNodeType: editor.getNode(node.id)?.type || null,
    };
  });

  expect(result).toEqual({
    didUndo: true,
    groupCountAfterDelete: 0,
    restoredNodeType: "image",
  });
});

test("async tiled working surface stays mounted through commit paint handoff", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    const node = editor.getNode("large-image-1");

    if (node?.type !== "image") {
      return;
    }

    editor.updateNode("large-image-1", {
      baseHeight: 337,
      baseWidth: 306,
      height: 337,
      width: 306,
    });
    editor.select("large-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.onViewportChange?.();
  });
  await page.keyboard.press("b");

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    const heldAcknowledgements: RasterPresentationAcknowledgement[] = [];
    const acknowledgePresentation =
      editor.acknowledgeRasterPresentation.bind(editor);

    editor.acknowledgeRasterPresentation = (acknowledgement) => {
      heldAcknowledgements.push(acknowledgement);
      return false;
    };

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 120, y: 160 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    await session.ready;

    for (let index = 1; index <= 160; index += 1) {
      const progress = index / 160;

      session.update({
        point: toWorldPoint({
          x: 120 + 72_000 * progress,
          y: 160 + Math.sin(progress * Math.PI * 1.6) * 52_000,
        }),
      });
    }

    for (let index = 0; index < 6; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const commit = session.complete({
      point: toWorldPoint({
        x: 72_120,
        y: 160,
      }),
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const previewCountDuringCommit = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;
    const workingGroupDuringCommit = editor
      .getRasterWorkingPresentation?.("large-image-1")
      ?.groups.at(-1);

    await commit;

    const previewCountAfterCommit = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;
    const workingGroupAfterCommit = editor
      .getRasterWorkingPresentation?.("large-image-1")
      ?.groups.at(-1);

    for (let index = 0; index < 5; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    editor.acknowledgeRasterPresentation = acknowledgePresentation;
    for (const acknowledgement of heldAcknowledgements) {
      acknowledgePresentation(acknowledgement);
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const previewCountAfterHandoff = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;
    const workingGroupAfterHandoff = editor
      .getRasterWorkingPresentation?.("large-image-1")
      ?.groups.at(-1);

    return {
      heldAcknowledgementCount: heldAcknowledgements.length,
      previewCountAfterCommit,
      previewCountAfterHandoff,
      previewCountDuringCommit,
      workingTileCountAfterHandoff:
        workingGroupAfterHandoff?.content.kind === "tiles"
          ? workingGroupAfterHandoff.content.tiles.length
          : 0,
      workingTileCountAfterCommit:
        workingGroupAfterCommit?.content.kind === "tiles"
          ? workingGroupAfterCommit.content.tiles.length
          : 0,
      workingTileCountDuringCommit:
        workingGroupDuringCommit?.content.kind === "tiles"
          ? workingGroupDuringCommit.content.tiles.length
          : 0,
    };
  });

  expect(result.heldAcknowledgementCount).toBeGreaterThan(0);
  expect(result.previewCountDuringCommit).toBe(0);
  expect(result.workingTileCountDuringCommit).toBeGreaterThan(0);
  expect(result.previewCountAfterCommit).toBe(0);
  expect(result.workingTileCountAfterCommit).toBeGreaterThan(0);
  expect(result.previewCountAfterHandoff).toBe(0);
  expect(result.workingTileCountAfterHandoff).toBe(0);
});

test("quick low-zoom tiled brush strokes stay visible through release", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");

    if (!(editor && node?.type === "image")) {
      throw new Error("Expected huge image node");
    }

    editor.select("huge-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: 0,
      y: 0,
      zoom: 0.07,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.({
      x: 0,
      y: 0,
      zoom: 0.07,
    });
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? 0,
      y: editor.viewerRef?.getScrollTop?.() ?? 0,
      zoom: 0.07,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    editor.onViewportChange?.();
  });
  await page.keyboard.press("b");

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("huge-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and huge image node");
    }

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const start = { x: 900, y: 900 };
    const end = { x: 49_000, y: 31_000 };
    const session = brush.beginStroke({ point: toWorldPoint(start) });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = session;
    await session.ready;
    session.update({ point: toWorldPoint(end) });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const beforeRelease = await getRasterWorkingTileRenderedBounds(page);

  expect(beforeRelease?.tileCount).toBeGreaterThan(10);
  expect(beforeRelease?.width).toBeGreaterThan(500);

  const framesAfterRelease = await page.evaluate(async () => {
    const getBounds = () => {
      const tiles = [
        ...document.querySelectorAll<SVGForeignObjectElement>(
          "[data-testid='raster-working-tile']"
        ),
      ];

      if (!tiles.length) {
        return null;
      }

      const bounds = tiles.reduce(
        (currentBounds, tile) => {
          const rect = tile.getBoundingClientRect();

          return {
            bottom: Math.max(currentBounds.bottom, rect.bottom),
            left: Math.min(currentBounds.left, rect.left),
            right: Math.max(currentBounds.right, rect.right),
            top: Math.min(currentBounds.top, rect.top),
          };
        },
        {
          bottom: Number.NEGATIVE_INFINITY,
          left: Number.POSITIVE_INFINITY,
          right: Number.NEGATIVE_INFINITY,
          top: Number.POSITIVE_INFINITY,
        }
      );

      return {
        ...bounds,
        height: bounds.bottom - bounds.top,
        tileCount: tiles.length,
        width: bounds.right - bounds.left,
      };
    };
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(node?.type === "image" && session)) {
      throw new Error("Expected active brush session");
    }

    const end = {
      x: node.transform.x + 49_000,
      y: node.transform.y + 31_000,
    };
    const commit = session.complete({ point: end });
    const frames: ReturnType<typeof getBounds>[] = [];

    for (let index = 0; index < 4; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      frames.push(getBounds());
    }

    await commit;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    frames.push(getBounds());
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
    return frames;
  });
  const visibleFrames = framesAfterRelease.filter(Boolean);

  expect(visibleFrames, JSON.stringify(framesAfterRelease)).toHaveLength(
    framesAfterRelease.length
  );

  for (const frame of visibleFrames) {
    expect(frame.tileCount, JSON.stringify(framesAfterRelease)).toBeGreaterThan(
      10
    );
    expect(frame.width, JSON.stringify(framesAfterRelease)).toBeGreaterThan(
      beforeRelease.width * 0.9
    );
    expect(frame.height, JSON.stringify(framesAfterRelease)).toBeGreaterThan(
      beforeRelease.height * 0.9
    );
  }
});

test("quick low-zoom tiled brush strokes do not visually flash after release", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("huge-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and huge image node");
    }

    editor.select("huge-image-1");
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const firstSession = brush.beginStroke({
      point: toWorldPoint({ x: 6000, y: 1600 }),
    });

    if (!firstSession) {
      throw new Error("Expected first brush stroke session");
    }

    await firstSession.ready;
    firstSession.update({ point: toWorldPoint({ x: 85_000, y: 1600 }) });
    await firstSession.complete({
      point: toWorldPoint({ x: 85_000, y: 1600 }),
    });

    const imageNode = editor.getNode("huge-image-1");

    if (imageNode?.type !== "image") {
      throw new Error("Expected committed huge image node");
    }

    const viewport = {
      x: 0,
      y: 0,
      zoom: 0.07,
    };

    editor.setViewportInteracting(false);
    editor.setViewport(viewport);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.(viewport);
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? viewport.x,
      y: editor.viewerRef?.getScrollTop?.() ?? viewport.y,
      zoom: viewport.zoom,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  await page.keyboard.press("b");

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("huge-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and huge image node");
    }

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 6000, y: 6200 }),
    });

    if (!session) {
      throw new Error("Expected second brush stroke session");
    }

    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = session;
    await session.ready;
    session.update({ point: toWorldPoint({ x: 38_000, y: 8200 }) });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const frameStats = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(node?.type === "image" && session)) {
      throw new Error("Expected active brush session");
    }

    const heldAcknowledgements: RasterPresentationAcknowledgement[] = [];
    const acknowledgePresentation =
      editor.acknowledgeRasterPresentation.bind(editor);

    editor.acknowledgeRasterPresentation = (acknowledgement) => {
      heldAcknowledgements.push(acknowledgement);
      return false;
    };

    const commit = session.complete({
      point: {
        x: node.transform.x + 38_000,
        y: node.transform.y + 8200,
      },
    });
    const frames: Array<{
      atomicHandoff: boolean;
      committedTileCount: number;
      exactTileDomCount: number;
      hasBlank: boolean;
      hasOverlap: boolean;
      presentationOwner: string | null;
      workingVisible: boolean;
    }> = [];

    for (let index = 0; index < 40; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const renderer = document.querySelector(
        "[data-raster-node-id='huge-image-1']"
      );
      const presentation =
        editor.getRasterWorkingPresentation?.("huge-image-1");
      const awaitingGroups =
        presentation?.groups.filter(
          (group) => group.phase === "awaiting-presentation"
        ) || [];
      const mountedWorkingGroupIds = new Set(
        [
          ...(renderer?.querySelectorAll("[data-raster-working-group-id]") ||
            []),
        ].map((element) => element.getAttribute("data-raster-working-group-id"))
      );
      const mountedTileRefs = new Set(
        [...(renderer?.querySelectorAll("[data-raster-tile-ref]") || [])]
          .filter((element) => element.getAttribute("opacity") !== "0")
          .map((element) => element.getAttribute("data-raster-tile-ref"))
      );
      const hasOverlap = awaitingGroups.some(
        (group) =>
          mountedWorkingGroupIds.has(group.groupId) &&
          group.replacement?.resourceIds.some((resourceId) =>
            mountedTileRefs.has(resourceId)
          )
      );
      const hasBlank = awaitingGroups.some(
        (group) =>
          !(
            mountedWorkingGroupIds.has(group.groupId) ||
            renderer?.getAttribute("data-raster-presentation-owner") ===
              "preview" ||
            group.replacement?.resourceIds.some((resourceId) =>
              mountedTileRefs.has(resourceId)
            )
          )
      );

      frames.push({
        atomicHandoff:
          renderer?.getAttribute("data-raster-atomic-handoff") === "true",
        committedTileCount:
          editor.getNode("huge-image-1")?.tileSources?.length || 0,
        exactTileDomCount: document.querySelectorAll("[data-raster-tile-ref]")
          .length,
        hasBlank,
        hasOverlap,
        presentationOwner:
          renderer?.getAttribute("data-raster-presentation-owner") || null,
        workingVisible: mountedWorkingGroupIds.size > 0,
      });

      if (heldAcknowledgements.length > 0 && frames.at(-1)?.atomicHandoff) {
        break;
      }
    }

    await commit;
    editor.acknowledgeRasterPresentation = acknowledgePresentation;
    for (const acknowledgement of heldAcknowledgements) {
      acknowledgePresentation(acknowledgement);
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const renderer = document.querySelector(
      "[data-raster-node-id='huge-image-1']"
    );
    frames.push({
      atomicHandoff:
        renderer?.getAttribute("data-raster-atomic-handoff") === "true",
      committedTileCount:
        editor.getNode("huge-image-1")?.tileSources?.length || 0,
      exactTileDomCount: document.querySelectorAll("[data-raster-tile-ref]")
        .length,
      hasBlank: false,
      hasOverlap: false,
      presentationOwner:
        renderer?.getAttribute("data-raster-presentation-owner") || null,
      workingVisible:
        renderer?.querySelector("[data-raster-working-group-id]") !== null,
    });
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
    return frames;
  });
  const atomicFrames = frameStats.filter((frame) => frame.atomicHandoff);
  const overlappingFrame = atomicFrames.find((frame) => frame.hasOverlap);
  const blankFrame = atomicFrames.find((frame) => frame.hasBlank);

  expect(atomicFrames.length, JSON.stringify(frameStats)).toBeGreaterThan(0);
  expect(overlappingFrame, JSON.stringify(frameStats)).toBeUndefined();
  expect(blankFrame, JSON.stringify(frameStats)).toBeUndefined();
  expect(frameStats.at(-1), JSON.stringify(frameStats)).toMatchObject({
    workingVisible: false,
  });
});

test("diagnoses repeated low-zoom brush release visibility", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("huge-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and huge image node");
    }

    editor.select("huge-image-1");
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const seedSession = brush.beginStroke({
      point: toWorldPoint({ x: 1200, y: 8600 }),
    });

    if (!seedSession) {
      throw new Error("Expected seed brush stroke session");
    }

    await seedSession.ready;

    for (let index = 1; index <= 32; index += 1) {
      const progress = index / 32;

      seedSession.update({
        point: toWorldPoint({
          x: 1200 + 58_000 * progress,
          y: 8600 - Math.sin(progress * Math.PI) * 7600,
        }),
      });
    }

    await seedSession.complete({
      point: toWorldPoint({ x: 59_200, y: 8600 }),
    });

    const imageNode = editor.getNode("huge-image-1");

    if (imageNode?.type !== "image") {
      throw new Error("Expected committed huge image node");
    }

    const viewport = {
      x: 0,
      y: 0,
      zoom: 0.07,
    };

    editor.setViewportInteracting(false);
    editor.setViewport(viewport);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.(viewport);
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? viewport.x,
      y: editor.viewerRef?.getScrollTop?.() ?? viewport.y,
      zoom: viewport.zoom,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  await page.keyboard.press("b");

  const clip = await page.evaluate(() => ({
    height: Math.max(1, Math.min(560, window.innerHeight - 180)),
    width: Math.max(1, Math.min(860, window.innerWidth - 560)),
    x: 260,
    y: 90,
  }));
  const strokes = [
    Array.from({ length: 30 }, (_, index) => {
      const progress = index / 29;

      return {
        x: 1200 + 21_000 * progress,
        y: 8200 - Math.sin(progress * Math.PI) * 7200,
      };
    }),
    Array.from({ length: 24 }, (_, index) => {
      const progress = index / 23;

      return {
        x: 800 + 22_000 * progress,
        y: 1800 + Math.sin(progress * Math.PI) * 5800,
      };
    }),
    Array.from({ length: 22 }, (_, index) => {
      const progress = index / 21;

      return {
        x: 3000 + 18_000 * progress,
        y: 1200 + 7800 * progress,
      };
    }),
  ];
  const diagnostics: Awaited<ReturnType<typeof getRasterFrameDiagnostic>>[] =
    [];

  for (const [strokeIndex, stroke] of strokes.entries()) {
    await page.evaluate(async (points) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const brush = editor?.tools.get("brush");
      const node = editor?.getNode("huge-image-1");

      if (!(editor && brush && node?.type === "image")) {
        throw new Error("Expected brush and huge image node");
      }

      const toWorldPoint = (point) => ({
        x: node.transform.x + point.x,
        y: node.transform.y + point.y,
      });
      const [startPoint, ...remainingPoints] = points;
      const session = brush.beginStroke({ point: toWorldPoint(startPoint) });

      if (!session) {
        throw new Error("Expected diagnostic brush stroke session");
      }

      window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = session;
      await session.ready;

      for (const point of remainingPoints) {
        session.update({ point: toWorldPoint(point) });
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }, stroke);

    diagnostics.push(
      await getRasterFrameDiagnostic({
        clip,
        frameIndex: 0,
        page,
        phase: "before-release",
        strokeIndex,
      })
    );

    await page.evaluate((endPoint) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const node = editor?.getNode("huge-image-1");
      const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

      if (!(node?.type === "image" && session)) {
        throw new Error("Expected active brush session");
      }

      session.complete({
        point: {
          x: node.transform.x + endPoint.x,
          y: node.transform.y + endPoint.y,
        },
      });
    }, stroke.at(-1));

    for (let frameIndex = 1; frameIndex <= 8; frameIndex += 1) {
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(resolve))
      );
      diagnostics.push(
        await getRasterFrameDiagnostic({
          clip,
          frameIndex,
          page,
          phase: "after-release",
          strokeIndex,
        })
      );
    }

    await page.evaluate(async () => {
      await window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__?.ready;
      window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  }

  await testInfo.attach("raster-release-diagnostics", {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json",
  });

  const failures = diagnostics.flatMap((frame) => {
    if (frame.phase !== "after-release") {
      return [];
    }

    const beforeRelease = diagnostics.find(
      (candidate) =>
        candidate.strokeIndex === frame.strokeIndex &&
        candidate.phase === "before-release"
    );

    if (!(beforeRelease?.pixels.inkCentroid && frame.pixels.inkCentroid)) {
      return [{ frame, reason: "missing-ink" }];
    }

    const centroidDelta = Math.hypot(
      frame.pixels.inkCentroid.x - beforeRelease.pixels.inkCentroid.x,
      frame.pixels.inkCentroid.y - beforeRelease.pixels.inkCentroid.y
    );
    const beforeBounds = beforeRelease.pixels.darkBounds;
    const afterBounds = frame.pixels.darkBounds;
    const boundsStable =
      beforeBounds &&
      afterBounds &&
      afterBounds.width >= beforeBounds.width * 0.98 &&
      afterBounds.height >= beforeBounds.height * 0.98;
    const isValid =
      frame.pixels.inkWeight >= beforeRelease.pixels.inkWeight * 0.98 &&
      centroidDelta <= 2 &&
      boundsStable &&
      frame.state.presentationOwner !== "exact" &&
      !(
        frame.state.presentationOwner === "preview" &&
        frame.state.exactTileDomCount > 0
      );

    return isValid
      ? []
      : [
          {
            afterBounds,
            afterCentroid: frame.pixels.inkCentroid,
            afterInkWeight: frame.pixels.inkWeight,
            beforeBounds,
            beforeCentroid: beforeRelease.pixels.inkCentroid,
            beforeInkWeight: beforeRelease.pixels.inkWeight,
            centroidDelta,
            exactTileDomCount: frame.state.exactTileDomCount,
            frameIndex: frame.frameIndex,
            presentationOwner: frame.state.presentationOwner,
            previewReady: frame.state.previewReady,
            strokeIndex: frame.strokeIndex,
          },
        ];
  });
  const ownerTransitions = strokes.map((_, strokeIndex) => {
    const owners = diagnostics
      .filter((frame) => frame.strokeIndex === strokeIndex)
      .map((frame) => frame.state.presentationOwner);

    return owners.filter((owner, index) => owner !== owners[index - 1]);
  });

  expect(ownerTransitions).toEqual(strokes.map(() => ["working", "preview"]));
  expect(failures).toEqual([]);
});

test("real pointer extreme zoom brush release does not blank visible ink", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  await gotoEditor(page);
  await loadRasterTestDocument(page, createExtremeArtboardDocument());
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected editor");
    }

    const emptyLayerId = "empty-layer";
    editor.insertNodes([
      {
        id: emptyLayerId,
        name: "Layer",
        opacity: 1,
        parentId: "artboard-1",
        type: "empty",
        visible: true,
      },
    ]);
    const zoom = 0.01;
    const viewport = {
      x: 0,
      y: 0,
      zoom,
    };

    editor.select(emptyLayerId);
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    editor.setViewportInteracting(false);
    editor.setViewport(viewport);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.(viewport);
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? viewport.x,
      y: editor.viewerRef?.getScrollTop?.() ?? viewport.y,
      zoom: viewport.zoom,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  await page.keyboard.press("b");

  const geometry = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewerRect = editor?.viewerRef
      ?.getContainer?.()
      ?.getBoundingClientRect?.();
    const viewport = editor?.viewport;

    if (!(editor && viewerRect && viewport)) {
      throw new Error("Expected extreme zoom brush geometry");
    }

    const points = [
      { x: 320, y: 515 },
      { x: 500, y: 215 },
      { x: 635, y: 415 },
      { x: 765, y: 145 },
      { x: 910, y: 535 },
    ];

    return {
      clip: {
        height: Math.min(580, window.innerHeight - 100),
        width: Math.min(840, window.innerWidth - 360),
        x: 260,
        y: 70,
      },
      points,
      viewport,
      viewerRect: {
        height: viewerRect.height,
        left: viewerRect.left,
        top: viewerRect.top,
        width: viewerRect.width,
      },
    };
  });
  const baseline = await getScreenshotInkPixelStats(page, geometry.clip);
  const expandedStrokePoints = geometry.points.flatMap(
    (point, index, points) => {
      if (index === 0) {
        return [point];
      }

      const previousPoint = points[index - 1];

      return Array.from({ length: 14 }, (_, segmentIndex) => {
        const progress = (segmentIndex + 1) / 14;

        return {
          x: previousPoint.x + (point.x - previousPoint.x) * progress,
          y: previousPoint.y + (point.y - previousPoint.y) * progress,
        };
      });
    }
  );
  const [startPoint, ...strokePoints] = expandedStrokePoints;
  const screencastFrames = await captureScreencastFrames(
    page,
    async () => {
      await page.mouse.move(startPoint.x, startPoint.y);
      await page.mouse.down();

      for (const point of strokePoints) {
        await page.mouse.move(point.x, point.y, { steps: 1 });
        await page.waitForTimeout(12);
      }

      await page.waitForTimeout(180);
      await page.mouse.up();
    },
    { postRollMs: 1600, preRollMs: 200 }
  );
  const frames = await getScreencastInkFrameStats(
    page,
    screencastFrames,
    geometry.clip
  );
  const finalState = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.nodes.find((candidate) => candidate.type === "image");
    const rasterRoot = document.querySelector("[data-raster-node-id]");
    const workingGroup =
      node?.type === "image"
        ? editor?.getRasterWorkingPresentation?.(node.id)?.groups.at(-1)
        : null;
    const workingSurfaceElement = document.querySelector(
      "[data-raster-working-surface]"
    );

    return {
      activeTool: editor?.activeTool || null,
      committedTileCount: node?.tileSources?.length || 0,
      exactTileDomCount: document.querySelectorAll("[data-raster-tile-ref]")
        .length,
      exactTilesReady:
        rasterRoot?.getAttribute("data-raster-exact-tiles-ready") || null,
      loadedExactTileCount: Number(
        rasterRoot?.getAttribute("data-raster-loaded-exact-tile-count") || 0
      ),
      node:
        node?.type === "image"
          ? {
              height: node.height,
              transform: node.transform,
              width: node.width,
            }
          : null,
      previewActive:
        document.querySelector('[data-raster-preview-active="true"]') !== null,
      previewReady:
        document.querySelector('[data-raster-preview-ready="true"]') !== null,
      workingSurfaceCompleted:
        workingSurfaceElement?.getAttribute("data-raster-working-completed") ||
        null,
      workingSurfaceType: workingGroup?.content.kind || null,
      workingTileCount:
        workingGroup?.content.kind === "tiles"
          ? workingGroup.content.tiles.length
          : 0,
    };
  });

  const baselineInkWeight = Math.min(
    baseline.inkWeight,
    ...frames.slice(0, 4).map((frame) => frame.inkWeight)
  );
  const visibleWeights = frames.map(
    (frame) => frame.inkWeight - baselineInkWeight
  );
  const maxVisibleInkWeight = Math.max(...visibleWeights);
  const firstHighFrameIndex = visibleWeights.findIndex(
    (visibleInkWeight) => visibleInkWeight >= maxVisibleInkWeight * 0.8
  );
  const dips = frames.flatMap((frame, index) => {
    if (index <= firstHighFrameIndex) {
      return [];
    }

    const visibleInkWeight = visibleWeights[index];
    const laterHighFrame = visibleWeights
      .slice(index + 1)
      .some((candidate) => candidate >= maxVisibleInkWeight * 0.7);

    if (visibleInkWeight >= maxVisibleInkWeight * 0.35 || !laterHighFrame) {
      return [];
    }

    return [
      {
        frameIndex: frame.index,
        inkWeight: frame.inkWeight,
        maxVisibleInkWeight,
        timestamp: frame.timestamp,
        visibleInkWeight,
      },
    ];
  });

  await testInfo.attach("real-pointer-extreme-zoom-release", {
    body: JSON.stringify(
      {
        baseline,
        baselineInkWeight,
        dips,
        finalState,
        frames,
        geometry,
        maxVisibleInkWeight,
        screencastFrameCount: screencastFrames.length,
      },
      null,
      2
    ),
    contentType: "application/json",
  });
  expect(maxVisibleInkWeight).toBeGreaterThan(300);
  expect(dips).toEqual([]);
});

test("completed tiled working surface waits for raster render acknowledgement", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    const node = editor.getNode("large-image-1");

    if (node?.type !== "image") {
      return;
    }

    editor.updateNode("large-image-1", {
      baseHeight: 337,
      baseWidth: 306,
      height: 337,
      width: 306,
    });
    editor.select("large-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.onViewportChange?.();
  });
  await page.keyboard.press("b");

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    const heldAcknowledgements: RasterPresentationAcknowledgement[] = [];
    const acknowledgePresentation =
      editor.acknowledgeRasterPresentation.bind(editor);

    editor.acknowledgeRasterPresentation = (acknowledgement) => {
      heldAcknowledgements.push(acknowledgement);
      return false;
    };

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 120, y: 160 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    await session.ready;

    for (let index = 1; index <= 160; index += 1) {
      const progress = index / 160;

      session.update({
        point: toWorldPoint({
          x: 120 + 72_000 * progress,
          y: 160 + Math.sin(progress * Math.PI * 1.6) * 52_000,
        }),
      });
    }

    for (let index = 0; index < 6; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const commit = session.complete({
      point: toWorldPoint({
        x: 72_120,
        y: 160,
      }),
    });

    await commit;

    for (let index = 0; index < 90; index += 1) {
      if (heldAcknowledgements.length > 0) {
        break;
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const previewCountWithoutAck = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;
    const workingGroupWithoutAck = editor
      .getRasterWorkingPresentation?.("large-image-1")
      ?.groups.at(-1);
    const heldAcknowledgementCount = heldAcknowledgements.length;

    editor.acknowledgeRasterPresentation = acknowledgePresentation;

    for (const acknowledgement of heldAcknowledgements) {
      acknowledgePresentation(acknowledgement);
    }

    for (let index = 0; index < 4; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const previewCountAfterAck = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;
    const workingGroupAfterAck = editor
      .getRasterWorkingPresentation?.("large-image-1")
      ?.groups.at(-1);

    return {
      heldAcknowledgementCount,
      previewCountAfterAck,
      previewCountWithoutAck,
      workingTileCountAfterAck:
        workingGroupAfterAck?.content.kind === "tiles"
          ? workingGroupAfterAck.content.tiles.length
          : 0,
      workingTileCountWithoutAck:
        workingGroupWithoutAck?.content.kind === "tiles"
          ? workingGroupWithoutAck.content.tiles.length
          : 0,
    };
  });

  expect(result.heldAcknowledgementCount).toBeGreaterThan(0);
  expect(result.previewCountWithoutAck, JSON.stringify(result)).toBe(0);
  expect(
    result.workingTileCountWithoutAck,
    JSON.stringify(result)
  ).toBeGreaterThan(0);
  expect(result.previewCountAfterAck, JSON.stringify(result)).toBe(0);
  expect(result.workingTileCountAfterAck, JSON.stringify(result)).toBe(0);
});

test("tiled raster acknowledgement uses resource readiness without a timer", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createLargeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    const node = editor.getNode("large-image-1");

    if (node?.type !== "image") {
      return;
    }

    editor.updateNode("large-image-1", {
      baseHeight: 337,
      baseWidth: 306,
      height: 337,
      width: 306,
    });
    editor.select("large-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 600,
      y: node.transform.y - 500,
      zoom: 0.01,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.onViewportChange?.();
    window.__PUNCHPRESS_RASTER_DEBUG__?.clear();
  });
  await page.keyboard.press("b");

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("large-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 120, y: 160 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    await session.ready;

    for (let index = 1; index <= 160; index += 1) {
      const progress = index / 160;

      session.update({
        point: toWorldPoint({
          x: 120 + 72_000 * progress,
          y: 160 + Math.sin(progress * Math.PI * 1.6) * 52_000,
        }),
      });
    }

    const commit = session.complete({
      point: toWorldPoint({
        x: 72_120,
        y: 160,
      }),
    });

    await commit;

    const waitForAcknowledgement = async () => {
      for (let index = 0; index < 90; index += 1) {
        const records = window.__PUNCHPRESS_RASTER_DEBUG__?.getRecords() || [];
        const acknowledgement = records.find(
          (record) => record.event === "renderer.presentation.acknowledge"
        );

        if (acknowledgement) {
          return records;
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      throw new Error(
        "Timed out waiting for Raster presentation acknowledgement"
      );
    };

    const records = await waitForAcknowledgement();

    return {
      acknowledgementCount: records.filter(
        (record) => record.event === "renderer.presentation.acknowledge"
      ).length,
      timerReadinessEventCount: records.filter((record) =>
        record.event.startsWith("renderer.renderReady")
      ).length,
    };
  });

  expect(result.acknowledgementCount, JSON.stringify(result)).toBeGreaterThan(
    0
  );
  expect(result.timerReadinessEventCount, JSON.stringify(result)).toBe(0);
});

test("huge soft brush strokes use dirty tiles instead of a full layer pixel buffer", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  await setBrushSliderValue(page, "Brush size", 96);
  await setBrushSliderValue(page, "Brush opacity", 65);
  await setBrushSliderValue(page, "Brush hardness", 0);

  const start = await getCanvasStagePoint(page, { x: 360, y: 270 });
  const end = await getCanvasStagePoint(page, { x: 760, y: 520 });

  await dragBrush(page, [start, end], { release: false, steps: 24 });

  const workingSurface = await getRasterWorkingSurfaceState(page);

  expect(await getBrushPreviewState(page)).toBeNull();
  expect(workingSurface.tileSurfaceCount).toBe(1);
  expect(workingSurface.totalTileCount).toBeGreaterThan(0);

  await page.mouse.up();

  const imageState = await getCommittedImageState(page);
  const perf = await takeBrushPerfCapture(page);

  expect(imageState?.id).toBe("huge-image-1");
  expect(imageState?.tileSourceCount).toBeGreaterThan(0);
  expect(perf.counters["brush.tile.session"] || 0).toBe(1);
  expect(perf.counters["brush.tile.dab"] || 0).toBeGreaterThan(0);
  expect(perf.spans["brush.stroke.createFloatPixels"] || []).toHaveLength(0);
  expect(perf.spans["brush.commit.encode"] || []).toHaveLength(0);
});

test("huge tiled brush strokes preserve previous strokes in the same tile", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 64);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const point = await getCanvasStagePoint(page, { x: 360, y: 270 });

  await dragBrush(page, [point, point]);

  const firstState = await getCommittedImageState(page);

  await dragBrush(page, [point, point]);

  const secondState = await getCommittedImageState(page);

  expect(firstState?.tileSourceCount).toBeGreaterThan(0);
  expect(secondState?.tileSourceCount).toBeGreaterThan(
    firstState?.tileSourceCount || 0
  );
  expect(new Set(secondState?.tileSources.map((tile) => tile.ref)).size).toBe(
    secondState?.tileSourceCount
  );
});

test("huge tiled brush strokes commit overlap across tile boundaries", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");

    if (!(editor && brush)) {
      throw new Error("Expected brush tool");
    }

    editor.select("huge-image-1");
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 140,
      spacing: 0,
    });

    const node = editor.getNode("huge-image-1");

    if (node?.type !== "image") {
      throw new Error("Expected huge image node");
    }

    const toWorldPoint = (point) => ({
      x: node.transform.x + point.x,
      y: node.transform.y + point.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 420, y: 900 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    session.update({ point: toWorldPoint({ x: 620, y: 900 }) });
    session.complete({ point: toWorldPoint({ x: 620, y: 900 }) });
    await session.ready;
  });

  const imageState = await getCommittedImageState(page);
  const samples = await getCommittedTileSamples(page, [
    { x: 510, y: 900 },
    { x: 511, y: 900 },
    { x: 512, y: 900 },
    { x: 513, y: 900 },
  ]);
  const tileRanges = imageState?.tileSources.map((tile) => ({
    maxX: tile.x + tile.width,
    minX: tile.x,
  }));
  const overlapsTileBoundary = tileRanges?.some((tile) => {
    return (
      tile.minX < RASTER_TILE_TEST_SIZE && tile.maxX > RASTER_TILE_TEST_SIZE
    );
  });

  expect(imageState?.tileSourceCount).toBeGreaterThan(1);
  expect(overlapsTileBoundary).toBe(true);
  expect(samples).not.toBeNull();

  for (const sample of samples || []) {
    expect(sample.coveringTileCount).toBeGreaterThan(0);
    expect(sample.a).toBeGreaterThan(240);
    expect(sample.r).toBeLessThan(20);
    expect(sample.g).toBeLessThan(20);
    expect(sample.b).toBeLessThan(20);
  }
});

test("huge tiled brush strokes can extend beyond the current layer bounds", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await setViewport(page, { x: 0, y: 0, zoom: 0.05 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 96);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const point = { x: 6000, y: 11_200 };
    const session = brush?.beginStroke({ point });

    session?.complete({ point });
  });

  const imageState = await getCommittedImageState(page);

  expect(imageState?.id).toBe("huge-image-1");
  expect(imageState?.height).toBeGreaterThan(10_800);
  expect(
    imageState?.tileSources.every(
      (tile) => tile.y >= 0 && tile.y + tile.height <= imageState.height
    )
  ).toBe(true);
});

test("huge tiled brush bounds grow left and keep existing content pinned", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 96);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const point = { x: 160, y: 500 };
    const session = brush?.beginStroke({ point });

    session?.complete({ point });
  });

  const imageState = await getCommittedImageState(page);

  expect(imageState?.id).toBe("huge-image-1");
  expect(imageState?.width).toBeGreaterThan(12_400);
  expect(imageState?.x).toBeLessThan(220);
  expect(imageState?.baseX).toBeGreaterThan(0);
  expect(imageState?.baseWidth).toBe(12_400);
  expect(
    imageState?.tileSources.every(
      (tile) => tile.x >= 0 && tile.x + tile.width <= imageState.width
    )
  ).toBe(true);
});

test("extreme 40000px brush inputs stay bounded by a huge Raster", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("huge-image-1");
    editor?.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
  });
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");

    if (!(editor && brush)) {
      throw new Error("Expected brush tool");
    }

    const initialNode = editor.getNode("huge-image-1");

    if (initialNode?.type !== "image") {
      throw new Error("Expected huge image node");
    }

    const toWorldPoint = (localPoint) => ({
      x: initialNode.transform.x + localPoint.x,
      y: initialNode.transform.y + localPoint.y,
    });
    const center = {
      x: initialNode.width / 2,
      y: initialNode.height / 2,
    };
    const tinyEnd = {
      x: center.x + 32,
      y: center.y + 18,
    };
    const drawLine = async (start, end) => {
      const session = brush.beginStroke({ point: start });

      if (!session) {
        throw new Error("Expected brush stroke session");
      }

      session.update({ point: end });
      await session.complete({ point: end });
    };
    const hugeLength = 40_000;
    const angles = [0.19, 1.37, 2.48, 4.11];
    const endpoints = angles.map((angle) => ({
      x: center.x + Math.cos(angle) * hugeLength,
      y: center.y + Math.sin(angle) * hugeLength,
    }));
    const startedAt = performance.now();

    await drawLine(toWorldPoint(center), toWorldPoint(tinyEnd));

    for (const endpoint of endpoints) {
      await drawLine(toWorldPoint(center), toWorldPoint(endpoint));
    }

    const elapsedMs = performance.now() - startedAt;
    const imageNode = editor.getNode("huge-image-1");

    if (imageNode?.type !== "image") {
      throw new Error("Expected committed huge image node");
    }

    return {
      baseX: imageNode.baseX,
      baseY: imageNode.baseY,
      elapsedMs,
      height: imageNode.height,
      tileSources: imageNode.tileSources || [],
      transformX: imageNode.transform.x,
      transformY: imageNode.transform.y,
      width: imageNode.width,
    };
  });
  const perf = await takeBrushPerfCapture(page);
  const tileRefs = result.tileSources.map((tile) => tile.ref);
  const nativeStrokeSegments =
    perf.counters["brush.tile.nativeStroke.segment"] || 0;
  const touchedTiles = perf.counters["brush.tile.touched"] || 0;
  const totalTileCommitMs = (
    perf.spans["brush.tile.commit.encode"] || []
  ).reduce((sum, duration) => sum + duration, 0);

  expect(result.width).toBe(12_400);
  expect(result.height).toBe(10_800);
  expect(result.transformX).toBe(220);
  expect(result.transformY).toBe(160);
  expect(result.baseX).toBeUndefined();
  expect(result.baseY).toBeUndefined();
  expect(result.tileSources.length).toBeGreaterThan(0);
  expect(result.tileSources.length).toBeLessThan(100);
  expect(new Set(tileRefs).size).toBe(tileRefs.length);
  expect(
    result.tileSources.every(
      (tile) =>
        tile.x >= 0 &&
        tile.y >= 0 &&
        tile.x + tile.width <= result.width &&
        tile.y + tile.height <= result.height
    )
  ).toBe(true);
  expect(nativeStrokeSegments).toBeGreaterThan(0);
  expect(nativeStrokeSegments).toBeLessThanOrEqual(300);
  expect(touchedTiles).toBeGreaterThan(0);
  expect(perf.counters["brush.canvas.expand"] || 0).toBe(0);
  expect(perf.spans["brush.stroke.createFloatPixels"] || []).toHaveLength(0);
  expect(perf.spans["brush.commit.encode"] || []).toHaveLength(0);
  expect(totalTileCommitMs).toBeLessThan(2000);
  expect(result.elapsedMs).toBeLessThan(3000);
});

test("huge tiled raster layers mount only visible committed tile images", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");

    if (!(editor && brush)) {
      throw new Error("Expected brush tool");
    }

    editor.select("huge-image-1");
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });

    const initialNode = editor.getNode("huge-image-1");

    if (initialNode?.type !== "image") {
      throw new Error("Expected huge image node");
    }

    const toWorldPoint = (localPoint) => ({
      x: initialNode.transform.x + localPoint.x,
      y: initialNode.transform.y + localPoint.y,
    });
    const center = {
      x: initialNode.width / 2,
      y: initialNode.height / 2,
    };
    const drawLine = async (angle) => {
      const end = {
        x: center.x + Math.cos(angle) * 40_000,
        y: center.y + Math.sin(angle) * 40_000,
      };
      const session = brush.beginStroke({ point: toWorldPoint(center) });

      if (!session) {
        throw new Error("Expected brush stroke session");
      }

      session.update({ point: toWorldPoint(end) });
      await session.complete({ point: toWorldPoint(end) });
    };

    for (const angle of [0.19, 1.37, 2.48, 4.11]) {
      await drawLine(angle);
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const imageNode = window.__PUNCHPRESS_EDITOR__?.nodes.find(
          (node) => node.type === "image"
        );

        return imageNode?.tileSources?.length || 0;
      })
    )
    .toBeGreaterThan(250);

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const imageNode = editor?.nodes.find((node) => node.type === "image");

    if (!(editor && imageNode?.type === "image")) {
      throw new Error("Expected huge image node");
    }

    const viewport = {
      x: imageNode.transform.x,
      y: imageNode.transform.y,
      zoom: 0.02,
    };

    editor.setViewportInteracting(false);
    editor.setViewport(viewport);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.(viewport);
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? viewport.x,
      y: editor.viewerRef?.getScrollTop?.() ?? viewport.y,
      zoom: viewport.zoom,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector('[data-raster-preview-ready="true"]') !== null
      )
    )
    .toBe(true);

  const lowZoomResult = await page.evaluate(() => {
    const imageNode = window.__PUNCHPRESS_EDITOR__?.nodes.find(
      (node) => node.type === "image"
    );

    return {
      groupTotalTileCount: Number(
        document
          .querySelector("[data-raster-total-tile-count]")
          ?.getAttribute("data-raster-total-tile-count") || 0
      ),
      mountedTileCount: document.querySelectorAll("[data-raster-tile-ref]")
        .length,
      previewActive:
        document.querySelector('[data-raster-preview-active="true"]') !== null,
      previewReady:
        document.querySelector('[data-raster-preview-ready="true"]') !== null,
      tileSourceCount: imageNode?.tileSources?.length || 0,
    };
  });

  expect(lowZoomResult.previewActive, JSON.stringify(lowZoomResult)).toBe(true);
  expect(lowZoomResult.previewReady, JSON.stringify(lowZoomResult)).toBe(true);
  expect(lowZoomResult.groupTotalTileCount).toBe(lowZoomResult.tileSourceCount);
  expect(lowZoomResult.mountedTileCount).toBe(0);

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const imageNode = editor?.nodes.find((node) => node.type === "image");

    if (!(editor && imageNode?.type === "image")) {
      throw new Error("Expected huge image node");
    }

    const targetTile = imageNode.tileSources?.[0];

    if (!targetTile) {
      throw new Error("Expected committed tile source");
    }

    const viewport = {
      x: imageNode.transform.x + targetTile.x - 900,
      y: imageNode.transform.y + targetTile.y - 600,
      zoom: 0.86,
    };

    editor.setViewportInteracting(false);
    editor.setViewport(viewport);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.(viewport);
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? viewport.x,
      y: editor.viewerRef?.getScrollTop?.() ?? viewport.y,
      zoom: viewport.zoom,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(
          document
            .querySelector("[data-raster-visible-tile-count]")
            ?.getAttribute("data-raster-visible-tile-count") || 0
        )
      )
    )
    .toBeGreaterThan(0);

  const result = await page.evaluate(() => {
    const imageNode = window.__PUNCHPRESS_EDITOR__?.nodes.find(
      (node) => node.type === "image"
    );

    return {
      groupTotalTileCount: Number(
        document
          .querySelector("[data-raster-total-tile-count]")
          ?.getAttribute("data-raster-total-tile-count") || 0
      ),
      groupVisibleTileCount: Number(
        document
          .querySelector("[data-raster-visible-tile-count]")
          ?.getAttribute("data-raster-visible-tile-count") || 0
      ),
      image: imageNode
        ? {
            height: imageNode.height,
            transformX: imageNode.transform.x,
            transformY: imageNode.transform.y,
            width: imageNode.width,
          }
        : null,
      mountedTileCount: document.querySelectorAll("[data-raster-tile-ref]")
        .length,
      tileBounds: imageNode?.tileSources?.reduce(
        (bounds, tile) => ({
          maxX: Math.max(bounds.maxX, tile.x + tile.width),
          maxY: Math.max(bounds.maxY, tile.y + tile.height),
          minX: Math.min(bounds.minX, tile.x),
          minY: Math.min(bounds.minY, tile.y),
        }),
        {
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
        }
      ),
      tileSourceCount: imageNode?.tileSources?.length || 0,
      viewport: window.__PUNCHPRESS_EDITOR__?.viewport,
    };
  });

  expect(result.tileSourceCount).toBeGreaterThan(250);
  expect(result.mountedTileCount).toBeGreaterThan(0);
  expect(result.groupVisibleTileCount).toBe(result.mountedTileCount);
  expect(result.groupTotalTileCount).toBe(result.tileSourceCount);
  expect(result.mountedTileCount, JSON.stringify(result)).toBeLessThan(100);
});

test("long active working tile surface does not discard earlier touched tiles", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return;
    }

    const node = editor.getNode("huge-image-1");

    if (node?.type !== "image") {
      return;
    }

    editor.select("huge-image-1");
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: node.transform.x - 800,
      y: node.transform.y - 600,
      zoom: 0.04,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.({
      x: node.transform.x - 800,
      y: node.transform.y - 600,
      zoom: 0.04,
    });
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? node.transform.x - 800,
      y: editor.viewerRef?.getScrollTop?.() ?? node.transform.y - 600,
      zoom: 0.04,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
    editor.onViewportChange?.();
  });
  await page.keyboard.press("b");

  const result = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const imageNode = editor?.getNode("huge-image-1");

    if (!(editor && brush && imageNode?.type === "image")) {
      throw new Error("Expected brush and huge image node");
    }

    const toWorldPoint = (localPoint) => ({
      x: imageNode.transform.x + localPoint.x,
      y: imageNode.transform.y + localPoint.y,
    });
    const start = {
      x: imageNode.width * 0.08,
      y: imageNode.height * 0.48,
    };
    const session = brush.beginStroke({
      point: toWorldPoint(start),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    const counts: { index: number; pointCount: number }[] = [];
    const totalPoints = 560;

    for (let index = 1; index <= totalPoints; index += 1) {
      const progress = index / totalPoints;

      session.update({
        point: toWorldPoint({
          x: start.x + imageNode.width * 0.84 * progress,
          y:
            start.y +
            Math.sin(progress * Math.PI * 9) * imageNode.height * 0.18,
        }),
      });

      if (index % 20 === 0) {
        const workingGroup = editor
          .getRasterWorkingPresentation?.("huge-image-1")
          ?.groups.at(-1);

        counts.push({
          index,
          pointCount:
            workingGroup?.content.kind === "tiles"
              ? workingGroup.content.tiles.length
              : 0,
        });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    session.cancel();

    return {
      counts,
      drops: counts.filter((entry, index) => {
        const previous = counts[index - 1];

        return previous ? entry.pointCount < previous.pointCount : false;
      }),
    };
  });

  expect(result.drops, JSON.stringify(result)).toEqual([]);
});

test("tiled raster LOD stays beneath active brush working tiles", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");

    if (!(editor && brush)) {
      throw new Error("Expected brush tool");
    }

    editor.select("huge-image-1");
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });

    const initialNode = editor.getNode("huge-image-1");

    if (initialNode?.type !== "image") {
      throw new Error("Expected huge image node");
    }

    const center = {
      x: initialNode.width / 2,
      y: initialNode.height / 2,
    };
    const toWorldPoint = (localPoint) => ({
      x: initialNode.transform.x + localPoint.x,
      y: initialNode.transform.y + localPoint.y,
    });
    const drawLine = async (angle) => {
      const end = {
        x: center.x + Math.cos(angle) * 40_000,
        y: center.y + Math.sin(angle) * 40_000,
      };
      const session = brush.beginStroke({ point: toWorldPoint(center) });

      if (!session) {
        throw new Error("Expected brush stroke session");
      }

      session.update({ point: toWorldPoint(end) });
      await session.complete({ point: toWorldPoint(end) });
    };

    for (const angle of [0.19, 1.37, 2.48, 4.11]) {
      await drawLine(angle);
    }

    const imageNode = editor.getNode("huge-image-1");

    if (imageNode?.type !== "image") {
      throw new Error("Expected committed huge image node");
    }

    const viewport = {
      x: imageNode.transform.x,
      y: imageNode.transform.y,
      zoom: 0.02,
    };

    editor.setViewportInteracting(false);
    editor.setViewport(viewport);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.(viewport);
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? viewport.x,
      y: editor.viewerRef?.getScrollTop?.() ?? viewport.y,
      zoom: viewport.zoom,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector('[data-raster-preview-ready="true"]') !== null
      )
    )
    .toBe(true);

  const beforeStroke = await page.evaluate(() => ({
    mountedTileCount: document.querySelectorAll("[data-raster-tile-ref]")
      .length,
    previewActive:
      document.querySelector('[data-raster-preview-active="true"]') !== null,
    previewReady:
      document.querySelector('[data-raster-preview-ready="true"]') !== null,
    tileSourceCount:
      window.__PUNCHPRESS_EDITOR__?.nodes.find((node) => node.type === "image")
        ?.tileSources?.length || 0,
  }));

  expect(beforeStroke.previewActive, JSON.stringify(beforeStroke)).toBe(true);
  expect(beforeStroke.previewReady, JSON.stringify(beforeStroke)).toBe(true);
  expect(beforeStroke.mountedTileCount, JSON.stringify(beforeStroke)).toBe(0);
  expect(beforeStroke.tileSourceCount).toBeGreaterThan(0);

  const duringStroke = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const imageNode = editor?.getNode("huge-image-1");

    if (!(editor && brush && imageNode?.type === "image")) {
      throw new Error("Expected brush and huge image node");
    }

    const toWorldPoint = (localPoint) => ({
      x: imageNode.transform.x + localPoint.x,
      y: imageNode.transform.y + localPoint.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 1200, y: 2200 }),
    });

    if (!session) {
      throw new Error("Expected active brush stroke session");
    }

    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = session;
    session.update({ point: toWorldPoint({ x: 9800, y: 7600 }) });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    return {
      brushPreviewCount: document.querySelectorAll(
        "[data-brush-preview-node-id]"
      ).length,
      mountedTileCount: document.querySelectorAll("[data-raster-tile-ref]")
        .length,
      previewActive:
        document.querySelector('[data-raster-preview-active="true"]') !== null,
      previewReady:
        document.querySelector('[data-raster-preview-ready="true"]') !== null,
      presentationOwner:
        document
          .querySelector("[data-raster-node-id]")
          ?.getAttribute("data-raster-presentation-owner") || null,
      workingTileCount: (() => {
        const group = editor
          .getRasterWorkingPresentation?.("huge-image-1")
          ?.groups.at(-1);

        return group?.content.kind === "tiles" ? group.content.tiles.length : 0;
      })(),
    };
  });

  await page.evaluate(() => {
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__?.cancel?.();
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
  });

  expect(duringStroke.brushPreviewCount, JSON.stringify(duringStroke)).toBe(0);
  expect(
    duringStroke.workingTileCount,
    JSON.stringify(duringStroke)
  ).toBeGreaterThan(0);
  expect(duringStroke.previewActive, JSON.stringify(duringStroke)).toBe(true);
  expect(duringStroke.previewReady, JSON.stringify(duringStroke)).toBe(true);
  expect(duringStroke.presentationOwner, JSON.stringify(duringStroke)).toBe(
    "working"
  );
  expect(duringStroke.mountedTileCount, JSON.stringify(duringStroke)).toBe(0);
});

test("over-dense tiled raster preview stays anchored while panning", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");

    if (!(editor && brush)) {
      throw new Error("Expected brush tool");
    }

    editor.select("huge-image-1");
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 120,
      spacing: 0,
    });

    const initialNode = editor.getNode("huge-image-1");

    if (initialNode?.type !== "image") {
      throw new Error("Expected huge image node");
    }

    const toWorldPoint = (localPoint) => ({
      x: initialNode.transform.x + localPoint.x,
      y: initialNode.transform.y + localPoint.y,
    });
    const lineStart = { x: 1000, y: 5000 };
    const lineEnd = { x: 100_000, y: 5000 };
    const session = brush.beginStroke({ point: toWorldPoint(lineStart) });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    session.update({ point: toWorldPoint(lineEnd) });
    await session.complete({ point: toWorldPoint(lineEnd) });

    const imageNode = editor.getNode("huge-image-1");

    if (imageNode?.type !== "image") {
      throw new Error("Expected huge image node");
    }

    const viewport = {
      x: imageNode.transform.x + imageNode.width * 0.35,
      y: imageNode.transform.y + imageNode.height * 0.35,
      zoom: 0.02,
    };

    editor.setViewportInteracting(false);
    editor.setViewport(viewport);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    editor.viewerRef?.setTo?.(viewport);
    editor.setViewportInteracting(false);
    editor.setViewport({
      x: editor.viewerRef?.getScrollLeft?.() ?? viewport.x,
      y: editor.viewerRef?.getScrollTop?.() ?? viewport.y,
      zoom: viewport.zoom,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector('[data-raster-preview-ready="true"]') !== null
      )
    )
    .toBe(true);

  const beforePan = await page.evaluate(() => {
    const preview = document.querySelector("[data-raster-preview-ready]");
    const imageNode = window.__PUNCHPRESS_EDITOR__?.nodes.find(
      (node) => node.type === "image"
    );

    return {
      height: Number(preview?.getAttribute("height")),
      imageHeight: imageNode?.height || 0,
      imageWidth: imageNode?.width || 0,
      width: Number(preview?.getAttribute("width")),
      x: Number(preview?.getAttribute("x")),
      y: Number(preview?.getAttribute("y")),
    };
  });

  expect(beforePan.x).toBe(0);
  expect(beforePan.y).toBe(0);
  expect(beforePan.width).toBe(beforePan.imageWidth);
  expect(beforePan.height).toBe(beforePan.imageHeight);

  const continuity = await page.evaluate(() => {
    const preview = document.querySelector("[data-raster-preview-ready]");
    const canvas = preview?.querySelector("canvas");

    if (!(preview instanceof SVGForeignObjectElement && canvas)) {
      throw new Error("Expected raster preview canvas");
    }

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Expected preview canvas context");
    }

    const previewWidth = Number(preview.getAttribute("width") || 0);
    const previewHeight = Number(preview.getAttribute("height") || 0);
    const scaleX = canvas.width / previewWidth;
    const scaleY = canvas.height / previewHeight;
    const sampleY = Math.round(5000 * scaleY);
    const startX = Math.round(1200 * scaleX);
    const endX = Math.min(canvas.width - 1, Math.round(98_000 * scaleX));
    const imageData = context.getImageData(
      startX,
      Math.max(0, sampleY - 3),
      Math.max(1, endX - startX),
      7
    );
    let currentGap = 0;
    let maxGap = 0;

    for (let x = 0; x < imageData.width; x += 1) {
      let hasInk = false;

      for (let y = 0; y < imageData.height; y += 1) {
        const offset = (y * imageData.width + x) * 4;

        if (imageData.data[offset + 3] > 16) {
          hasInk = true;
          break;
        }
      }

      if (hasInk) {
        currentGap = 0;
      } else {
        currentGap += 1;
        maxGap = Math.max(maxGap, currentGap);
      }
    }

    return {
      canvasHeight: canvas.height,
      canvasWidth: canvas.width,
      maxGap,
      sampledWidth: imageData.width,
    };
  });

  expect(continuity.maxGap, JSON.stringify(continuity)).toBeLessThan(12);

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewer = editor?.viewerRef;

    if (!(editor && viewer)) {
      throw new Error("Expected editor viewport");
    }

    viewer.scrollBy?.(2400, 1800);
    editor.setViewport({
      x: viewer.getScrollLeft?.() ?? editor.viewport.x,
      y: viewer.getScrollTop?.() ?? editor.viewport.y,
      zoom: editor.viewport.zoom,
    });
    editor.onViewportChange?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const afterPan = await page.evaluate(() => {
    const preview = document.querySelector("[data-raster-preview-ready]");
    const imageNode = window.__PUNCHPRESS_EDITOR__?.nodes.find(
      (node) => node.type === "image"
    );

    return {
      height: Number(preview?.getAttribute("height")),
      imageHeight: imageNode?.height || 0,
      imageWidth: imageNode?.width || 0,
      width: Number(preview?.getAttribute("width")),
      x: Number(preview?.getAttribute("x")),
      y: Number(preview?.getAttribute("y")),
    };
  });

  expect(afterPan).toEqual(beforePan);
});

test("brush strokes on a large artboard avoid repeated canvas reallocations", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadRasterTestDocument(page, createLargeArtboardDocument());
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("artboard-1");
  });
  await page.keyboard.press("b");
  await installBrushPerfCapture(page);

  const start = await getCanvasStagePoint(page, { x: 620, y: 360 });
  const end = await getCanvasStagePoint(page, { x: 1450, y: 360 });

  await dragBrush(page, [start, end], { steps: 120 });

  const perf = await takeBrushPerfCapture(page);
  const imageState = await getCommittedImageState(page);

  expect(perf.counters["brush.canvas.expand"] || 0).toBeLessThanOrEqual(24);
  expect(perf.spans["brush.canvas.expand"]?.length || 0).toBeLessThanOrEqual(
    24
  );
  expect(imageState?.parentId).toBe("artboard-1");
});

test("rapid brush strokes on a large artboard paint through a working surface", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadRasterTestDocument(page, createLargeArtboardDocument());
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("artboard-1");
  });
  await page.keyboard.press("b");
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setBrushSettings({ smoothing: 0 }, "brush");
  });
  await installBrushPerfCapture(page);

  const points = await Promise.all([
    getCanvasStagePoint(page, { x: 620, y: 360 }),
    getCanvasStagePoint(page, { x: 1450, y: 930 }),
    getCanvasStagePoint(page, { x: 720, y: 880 }),
    getCanvasStagePoint(page, { x: 1350, y: 300 }),
    getCanvasStagePoint(page, { x: 1040, y: 1020 }),
    getCanvasStagePoint(page, { x: 1520, y: 620 }),
  ]);

  await dragBrush(page, points, { release: false, steps: 10 });

  await expect
    .poll(() => getRasterWorkingSurfaceState(page))
    .toMatchObject({
      canvasCount: 1,
      count: 1,
    });

  const perf = await takeBrushPerfCapture(page);

  expect(await getBrushPreviewState(page)).toBeNull();
  expect(perf.counters["brush.nativeStroke.segment"] || 0).toBeGreaterThan(0);
  expect(perf.counters["brush.dab"] || 0).toBe(0);

  await page.mouse.up();
});

test("selected non-raster nodes do not create raster layers", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadRasterTestDocument(page, createShapeDocument());

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("shape-1");
  });
  await page.keyboard.press("b");

  const point = await getCanvasStagePoint(page, { x: 520, y: 360 });

  await dragBrush(page, [point, point]);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return {
        imageCount: state.nodes.filter((node) => node.type === "image").length,
        selectedNodeIds: state.selectedNodeIds,
      };
    })
    .toEqual({
      imageCount: 0,
      selectedNodeIds: ["shape-1"],
    });
});

test("selected raster layers expand without moving existing pixels", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const firstPoint = await getCanvasStagePoint(page, { x: 320, y: 240 });
  const secondPoint = await getCanvasStagePoint(page, { x: 560, y: 320 });

  await dragBrush(page, [firstPoint, firstPoint]);

  const firstState = await getCommittedImageState(page);
  const firstSample = await getCommittedImageSampleAtClientPoint(
    page,
    firstPoint
  );

  await dragBrush(page, [secondPoint, secondPoint]);

  const expandedState = await getCommittedImageState(page);
  const pinnedSample = await getCommittedImageSampleAtClientPoint(
    page,
    firstPoint
  );
  const expandedSample = await getCommittedImageSampleAtClientPoint(
    page,
    secondPoint
  );

  expect(firstSample?.a).toBe(255);
  expect(expandedState?.id).toBe(firstState?.id);
  expect(expandedState?.width).toBeGreaterThan(firstState?.width || 0);
  expect(expandedState?.height).toBeGreaterThan(firstState?.height || 0);
  expect(pinnedSample?.a).toBe(255);
  expect(expandedSample?.a).toBe(255);
});

test("selected raster layers expand left without shifting existing pixels on commit", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const firstPoint = await getCanvasStagePoint(page, { x: 640, y: 320 });
  const secondPoint = await getCanvasStagePoint(page, { x: 420, y: 320 });

  await dragBrush(page, [firstPoint, firstPoint]);

  const firstState = await getCommittedImageState(page);
  const firstSample = await getCommittedImageSampleAtClientPoint(
    page,
    firstPoint
  );

  await dragBrush(page, [secondPoint, secondPoint]);

  const expandedState = await getCommittedImageState(page);
  const pinnedSample = await getCommittedImageSampleAtClientPoint(
    page,
    firstPoint
  );
  const expandedSample = await getCommittedImageSampleAtClientPoint(
    page,
    secondPoint
  );

  expect(firstSample?.a).toBe(255);
  expect(expandedState?.id).toBe(firstState?.id);
  expect(expandedState?.x).toBeLessThan(firstState?.x || 0);
  expect(expandedState?.width).toBeGreaterThan(firstState?.width || 0);
  expect(pinnedSample?.a).toBe(255);
  expect(expandedSample?.a).toBe(255);
});

test("expanded brush working canvas stays pinned while drawing", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createSmallImageDocument(src));
  await page.keyboard.press("b");

  const interaction = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const imageNode = editor?.getNode("image-1");

    if (!(editor && brush && imageNode?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    editor.select("image-1");
    editor.updateNode("image-1", {
      writableHeight: 608,
      writableWidth: 608,
      writableX: -256,
      writableY: -256,
    });
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 40,
      spacing: 0,
    });
    editor.rasterSurface?.retainTargets?.([]);

    const toWorldPoint = (localPoint) => ({
      x: imageNode.transform.x + localPoint.x,
      y: imageNode.transform.y + localPoint.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 72, y: 72 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = session;
    session.update({ point: toWorldPoint({ x: -180, y: -130 }) });
    await session.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const group = editor
      .getRasterWorkingPresentation?.("image-1")
      ?.groups.at(-1);

    return {
      committedTransform: imageNode.transform,
      surfaceMatrix: group?.matrix || null,
      surfaceType: group?.content.kind || null,
      surfaceX: group?.content.kind === "canvas" ? group.content.x : 0,
      surfaceY: group?.content.kind === "canvas" ? group.content.y : 0,
    };
  });

  const placement = await getRasterWorkingCanvasPlacement(page);

  await page.evaluate(() => {
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__?.cancel?.();
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
  });

  expect(interaction.surfaceType).toBe("canvas");
  expect(interaction.surfaceMatrix?.e).toBeLessThan(0);
  expect(interaction.surfaceMatrix?.f).toBeLessThan(0);
  expect(interaction.surfaceX).toBeCloseTo(0);
  expect(interaction.surfaceY).toBeCloseTo(0);
  expect(placement?.type).toBe("canvas");
  expect(placement?.renderedX).toBeCloseTo(
    interaction.committedTransform.x + interaction.surfaceMatrix.e,
    1
  );
  expect(placement?.renderedY).toBeCloseTo(
    interaction.committedTransform.y + interaction.surfaceMatrix.f,
    1
  );
  expect(placement?.renderedWidth).toBeCloseTo(placement?.surfaceWidth || 0, 1);
  expect(placement?.renderedHeight).toBeCloseTo(
    placement?.surfaceHeight || 0,
    1
  );
});

test("brush commits on a resized raster layer preserve the resized pixels", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const firstPoint = await getCanvasStagePoint(page, { x: 320, y: 240 });

  await dragBrush(page, [firstPoint, firstPoint]);

  const firstState = await getCommittedImageState(page);
  const resizeFactor = 120;
  const resizedState = await page.evaluate((nextResizeFactor) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const imageNode = editor?.nodes.find((node) => node.type === "image");

    if (!(editor && imageNode?.type === "image")) {
      return null;
    }

    editor.updateNode(imageNode.id, {
      height: imageNode.height * nextResizeFactor,
      width: imageNode.width * nextResizeFactor,
    });
    editor.select(imageNode.id);

    const nextImageNode = editor.getNode(imageNode.id);

    return nextImageNode?.type === "image"
      ? {
          id: nextImageNode.id,
          transform: nextImageNode.transform,
          width: nextImageNode.width,
          height: nextImageNode.height,
        }
      : null;
  }, resizeFactor);
  const beforeSecondStrokeShell = await getRasterShellState(page);
  const resizedFirstPoint = await page.evaluate(
    ({ firstPoint: targetPoint, firstState: sourceState }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const host = editor?.hostRef;
      const viewer = editor?.viewerRef;
      const imageNode = editor?.nodes.find((node) => node.type === "image");

      if (!(editor && host && viewer && imageNode && sourceState)) {
        return targetPoint;
      }

      const hostRect = host.getBoundingClientRect();
      const worldPoint = {
        x:
          viewer.getScrollLeft() +
          (targetPoint.x - hostRect.left) / editor.zoom,
        y: viewer.getScrollTop() + (targetPoint.y - hostRect.top) / editor.zoom,
      };
      const sourceLocalPoint = {
        x: worldPoint.x - sourceState.x,
        y: worldPoint.y - sourceState.y,
      };
      const nextLocalPoint = {
        x: sourceLocalPoint.x * (imageNode.width / sourceState.width),
        y: sourceLocalPoint.y * (imageNode.height / sourceState.height),
      };
      const nextWorldPoint = {
        x: imageNode.transform.x + nextLocalPoint.x,
        y: imageNode.transform.y + nextLocalPoint.y,
      };

      return {
        x:
          hostRect.left +
          (nextWorldPoint.x - viewer.getScrollLeft()) * editor.zoom,
        y:
          hostRect.top +
          (nextWorldPoint.y - viewer.getScrollTop()) * editor.zoom,
      };
    },
    { firstPoint, firstState }
  );
  const resizedPinnedSampleBeforeStroke =
    await getCommittedImageSampleAtClientPoint(page, resizedFirstPoint);
  const secondPoint = {
    x: firstPoint.x + 220,
    y: firstPoint.y + 40,
  };

  await dragBrush(page, [secondPoint, secondPoint]);

  const afterSecondStrokeState = await getCommittedImageState(page);
  const afterSecondStrokeShell = await getRasterShellState(page);
  const pinnedSample = await getCommittedImageSampleAtClientPoint(
    page,
    resizedFirstPoint
  );
  const secondSample = await getCommittedImageSampleAtClientPoint(
    page,
    secondPoint
  );

  expect(firstState?.id).toBe(afterSecondStrokeState?.id);
  expect(resizedState?.width).toBe((firstState?.width || 0) * resizeFactor);
  expect(resizedState?.height).toBe((firstState?.height || 0) * resizeFactor);
  expect(afterSecondStrokeState?.width).toBe(resizedState?.width);
  expect(afterSecondStrokeState?.height).toBe(resizedState?.height);
  expect(afterSecondStrokeState?.transform).toEqual(resizedState?.transform);
  expect(afterSecondStrokeState?.tileSourceCount).toBeGreaterThan(0);
  expect(parsePixelSize(afterSecondStrokeShell?.width)).toBe(
    parsePixelSize(beforeSecondStrokeShell?.width)
  );
  expect(parsePixelSize(afterSecondStrokeShell?.height)).toBe(
    parsePixelSize(beforeSecondStrokeShell?.height)
  );
  expect(resizedPinnedSampleBeforeStroke?.a).toBe(255);
  expect(pinnedSample?.a).toBe(255);
  expect(secondSample?.a).toBe(255);
});

test("long strokes on a resized imported Raster hand off atomically inside its plane", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createWhiteImageDataUrl(page);
  await loadRasterTestDocument(page, createResizedImportedImageDocument(src));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected an editor");
    }

    const viewport = { x: 0, y: 0, zoom: 0.13 };

    editor.select("image-1");
    editor.setActiveTool("brush");
    editor.setBrushSettings(
      {
        hardness: 1,
        opacity: 1,
        size: 77,
        smoothing: 0.1,
        spacing: 0,
      },
      "brush"
    );
    editor.viewerRef?.setTo?.(viewport);
    editor.setViewport(viewport);
    editor.getState().setViewport(viewport);
    editor.onViewportChange?.();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });

  const shell = page.locator('[data-node-id="image-1"]');
  const shellBefore = await shell.boundingBox();

  if (!shellBefore) {
    throw new Error("Expected a rendered resized Raster");
  }

  const ratios = [
    { x: 0.002, y: 0.002 },
    { x: 0.998, y: 0.002 },
    { x: 0.08, y: 0.24 },
    { x: 0.92, y: 0.24 },
    { x: 0.08, y: 0.38 },
    { x: 0.92, y: 0.38 },
    { x: 0.08, y: 0.52 },
    { x: 0.92, y: 0.52 },
    { x: 0.08, y: 0.66 },
    { x: 0.92, y: 0.66 },
    { x: 0.08, y: 0.8 },
    { x: 0.92, y: 0.8 },
    { x: 0.002, y: 0.08 },
    { x: 0.002, y: 0.92 },
    { x: 0.28, y: 0.08 },
    { x: 0.28, y: 0.92 },
    { x: 0.46, y: 0.08 },
    { x: 0.46, y: 0.92 },
    { x: 0.64, y: 0.08 },
    { x: 0.64, y: 0.92 },
    { x: 0.998, y: 0.08 },
    { x: 0.998, y: 0.998 },
  ];
  const points = ratios.map((point) => ({
    x: shellBefore.x + shellBefore.width * point.x,
    y: shellBefore.y + shellBefore.height * point.y,
  }));

  await dragBrush(page, points, { release: false, steps: 4 });
  await page.waitForTimeout(100);

  const readHandoffState = () =>
    page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const group = editor
        ?.getRasterWorkingPresentation?.("image-1")
        ?.groups.at(-1);
      const renderer = document.querySelector(
        "[data-raster-node-id='image-1']"
      );
      const mountedWorkingGroupIds = new Set(
        [
          ...(renderer?.querySelectorAll("[data-raster-working-group-id]") ||
            []),
        ].map((element) => element.getAttribute("data-raster-working-group-id"))
      );
      const mountedTileRefs = new Set(
        [...(renderer?.querySelectorAll("[data-raster-tile-ref]") || [])]
          .filter((element) => element.getAttribute("opacity") !== "0")
          .map((element) => element.getAttribute("data-raster-tile-ref"))
      );
      const replacementIds = group?.replacement?.resourceIds || [];

      return {
        atomicHandoff:
          renderer?.getAttribute("data-raster-atomic-handoff") === "true",
        committedTileCount:
          editor?.getNode("image-1")?.tileSources?.length || 0,
        hasBlank: Boolean(
          group?.phase === "awaiting-presentation" &&
            !mountedWorkingGroupIds.has(group.groupId) &&
            !replacementIds.some((resourceId) =>
              mountedTileRefs.has(resourceId)
            )
        ),
        hasOverlap: Boolean(
          group?.phase === "awaiting-presentation" &&
            mountedWorkingGroupIds.has(group.groupId) &&
            replacementIds.some((resourceId) => mountedTileRefs.has(resourceId))
        ),
        surfaceCompleted: group ? group.phase !== "active" : null,
        surfaceTileCount:
          group?.content.kind === "tiles" ? group.content.tiles.length : 0,
        surfaceType: group?.content.kind || null,
        workingVisible: mountedWorkingGroupIds.size > 0,
      };
    });
  const activeState = await readHandoffState();
  const releaseStates: Awaited<ReturnType<typeof readHandoffState>>[] = [];

  await page.mouse.up();
  for (let index = 0; index < 40; index += 1) {
    releaseStates.push(await readHandoffState());
    if (
      releaseStates.at(-1)?.committedTileCount > 0 &&
      releaseStates.at(-1)?.surfaceType === null
    ) {
      break;
    }
    await page.waitForTimeout(16);
  }

  const shellAfter = await shell.boundingBox();
  const committedState = await getCommittedImageState(page);
  const escapedTile = committedState?.tileSources.find((tile) => {
    return (
      tile.x < 0 ||
      tile.y < 0 ||
      tile.x + tile.width > (committedState.width || 0) ||
      tile.y + tile.height > (committedState.height || 0)
    );
  });
  const atomicStates = releaseStates.filter((state) => state.atomicHandoff);
  const releaseDiagnostic = JSON.stringify({
    activeState,
    atomicStates,
    committedState,
    releaseStates,
    shellAfter,
    shellBefore,
  });
  const overlappingState = atomicStates.find((state) => state.hasOverlap);
  const blankState = atomicStates.find((state) => state.hasBlank);

  expect(activeState, releaseDiagnostic).toMatchObject({
    committedTileCount: 0,
    surfaceCompleted: false,
    surfaceType: "tiles",
    workingVisible: true,
  });
  expect(activeState.surfaceTileCount, releaseDiagnostic).toBeGreaterThan(50);
  expect(atomicStates.length, releaseDiagnostic).toBeGreaterThan(0);
  expect(overlappingState, releaseDiagnostic).toBeUndefined();
  expect(blankState, releaseDiagnostic).toBeUndefined();
  expect(releaseStates.at(-1), releaseDiagnostic).toMatchObject({
    committedTileCount: committedState?.tileSourceCount,
    surfaceType: null,
    workingVisible: false,
  });
  expect(shellAfter).toEqual(shellBefore);
  expect(committedState).toMatchObject({
    height: 5000,
    transform: transform(2500, 800),
    width: 5000,
  });
  expect(escapedTile).toBeUndefined();
});

test("erasing transparent space does not move or resize the raster layer", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const paintPoint = await getCanvasStagePoint(page, { x: 420, y: 300 });
  const emptyPoint = await getCanvasStagePoint(page, { x: 620, y: 300 });

  await dragBrush(page, [paintPoint, paintPoint]);

  const beforeErase = await getCommittedImageState(page);

  await page.keyboard.press("e");
  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);
  await dragBrush(page, [emptyPoint, emptyPoint]);

  const afterErase = await getCommittedImageState(page);
  const retainedSample = await getCommittedImageSampleAtClientPoint(
    page,
    paintPoint
  );

  expect(afterErase).toMatchObject({
    height: beforeErase?.height,
    id: beforeErase?.id,
    width: beforeErase?.width,
    x: beforeErase?.x,
    y: beforeErase?.y,
  });
  expect(retainedSample?.a).toBe(255);
});

test("fully erasing a raster layer keeps an empty image layer selected", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const point = await getCanvasStagePoint(page, { x: 420, y: 300 });

  await dragBrush(page, [point, point]);

  const paintedState = await getCommittedImageState(page);

  await page.keyboard.press("e");
  await setBrushSliderValue(page, "Brush size", 120);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);
  await dragBrush(page, [point, point]);

  const erasedState = await getCommittedImageState(page);
  const sample = await getCommittedImageSampleAtClientPoint(page, point);

  expect(erasedState).toMatchObject({
    id: paintedState?.id,
  });
  expect(sample?.a).toBe(0);
  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return {
        imageCount: state.nodes.filter((node) => node.type === "image").length,
        selectedNodeIds: state.selectedNodeIds,
      };
    })
    .toEqual({
      imageCount: 1,
      selectedNodeIds: [paintedState?.id],
    });
});

test("brush strokes undo and redo as one committed raster step", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const firstStart = await getCanvasStagePoint(page, { x: 320, y: 240 });
  const firstEnd = await getCanvasStagePoint(page, { x: 420, y: 240 });
  const secondStart = await getCanvasStagePoint(page, { x: 560, y: 320 });
  const secondEnd = await getCanvasStagePoint(page, { x: 660, y: 320 });

  await dragBrush(page, [firstStart, firstEnd]);
  await expect.poll(() => getCommittedImageState(page)).not.toBeNull();

  const firstStrokeState = await getCommittedImageState(page);

  await dragBrush(page, [secondStart, secondEnd]);
  await expect
    .poll(async () => {
      const state = await getCommittedImageState(page);

      return state?.src !== firstStrokeState?.src ? state : null;
    })
    .not.toBeNull();

  const secondStrokeState = await getCommittedImageState(page);
  expect(firstStrokeState).toBeTruthy();
  expect(secondStrokeState).toBeTruthy();
  expect(secondStrokeState?.id).toBe(firstStrokeState?.id);
  expect(secondStrokeState?.src).not.toBe(firstStrokeState?.src);
  expect(secondStrokeState?.width).toBeGreaterThan(
    firstStrokeState?.width || 0
  );

  await page.keyboard.press("ControlOrMeta+Z");

  await expect
    .poll(() => getCommittedImageState(page))
    .toEqual(firstStrokeState);

  await page.keyboard.press("ControlOrMeta+Shift+Z");

  await expect
    .poll(() => getCommittedImageState(page))
    .toEqual(secondStrokeState);

  await page.keyboard.press("ControlOrMeta+Z");
  await page.keyboard.press("ControlOrMeta+Z");

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return state.nodes.filter((node) => node.type === "image").length;
    })
    .toBe(0);
});

test("eraser strokes undo and redo restored raster pixels", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 72);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const start = await getCanvasStagePoint(page, { x: 320, y: 260 });
  const end = await getCanvasStagePoint(page, { x: 520, y: 260 });
  const samplePoint = await getCanvasStagePoint(page, { x: 420, y: 260 });

  await dragBrush(page, [start, end]);
  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        samplePoint
      );

      return sample?.a;
    })
    .toBe(255);
  const paintedSample = await getCommittedImageSampleAtClientPoint(
    page,
    samplePoint
  );

  await page.keyboard.press("e");
  await setBrushSliderValue(page, "Brush size", 72);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);
  await dragBrush(page, [samplePoint, samplePoint]);
  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        samplePoint
      );

      return sample?.a;
    })
    .toBe(0);
  const erasedSample = await getCommittedImageSampleAtClientPoint(
    page,
    samplePoint
  );

  expect(paintedSample?.a).toBe(255);
  expect(erasedSample?.a).toBe(0);

  await page.keyboard.press("ControlOrMeta+Z");

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        samplePoint
      );

      return sample?.a;
    })
    .toBe(255);

  await page.keyboard.press("ControlOrMeta+Shift+Z");

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        samplePoint
      );

      return sample?.a;
    })
    .toBe(0);
});

test("undoing the first brush stroke on an empty layer restores the empty layer", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  const emptyLayerId = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const id = "empty-layer";

    if (editor) {
      editor.insertNodes([
        {
          id,
          name: "Layer",
          opacity: 1,
          parentId: "artboard-1",
          type: "empty",
          visible: true,
        },
      ]);
      editor.select(id);
    }

    return id;
  });

  await page.keyboard.press("b");

  const point = await getCanvasStagePoint(page, { x: 420, y: 300 });

  await dragBrush(page, [point, point]);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      const selectedNode = state.nodes.find((node) => node.id === emptyLayerId);

      return selectedNode?.type;
    })
    .toBe("image");

  await page.keyboard.press("ControlOrMeta+Z");

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      const selectedNode = state.nodes.find((node) => node.id === emptyLayerId);

      return {
        selectedNodeIds: state.selectedNodeIds,
        type: selectedNode?.type || null,
      };
    })
    .toEqual({
      selectedNodeIds: [emptyLayerId],
      type: "empty",
    });
});

test("working brush surface does not resize the durable layer shell mid-stroke", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  const start = await getCanvasStagePoint(page, { x: 300, y: 240 });
  const first = await getCanvasStagePoint(page, { x: 340, y: 240 });
  const far = await getCanvasStagePoint(page, { x: 520, y: 300 });

  await dragBrush(page, [start, first], { release: false });

  await expect
    .poll(() => getRasterShellState(page))
    .toMatchObject({
      height: "96px",
      width: "96px",
    });

  await page.mouse.move(far.x, far.y, { steps: 12 });

  await expect
    .poll(() => getRasterShellState(page))
    .toMatchObject({
      height: "96px",
      width: "96px",
    });
  await expect.poll(() => getBrushPreviewState(page)).toBeNull();
  await expect
    .poll(() => getRasterWorkingSurfaceState(page))
    .toMatchObject({
      canvasCount: 1,
      count: 1,
    });
  await expect
    .poll(async () => {
      const workingSurface = await getRasterWorkingSurfaceState(page);

      return workingSurface.maxCanvasWidth;
    })
    .toBeGreaterThan(96);

  await page.mouse.up();

  await expect.poll(() => getBrushPreviewState(page)).toBeNull();
  await expect
    .poll(async () => {
      const shell = await getRasterShellState(page);

      return parsePixelSize(shell?.width);
    })
    .toBeGreaterThan(96);
});

test("new brush strokes keep painting into the selected raster layer", async ({
  page,
}) => {
  await gotoRasterFrameEditor(page);
  await page.keyboard.press("b");

  const firstStart = await getCanvasStagePoint(page, { x: 300, y: 240 });
  const firstEnd = await getCanvasStagePoint(page, { x: 380, y: 240 });
  const secondStart = await getCanvasStagePoint(page, { x: 520, y: 320 });
  const secondEnd = await getCanvasStagePoint(page, { x: 600, y: 320 });

  await dragBrush(page, [firstStart, firstEnd]);
  const selectedAfterFirstStroke = await getStateSnapshot(page).then(
    (state) => state.selectedNodeIds
  );

  await dragBrush(page, [secondStart, secondEnd]);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      const imageNodes = state.nodes.filter((node) => node.type === "image");

      return {
        imageCount: imageNodes.length,
        selectedNodeIds: state.selectedNodeIds,
      };
    })
    .toEqual({
      imageCount: 1,
      selectedNodeIds: selectedAfterFirstStroke,
    });
});
