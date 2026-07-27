import { expect, test } from "@playwright/test";
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
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;

    for (let index = 0; index < imageData.data.length; index += 4) {
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];
      const alpha = imageData.data[index + 3];

      if (alpha > 200 && red < 48 && green < 48 && blue < 48) {
        const pixelIndex = index / 4;
        const x = pixelIndex % canvas.width;
        const y = Math.floor(pixelIndex / canvas.width);

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
    const rasterRoot = document.querySelector("[data-raster-render-key]");
    const workingSurface =
      editor?.getBrushWorkingSurfaceStateForNode?.("huge-image-1");
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
      renderKeyLength:
        rasterRoot?.getAttribute("data-raster-render-key")?.length || 0,
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
      workingTileCount: workingSurface?.tiles?.length || 0,
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
    const surface = editor?.getBrushWorkingSurfaceStateForNode?.(targetNodeId);

    if (!(editor && host && viewer && workingCanvas && surface)) {
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
      surfaceHeight: surface.height,
      surfaceTransform: surface.transform || {},
      surfaceWidth: surface.width,
      surfaceX: surface.x || 0,
      surfaceY: surface.y || 0,
      type: surface.type,
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

    if (residentCanvas) {
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
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const getFrameClientPoint = (xRatio, yRatio) =>
    page.evaluate(
      ({ xRatio: nextXRatio, yRatio: nextYRatio }) => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const frame = editor?.nodes.find((node) => node.type === "artboard");
        const hostRect = editor?.hostRef?.getBoundingClientRect();

        if (!(editor?.viewerRef && frame && hostRect)) {
          throw new Error("Expected a rendered Frame");
        }

        return {
          x:
            hostRect.left +
            (frame.transform.x +
              frame.width * nextXRatio -
              editor.viewerRef.getScrollLeft()) *
              editor.zoom,
          y:
            hostRect.top +
            (frame.transform.y +
              frame.height * nextYRatio -
              editor.viewerRef.getScrollTop()) *
              editor.zoom,
        };
      },
      { xRatio, yRatio }
    );
  const firstPoint = await getFrameClientPoint(0.2, 0.2);
  const secondPoint = await getFrameClientPoint(0.78, 0.72);

  await dragBrush(page, [firstPoint, firstPoint]);

  const firstState = await getCommittedImageState(page);

  expect(firstState?.parentId).not.toBe("root");
  expect(firstState?.width).toBeLessThan(300);
  expect(firstState?.height).toBeLessThan(300);

  await dragBrush(page, [secondPoint, secondPoint]);

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
  expect(workingSurface.canvasCount).toBe(0);

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
    const workingSurfaces = editor.getBrushWorkingSurfaceStates?.() || [];
    const mergedWorkingSurface =
      editor.getBrushWorkingSurfaceStateForNode?.("large-image-1");

    secondSession.cancel();
    await firstCommit;

    return {
      mergedTileCount: mergedWorkingSurface?.tiles?.length || 0,
      previewCount,
      workingSurfaceCount: workingSurfaces.length,
    };
  });

  expect(result.previewCount).toBe(0);
  expect(result.workingSurfaceCount).toBeGreaterThanOrEqual(2);
  expect(result.mergedTileCount).toBeGreaterThan(0);
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
    const workingSurfaceDuringCommit =
      editor.getBrushWorkingSurfaceStateForNode?.("large-image-1");

    await commit;

    const previewCountAfterCommit = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;
    const workingSurfaceAfterCommit =
      editor.getBrushWorkingSurfaceStateForNode?.("large-image-1");

    for (let index = 0; index < 5; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const previewCountAfterHandoff = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;

    return {
      previewCountAfterCommit,
      previewCountAfterHandoff,
      previewCountDuringCommit,
      workingTileCountAfterCommit:
        workingSurfaceAfterCommit?.tiles?.length || 0,
      workingTileCountDuringCommit:
        workingSurfaceDuringCommit?.tiles?.length || 0,
    };
  });

  expect(result.previewCountDuringCommit).toBe(0);
  expect(result.workingTileCountDuringCommit).toBeGreaterThan(0);
  expect(result.previewCountAfterCommit).toBe(0);
  expect(result.workingTileCountAfterCommit).toBeGreaterThan(0);
  expect(result.previewCountAfterHandoff).toBe(0);
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

  expect(beforeRelease?.tileCount).toBeGreaterThan(64);
  expect(beforeRelease?.width).toBeGreaterThan(2500);

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
      64
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

  const clip = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const hostRect = editor?.hostRef?.getBoundingClientRect();
    const viewer = editor?.viewerRef;
    const node = editor?.getNode("huge-image-1");

    if (!(editor && hostRect && viewer && node?.type === "image")) {
      throw new Error("Expected visible huge image node");
    }

    const toClientPoint = (point) => ({
      x:
        hostRect.left +
        (node.transform.x + point.x - viewer.getScrollLeft()) * editor.zoom,
      y:
        hostRect.top +
        (node.transform.y + point.y - viewer.getScrollTop()) * editor.zoom,
    });
    const start = toClientPoint({ x: 6000, y: 6200 });
    const end = toClientPoint({ x: 38_000, y: 8200 });
    const minX = Math.max(0, Math.min(start.x, end.x) + 20);
    const minY = Math.max(0, Math.min(start.y, end.y) - 60);
    const maxX = Math.min(window.innerWidth, Math.max(start.x, end.x) - 20);
    const maxY = Math.min(window.innerHeight, Math.max(start.y, end.y) + 60);

    return {
      height: Math.max(1, Math.floor(maxY - minY)),
      width: Math.max(1, Math.min(640, Math.floor(maxX - minX))),
      x: Math.floor(minX),
      y: Math.floor(minY),
    };
  });

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

  const beforeRelease = await getScreenshotDarkPixelStats(page, clip);

  expect(beforeRelease.darkPixelCount).toBeGreaterThan(500);

  const frameStats: Array<{
    committedTileCount: number;
    darkPixelCount: number;
    exactTileDomCount: number;
    height: number;
    previewActive: boolean;
    previewEligible: boolean;
    previewReady: boolean;
    visibleTileCount: number;
    width: number;
    workingTileCount: number;
    workingTileDomCount: number;
  }> = [];

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(node?.type === "image" && session)) {
      throw new Error("Expected active brush session");
    }

    session.complete({
      point: {
        x: node.transform.x + 38_000,
        y: node.transform.y + 8200,
      },
    });
  });

  for (let index = 0; index < 5; index += 1) {
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve))
    );
    frameStats.push({
      ...(await getScreenshotDarkPixelStats(page, clip)),
      ...(await page.evaluate(() => ({
        committedTileCount:
          window.__PUNCHPRESS_EDITOR__?.getNode("huge-image-1")?.tileSources
            ?.length || 0,
        exactTileDomCount: document.querySelectorAll("[data-raster-tile-ref]")
          .length,
        previewActive:
          document.querySelector('[data-raster-preview-active="true"]') !==
          null,
        previewEligible:
          document.querySelector('[data-raster-preview-eligible="true"]') !==
          null,
        previewReady:
          document.querySelector('[data-raster-preview-ready="true"]') !== null,
        visibleTileCount: Number(
          document
            .querySelector("[data-raster-visible-tile-count]")
            ?.getAttribute("data-raster-visible-tile-count") || 0
        ),
        workingTileCount:
          window.__PUNCHPRESS_EDITOR__?.getBrushWorkingSurfaceStateForNode?.(
            "huge-image-1"
          )?.tiles?.length || 0,
        workingTileDomCount: document.querySelectorAll(
          "[data-testid='raster-working-tile']"
        ).length,
      }))),
    });
  }

  await page.evaluate(async () => {
    await window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__?.ready;
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
  });

  for (const frame of frameStats) {
    expect(frame.darkPixelCount, JSON.stringify(frameStats)).toBeGreaterThan(
      beforeRelease.darkPixelCount * 0.8
    );
  }
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

  const dips = diagnostics.flatMap((frame) => {
    if (frame.phase !== "after-release") {
      return [];
    }

    const beforeRelease = diagnostics.find(
      (candidate) =>
        candidate.strokeIndex === frame.strokeIndex &&
        candidate.phase === "before-release"
    );

    if (!beforeRelease) {
      return [];
    }

    if (
      frame.pixels.darkPixelCount >=
      beforeRelease.pixels.darkPixelCount * 0.82
    ) {
      return [];
    }

    return [
      {
        activeTool: frame.state.activeTool,
        beforePixels: beforeRelease.pixels.darkPixelCount,
        exactTileDomCount: frame.state.exactTileDomCount,
        exactTilesReady: frame.state.exactTilesReady,
        frameIndex: frame.frameIndex,
        loadedExactTileCount: frame.state.loadedExactTileCount,
        pixels: frame.pixels.darkPixelCount,
        previewActive: frame.state.previewActive,
        previewReady: frame.state.previewReady,
        strokeIndex: frame.strokeIndex,
        workingSurfaceCompleted: frame.state.workingSurfaceCompleted,
        workingSurfaceType: frame.state.workingSurfaceType,
        workingTileCount: frame.state.workingTileCount,
      },
    ];
  });

  expect(dips).toEqual([]);
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
    const rasterRoot = document.querySelector("[data-raster-render-key]");
    const workingSurface =
      node?.type === "image"
        ? editor?.getBrushWorkingSurfaceStateForNode?.(node.id)
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
      workingSurfaceType: workingSurface?.type || null,
      workingTileCount:
        workingSurface?.type === "tiles" ? workingSurface.tiles.length : 0,
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

    const heldRenderReadyEvents: Event[] = [];
    const originalDispatchEvent = window.dispatchEvent.bind(window);

    window.dispatchEvent = (event) => {
      if (event.type === "punchpress:raster-node-render-ready") {
        heldRenderReadyEvents.push(event);
        return true;
      }

      return originalDispatchEvent(event);
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
      if (heldRenderReadyEvents.length > 0) {
        break;
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const previewCountWithoutAck = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;
    const workingSurfaceWithoutAck =
      editor.getBrushWorkingSurfaceStateForNode?.("large-image-1");
    const heldEventCount = heldRenderReadyEvents.length;

    window.dispatchEvent = originalDispatchEvent;

    for (const event of heldRenderReadyEvents) {
      originalDispatchEvent(event);
    }

    for (let index = 0; index < 4; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const previewCountAfterAck = document.querySelectorAll(
      "[data-brush-preview-node-id]"
    ).length;
    const workingSurfaceAfterAck =
      editor.getBrushWorkingSurfaceStateForNode?.("large-image-1");

    return {
      heldEventCount,
      previewCountAfterAck,
      previewCountWithoutAck,
      workingTileCountAfterAck: workingSurfaceAfterAck?.tiles?.length || 0,
      workingTileCountWithoutAck: workingSurfaceWithoutAck?.tiles?.length || 0,
    };
  });

  expect(result.heldEventCount).toBeGreaterThan(0);
  expect(result.previewCountWithoutAck, JSON.stringify(result)).toBe(0);
  expect(
    result.workingTileCountWithoutAck,
    JSON.stringify(result)
  ).toBeGreaterThan(0);
  expect(result.previewCountAfterAck, JSON.stringify(result)).toBe(0);
  expect(result.workingTileCountAfterAck, JSON.stringify(result)).toBe(0);
});

test("tiled raster render acknowledgement waits for a stable paint window", async ({
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

    const waitForStableEvent = async () => {
      for (let index = 0; index < 90; index += 1) {
        const records = window.__PUNCHPRESS_RASTER_DEBUG__?.getRecords() || [];
        const stableEvent = records.find(
          (record) => record.event === "renderer.renderReady.stable"
        );

        if (stableEvent) {
          return records;
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      throw new Error("Timed out waiting for stable raster render event");
    };

    const records = await waitForStableEvent();
    const stableEvent = records.find(
      (record) => record.event === "renderer.renderReady.stable"
    );
    const dispatchEvent = records.find(
      (record) => record.event === "renderer.renderReady.dispatch"
    );
    const readyStateEvent = records
      .filter(
        (record) =>
          record.event === "renderer.exactTiles.readyState" &&
          record.payload?.areExactTilesReady === true
      )
      .at(-1);

    return {
      dispatchAfterStableMs:
        dispatchEvent && stableEvent ? dispatchEvent.t - stableEvent.t : null,
      dispatchEventCount: records.filter(
        (record) => record.event === "renderer.renderReady.dispatch"
      ).length,
      readyToStableMs:
        readyStateEvent && stableEvent
          ? stableEvent.t - readyStateEvent.t
          : null,
      stableElapsedMs: stableEvent?.payload?.elapsedMs || 0,
      stableEventCount: records.filter(
        (record) => record.event === "renderer.renderReady.stable"
      ).length,
      stableFrameCount: stableEvent?.payload?.stableFrameCount || 0,
    };
  });

  expect(result.stableEventCount, JSON.stringify(result)).toBeGreaterThan(0);
  expect(result.dispatchEventCount, JSON.stringify(result)).toBeGreaterThan(0);
  expect(
    result.stableFrameCount,
    JSON.stringify(result)
  ).toBeGreaterThanOrEqual(8);
  expect(result.stableElapsedMs, JSON.stringify(result)).toBeGreaterThanOrEqual(
    90
  );
  expect(result.dispatchAfterStableMs, JSON.stringify(result)).not.toBeNull();
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

test("huge tiled brush strokes cover arbitrary 40000px directions efficiently", async ({
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

  expect(result.width).toBeGreaterThan(55_000);
  expect(result.height).toBeGreaterThan(65_000);
  expect(result.transformX).toBeLessThan(220);
  expect(result.transformY).toBeLessThan(160);
  expect(result.baseX).toBeGreaterThan(0);
  expect(result.baseY).toBeGreaterThan(0);
  expect(result.tileSources.length).toBeGreaterThan(250);
  expect(result.tileSources.length).toBeLessThan(1000);
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
  expect(nativeStrokeSegments).toBe(15);
  expect(touchedTiles).toBeLessThan(620);
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
        const workingSurface =
          editor.getBrushWorkingSurfaceStateForNode?.("huge-image-1");

        counts.push({
          index,
          pointCount: workingSurface?.tiles?.length || 0,
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

test("tiled raster LOD yields to active brush working tiles", async ({
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
  expect(beforeStroke.tileSourceCount).toBeGreaterThan(250);

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
      workingTileCount:
        editor.getBrushWorkingSurfaceStateForNode?.("huge-image-1")?.tiles
          ?.length || 0,
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
  expect(duringStroke.previewActive, JSON.stringify(duringStroke)).toBe(false);
  expect(duringStroke.previewReady, JSON.stringify(duringStroke)).toBe(false);
  expect(
    duringStroke.mountedTileCount,
    JSON.stringify(duringStroke)
  ).toBeGreaterThan(0);
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
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 40,
      spacing: 0,
    });

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
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const surface = editor.getBrushWorkingSurfaceStateForNode?.("image-1");

    return {
      committedTransform: imageNode.transform,
      surfaceTransform: surface?.transform || null,
      surfaceType: surface?.type || null,
      surfaceX: surface?.x || 0,
      surfaceY: surface?.y || 0,
    };
  });

  const placement = await getRasterWorkingCanvasPlacement(page);

  await page.evaluate(() => {
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__?.cancel?.();
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
  });

  expect(interaction.surfaceType).toBe("canvas");
  expect(interaction.surfaceTransform?.x).toBeLessThan(
    interaction.committedTransform.x
  );
  expect(interaction.surfaceTransform?.y).toBeLessThan(
    interaction.committedTransform.y
  );
  expect(interaction.surfaceX).toBeLessThan(0);
  expect(interaction.surfaceY).toBeLessThan(0);
  expect(placement?.type).toBe("canvas");
  expect(placement?.renderedX).toBeCloseTo(
    interaction.committedTransform.x + interaction.surfaceX,
    1
  );
  expect(placement?.renderedY).toBeCloseTo(
    interaction.committedTransform.y + interaction.surfaceY,
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
  await gotoEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const firstStart = await getCanvasStagePoint(page, { x: 320, y: 240 });
  const firstEnd = await getCanvasStagePoint(page, { x: 420, y: 240 });
  const secondStart = await getCanvasStagePoint(page, { x: 560, y: 320 });
  const secondEnd = await getCanvasStagePoint(page, { x: 660, y: 320 });

  await dragBrush(page, [firstStart, firstEnd]);

  const firstStrokeState = await getCommittedImageState(page);

  await dragBrush(page, [secondStart, secondEnd]);

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
  await gotoEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 72);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const start = await getCanvasStagePoint(page, { x: 320, y: 260 });
  const end = await getCanvasStagePoint(page, { x: 520, y: 260 });
  const samplePoint = await getCanvasStagePoint(page, { x: 420, y: 260 });

  await dragBrush(page, [start, end]);

  const paintedSample = await getCommittedImageSampleAtClientPoint(
    page,
    samplePoint
  );

  await page.keyboard.press("e");
  await setBrushSliderValue(page, "Brush size", 72);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);
  await dragBrush(page, [samplePoint, samplePoint]);

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
