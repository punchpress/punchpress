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

const createDenseTiledImageDocument = (tileSrc) => {
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

  for (let row = 0; row < 21; row += 1) {
    for (let col = 0; col < 24; col += 1) {
      tileSources.push({
        col,
        height: RASTER_TILE_TEST_SIZE,
        ref: `assets/raster/huge-image-1/tiles/seed_${col}_${row}.png`,
        row,
        src: tileSrc,
        width: RASTER_TILE_TEST_SIZE,
        x: col * RASTER_TILE_TEST_SIZE,
        y: row * RASTER_TILE_TEST_SIZE,
      });
    }
  }

  return JSON.stringify({
    nodes: [
      {
        assetId: "asset-huge-image-1",
        height: 10_800,
        id: "huge-image-1",
        mimeType: "image/png",
        name: "Huge Image",
        opacity: 1,
        parentId: "root",
        tileSources,
        transform: transform(220, 160),
        type: "image",
        visible: true,
        width: 12_400,
      },
    ],
    version: DOCUMENT_VERSION,
  });
};

const createEmptyDocument = () =>
  JSON.stringify({
    nodes: [],
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

const getRasterStoreSurfaceState = (page) => {
  return page.evaluate(() => {
    const surfaces = [
      ...document.querySelectorAll<SVGForeignObjectElement>(
        "[data-raster-store-surface='true']"
      ),
    ];

    return {
      count: surfaces.length,
      hydratedCount: surfaces.filter(
        (surface) =>
          surface.getAttribute("data-raster-store-hydrated") === "true"
      ).length,
    };
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

const getClientPointForImageLocalPoint = (page, nodeId, localPoint) => {
  return page.evaluate(
    ({ localPoint: targetLocalPoint, nodeId: targetNodeId }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const hostRect = editor?.hostRef?.getBoundingClientRect();
      const viewer = editor?.viewerRef;
      const node = editor?.getNode(targetNodeId);

      if (!(editor && hostRect && viewer && node?.type === "image")) {
        throw new Error("Expected image node for client point mapping");
      }

      return {
        x:
          hostRect.left +
          (node.transform.x + targetLocalPoint.x - viewer.getScrollLeft()) *
            editor.zoom,
        y:
          hostRect.top +
          (node.transform.y + targetLocalPoint.y - viewer.getScrollTop()) *
            editor.zoom,
      };
    },
    { localPoint, nodeId }
  );
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

const createOpaqueTileDataUrl = (page) => {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext("2d");

    if (!context) {
      return "";
    }

    context.fillStyle = "#111111";
    context.fillRect(0, 0, 64, 64);

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

const getScreenshotColumnInkProfile = async (page, clip) => {
  // Warm-up frame: a screenshot forces a compositor BeginFrame so lazily
  // rasterized tiles finish before the frame asserted on. The truncation
  // bug this guards against persists across any number of screenshots.
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
      throw new Error("Expected screenshot canvas context");
    }

    context.drawImage(image, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const columns: number[] = [];

    for (let x = 0; x < canvas.width; x += 1) {
      let inkPixelCount = 0;

      for (let y = 0; y < canvas.height; y += 1) {
        const offset = (y * canvas.width + x) * 4;
        const red = imageData.data[offset];
        const green = imageData.data[offset + 1];
        const blue = imageData.data[offset + 2];
        const alpha = imageData.data[offset + 3];
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

        if (alpha > 200 && luminance < 140) {
          inkPixelCount += 1;
        }
      }

      columns.push(inkPixelCount);
    }

    return { columns, height: canvas.height, width: canvas.width };
  }, src);
};

const getSeamGapColumns = (columns: number[]) => {
  const sorted = [...columns].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const gapColumns = columns.flatMap((inkPixelCount, column) =>
    inkPixelCount < median * 0.4 ? [{ column, inkPixelCount }] : []
  );

  return { gapColumns, median };
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

const getStrokeClipAtZoom = (page, nodeId, localRect) => {
  return page.evaluate(
    ({ localRect: rect, nodeId: targetNodeId }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const hostRect = editor?.hostRef?.getBoundingClientRect();
      const viewer = editor?.viewerRef;
      const node = editor?.getNode(targetNodeId);

      if (!(editor && hostRect && viewer && node?.type === "image")) {
        throw new Error("Expected image node for stroke clip");
      }

      const toClientPoint = (point) => ({
        x:
          hostRect.left +
          (node.transform.x + point.x - viewer.getScrollLeft()) * editor.zoom,
        y:
          hostRect.top +
          (node.transform.y + point.y - viewer.getScrollTop()) * editor.zoom,
      });
      const topLeft = toClientPoint({ x: rect.x, y: rect.y });
      const bottomRight = toClientPoint({
        x: rect.x + rect.width,
        y: rect.y + rect.height,
      });

      return {
        height: Math.floor(bottomRight.y - topLeft.y),
        width: Math.floor(
          Math.min(
            window.innerWidth - 20 - topLeft.x,
            bottomRight.x - topLeft.x
          )
        ),
        x: Math.ceil(Math.max(0, topLeft.x)),
        y: Math.ceil(topLeft.y),
        zoom: editor.zoom,
      };
    },
    { localRect, nodeId }
  );
};

// Blink paints world-space content through a cull rect that stops around
// 16384 CSS px. An in-world raster surface spanning more local pixels than
// that truncates at raster-tile boundaries (512 * 2^k local px at
// power-of-two zoom buckets -- lines that look exactly like pyramid tile
// seams) or drops content entirely, so such surfaces must render through the
// screen-space raster surface layer. These two tests pin the symptom at the
// reported zooms by scanning stroke screenshots for background-colored gaps.

test("zoomed-out strokes show no background seams across a wide viewport", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await page.setViewportSize({ height: 900, width: 3600 });
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("huge-image-1");
    editor?.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 400,
      spacing: 0,
    });
  });
  await hydrateRasterStore(page, "huge-image-1");

  // 21% zoom renders through pyramid level 2 and, on a wide viewport, sizes
  // the raster surface past 16384 CSS px, matching the reported repro.
  await setStableViewport(page, { x: 3000, y: 3900, zoom: 0.21 });
  await waitForAnimationFrames(page, 4);

  // Thick hard stroke crossing many 2048px raster/pyramid spans, extending
  // the layer to the right past its initial width.
  await drawCommittedBrushLine(
    page,
    "huge-image-1",
    { x: 1000, y: 5200 },
    { x: 20_000, y: 5200 }
  );

  await expect
    .poll(
      async () => (await getCommittedImageState(page))?.tileSourceCount || 0
    )
    .toBeGreaterThan(0);
  await waitForAnimationFrames(page, 6);

  const clip = await getStrokeClipAtZoom(page, "huge-image-1", {
    height: 300,
    width: 16_300,
    x: 3200,
    y: 5050,
  });

  expect(clip.zoom).toBeCloseTo(0.21, 3);

  const profile = await getScreenshotColumnInkProfile(page, clip);
  const { gapColumns, median } = getSeamGapColumns(profile.columns);

  expect(median).toBeGreaterThan(40);
  expect(
    gapColumns.length,
    `background seam columns (median ink ${median}): ${JSON.stringify(gapColumns.slice(0, 24))}`
  ).toBe(0);
});

test("thin strokes stay continuous through deep zoom-out pyramid levels", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("huge-image-1");
    editor?.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 200,
      spacing: 0,
    });
  });
  await hydrateRasterStore(page, "huge-image-1");

  // Long thin stroke extending the layer to ~20100px so the raster surface
  // spans more CSS pixels than Chromium's max texture size.
  await drawCommittedBrushLine(
    page,
    "huge-image-1",
    { x: 1000, y: 5200 },
    { x: 20_000, y: 5200 }
  );

  await expect
    .poll(
      async () => (await getCommittedImageState(page))?.tileSourceCount || 0
    )
    .toBeGreaterThan(0);

  // 4.5% zoom renders through pyramid level 4 with the whole stroke on
  // screen; the dashed-stroke symptom appears as columns with no ink.
  await setStableViewport(page, { x: 0, y: 0, zoom: 0.045 });
  await waitForAnimationFrames(page, 6);

  const clip = await getStrokeClipAtZoom(page, "huge-image-1", {
    height: 500,
    width: 18_000,
    x: 1400,
    y: 4950,
  });

  expect(clip.zoom).toBeCloseTo(0.045, 3);

  const profile = await getScreenshotColumnInkProfile(page, clip);
  const { gapColumns, median } = getSeamGapColumns(profile.columns);

  expect(median).toBeGreaterThan(4);

  expect(
    gapColumns.length,
    `dashed stroke gap columns (median ink ${median}): ${JSON.stringify(gapColumns.slice(0, 24))}`
  ).toBe(0);
});

const setBrushSliderValue = async (page, name, value) => {
  const slider = page.getByRole("slider", { name });

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

test("brush shows a footprint cursor over the canvas", async ({ page }) => {
  await gotoEditor(page);
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
  await gotoEditor(page);

  const point = await getCanvasStagePoint(page, { x: 320, y: 240 });
  await page.mouse.move(point.x, point.y);

  await expect(page.getByTestId("brush-cursor")).toBeHidden();

  await page.keyboard.press("b");

  await expect(page.getByTestId("brush-cursor")).toBeVisible();
});

test("brush properties update settings and the brush cursor", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("b");

  await expect(page.getByText("Brush")).toBeVisible();

  await setBrushHexColor(page, "#FF0033");
  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 50);
  await setBrushSliderValue(page, "Brush hardness", 25);
  await setBrushSliderValue(page, "Brush spacing", 150);

  await expect
    .poll(() => getRasterToolSettings(page, "brush"))
    .toEqual({
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
  await gotoEditor(page);

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
  await gotoEditor(page);
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

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSample(page, { x: 20, y: 20 });

      return sample ? sample.a > 0 : false;
    })
    .toBe(true);

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
  await gotoEditor(page);
  await page.keyboard.press("b");

  const start = await getCanvasStagePoint(page, { x: 320, y: 240 });
  const end = await getCanvasStagePoint(page, { x: 480, y: 240 });
  const clip = {
    height: 80,
    width: end.x - start.x + 80,
    x: start.x - 40,
    y: start.y - 40,
  };

  await page.mouse.move(start.x, start.y);

  const baseline = await getScreenshotDarkPixelStats(page, clip);

  await dragBrush(page, [start, end], { release: false });
  await waitForAnimationFrames(page, 2);

  const beforeRelease = await getScreenshotDarkPixelStats(page, clip);

  expect(beforeRelease.darkPixelCount).toBeGreaterThan(
    baseline.darkPixelCount + 800
  );
  expect(await getRasterStoreSurfaceState(page)).toMatchObject({ count: 1 });

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
  await waitForAnimationFrames(page, 2);

  const afterRelease = await getScreenshotDarkPixelStats(page, clip);

  expect(afterRelease.darkPixelCount).toBeGreaterThan(
    baseline.darkPixelCount + 800
  );
});

test("eraser removes committed brush pixels through the shared brush path", async ({
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

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        samplePoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

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

      return sample?.a ?? null;
    })
    .toBe(0);
});

test("soft eraser opacity reduces alpha with brush falloff", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.keyboard.press("b");

  await setBrushSliderValue(page, "Brush size", 100);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const paintPoint = await getCanvasStagePoint(page, { x: 420, y: 300 });

  await dragBrush(page, [paintPoint, paintPoint]);

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        paintPoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

  await page.keyboard.press("e");
  await setBrushSliderValue(page, "Brush size", 100);
  await setBrushSliderValue(page, "Brush opacity", 50);
  await setBrushSliderValue(page, "Brush hardness", 0);

  const edgePoint = await getCanvasStagePoint(page, { x: 460, y: 300 });

  await dragBrush(page, [paintPoint, paintPoint]);

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        paintPoint
      );

      return sample ? sample.a > 100 && sample.a < 255 : false;
    })
    .toBe(true);

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

  const imageState = await getCommittedImageState(page);

  expect(imageState?.parentId).toBe("artboard-1");

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(page, point);

      return sample?.a ?? null;
    })
    .toBe(255);
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

  await expect
    .poll(
      async () => (await getCommittedImageState(page))?.tileSourceCount || 0
    )
    .toBeGreaterThan(0);

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

test("painting a bloated artboard raster clips it back to the frame", async ({
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

  await expect
    .poll(() => getRasterStoreSurfaceState(page))
    .toMatchObject({ count: 1 });

  await page.mouse.up();

  await expect
    .poll(async () => (await getCommittedImageState(page))?.width || 0)
    .toBeLessThanOrEqual(340);

  const imageState = await getCommittedImageState(page);

  expect(imageState?.id).toBe("image-1");
  expect(imageState?.parentId).toBe("artboard-1");
  expect(imageState?.tileSourceCount).toBe(0);
  expect(imageState?.width).toBeLessThanOrEqual(340);
  expect(imageState?.height).toBeLessThanOrEqual(260);
  expect((imageState?.x || 0) + (imageState?.width || 0)).toBeLessThanOrEqual(
    560
  );
  expect((imageState?.y || 0) + (imageState?.height || 0)).toBeLessThanOrEqual(
    420
  );
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
  const clip = {
    height: end.y - start.y + 120,
    width: end.x - start.x + 120,
    x: start.x - 60,
    y: start.y - 60,
  };

  await page.mouse.move(start.x, start.y);

  const baseline = await getScreenshotDarkPixelStats(page, clip);

  await dragBrush(page, [start, end], { release: false, steps: 4 });
  await waitForAnimationFrames(page, 2);

  const beforeRelease = await getScreenshotDarkPixelStats(page, clip);

  expect(beforeRelease.darkPixelCount).toBeGreaterThan(
    baseline.darkPixelCount + 800
  );
  expect(await getRasterStoreSurfaceState(page)).toMatchObject({ count: 1 });

  await page.mouse.up();

  await expect
    .poll(
      async () => (await getCommittedImageState(page))?.tileSourceCount || 0
    )
    .toBeGreaterThan(0);

  const afterRelease = await getScreenshotDarkPixelStats(page, clip);

  expect(afterRelease.darkPixelCount).toBeGreaterThan(
    baseline.darkPixelCount + 800
  );
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

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(page, point);

      return sample?.a ?? null;
    })
    .toBe(255);

  const afterStroke = await getCommittedImageState(page);

  expect(afterStroke).toMatchObject({
    height: beforeStroke?.height,
    id: beforeStroke?.id,
    transform: beforeStroke?.transform,
    width: beforeStroke?.width,
  });
});

test("default brush shows ink on the first down at 4% zoom", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await setStableViewport(page, { x: 0, y: 0, zoom: 0.04 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 500,
      spacing: 0,
    });
  });
  await page.keyboard.press("b");
  await hydrateRasterStore(page, "huge-image-1");

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

  const clip = {
    height: 100,
    width: 100,
    x: point.x - 50,
    y: point.y - 50,
  };

  await page.mouse.move(point.x, point.y);

  const baseline = await getScreenshotDarkPixelStats(page, clip);

  await page.mouse.down();
  await waitForAnimationFrames(page, 2);
  await page.waitForTimeout(25);

  const afterDown = await getScreenshotDarkPixelStats(page, clip);

  expect(afterDown.darkPixelCount).toBeGreaterThan(
    baseline.darkPixelCount + 150
  );
  expect(await getRasterStoreSurfaceState(page)).toMatchObject({ count: 1 });

  await page.mouse.up();
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
    const commit = session.complete({
      point: toWorldPoint({
        x: 72_120,
        y: 160,
      }),
    });
    const completeReturnElapsedMs = performance.now() - completeStartedAt;

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const nextFrameElapsedMs = performance.now() - completeStartedAt;

    await commit;

    return {
      completeReturnElapsedMs,
      nextFrameElapsedMs,
    };
  });

  expect(result.completeReturnElapsedMs, JSON.stringify(result)).toBeLessThan(
    80
  );
  expect(result.nextFrameElapsedMs, JSON.stringify(result)).toBeLessThan(80);
});

test("quick low-zoom tiled brush strokes stay visible through release", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.select("huge-image-1");
    editor?.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 80,
      spacing: 0,
    });
  });
  await setStableViewport(page, { x: 0, y: 0, zoom: 0.07 });
  await page.keyboard.press("b");
  await hydrateRasterStore(page, "huge-image-1");

  const clip = await page.evaluate(() => ({
    height: Math.max(1, Math.min(560, window.innerHeight - 180)),
    width: Math.max(1, Math.min(860, window.innerWidth - 560)),
    x: 260,
    y: 90,
  }));

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
      point: toWorldPoint({ x: 900, y: 900 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = session;
    await session.ready;
    session.update({ point: toWorldPoint({ x: 49_000, y: 31_000 }) });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const beforeRelease = await getScreenshotDarkPixelStats(page, clip);

  expect(beforeRelease.darkPixelCount).toBeGreaterThan(500);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(node?.type === "image" && session)) {
      throw new Error("Expected active brush session");
    }

    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_COMMIT__ = session.complete({
      point: {
        x: node.transform.x + 49_000,
        y: node.transform.y + 31_000,
      },
    });
  });

  const frameCounts: number[] = [];

  for (let index = 0; index < 10; index += 1) {
    await waitForAnimationFrames(page, 1);
    frameCounts.push(
      (await getScreenshotDarkPixelStats(page, clip)).darkPixelCount
    );
  }

  await page.evaluate(async () => {
    await window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_COMMIT__;
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_COMMIT__ = undefined;
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
  });

  const afterCommit = await getScreenshotDarkPixelStats(page, clip);
  const minimumDarkPixelCount = Math.floor(beforeRelease.darkPixelCount * 0.98);

  for (const frameCount of frameCounts) {
    expect(frameCount, JSON.stringify(frameCounts)).toBeGreaterThanOrEqual(
      minimumDarkPixelCount
    );
  }

  expect(
    afterCommit.darkPixelCount,
    JSON.stringify(frameCounts)
  ).toBeGreaterThanOrEqual(minimumDarkPixelCount);
});

test("quick low-zoom tiled brush strokes do not visually flash after release", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await hydrateRasterStore(page, "huge-image-1");
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
      size: 64,
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

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(node?.type === "image" && session)) {
      throw new Error("Expected active brush session");
    }

    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_COMMIT__ = session.complete({
      point: {
        x: node.transform.x + 38_000,
        y: node.transform.y + 8200,
      },
    });
  });

  const frameStats: { darkPixelCount: number }[] = [];

  for (let index = 0; index < 5; index += 1) {
    await waitForAnimationFrames(page, 1);
    frameStats.push({
      darkPixelCount: (await getScreenshotDarkPixelStats(page, clip))
        .darkPixelCount,
    });
  }

  await page.evaluate(async () => {
    await window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_COMMIT__;
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_COMMIT__ = undefined;
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
  });

  for (const frame of frameStats) {
    expect(frame.darkPixelCount, JSON.stringify(frameStats)).toBeGreaterThan(
      beforeRelease.darkPixelCount * 0.8
    );
  }
});

test("real pointer extreme zoom brush release does not blank visible ink", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  await gotoEditor(page);
  await loadRasterTestDocument(page, createEmptyDocument());
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      throw new Error("Expected editor");
    }

    const emptyLayerId = editor.addEmptyLayer();
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
    const storeSurface = document.querySelector(
      "[data-raster-store-surface='true']"
    );

    return {
      activeTool: editor?.activeTool || null,
      committedTileCount: node?.tileSources?.length || 0,
      node:
        node?.type === "image"
          ? {
              height: node.height,
              transform: node.transform,
              width: node.width,
            }
          : null,
      storeSurfaceHydrated:
        storeSurface?.getAttribute("data-raster-store-hydrated") || null,
      storeSurfacePresent: Boolean(storeSurface),
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

test("huge tiled brush strokes preserve previous strokes in the same tile", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await page.keyboard.press("b");
  await hydrateRasterStore(page, "huge-image-1");

  await setBrushSliderValue(page, "Brush size", 64);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  const point = await getCanvasStagePoint(page, { x: 360, y: 270 });

  await dragBrush(page, [point, point]);

  await expect
    .poll(
      async () => (await getCommittedImageState(page))?.tileSourceCount || 0
    )
    .toBeGreaterThan(0);

  const firstState = await getCommittedImageState(page);

  await dragBrush(page, [point, point]);

  await expect
    .poll(
      async () => (await getCommittedImageState(page))?.tileSourceCount || 0
    )
    .toBeGreaterThan(firstState?.tileSourceCount || 0);

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
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await hydrateRasterStore(page, "huge-image-1");
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
    await session.complete({ point: toWorldPoint({ x: 620, y: 900 }) });
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
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await setViewport(page, { x: 0, y: 0, zoom: 0.05 });
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await page.keyboard.press("b");
  await hydrateRasterStore(page, "huge-image-1");

  await setBrushSliderValue(page, "Brush size", 96);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const point = { x: 6000, y: 11_200 };
    const session = brush?.beginStroke({ point });

    await session?.complete({ point });
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
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await gotoEditor(page);
  const src = await createOpaqueImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("huge-image-1");
  });
  await page.keyboard.press("b");
  await hydrateRasterStore(page, "huge-image-1");

  await setBrushSliderValue(page, "Brush size", 96);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const point = { x: 160, y: 500 };
    const session = brush?.beginStroke({ point });

    await session?.complete({ point });
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
}, testInfo) => {
  testInfo.setTimeout(90_000);
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
  await hydrateRasterStore(page, "huge-image-1");

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
  const tileRefs = result.tileSources.map((tile) => tile.ref);

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
  expect(result.elapsedMs).toBeLessThan(3000);
});

test("long active working tile surface does not discard earlier touched tiles", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createHugeImageDocument(src));
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");

    if (!(editor && node?.type === "image")) {
      throw new Error("Expected huge image node");
    }

    editor.select("huge-image-1");
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 500,
      spacing: 0,
    });
  });
  await setStableViewport(page, { x: -580, y: -440, zoom: 0.04 });
  await page.keyboard.press("b");
  await hydrateRasterStore(page, "huge-image-1");

  const earlyClip = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const hostRect = editor?.hostRef?.getBoundingClientRect();
    const viewer = editor?.viewerRef;
    const node = editor?.getNode("huge-image-1");

    if (!(editor && hostRect && viewer && node?.type === "image")) {
      throw new Error("Expected huge image node for clip");
    }

    const toClientPoint = (point) => ({
      x:
        hostRect.left +
        (node.transform.x + point.x - viewer.getScrollLeft()) * editor.zoom,
      y:
        hostRect.top +
        (node.transform.y + point.y - viewer.getScrollTop()) * editor.zoom,
    });
    const earlyStart = toClientPoint({ x: 1000, y: 5200 });
    const earlyEnd = toClientPoint({ x: 3000, y: 5200 });

    return {
      height: 60,
      width: Math.max(40, Math.floor(earlyEnd.x - earlyStart.x) + 40),
      x: Math.floor(earlyStart.x) - 20,
      y: Math.floor(earlyStart.y) - 30,
    };
  });

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("huge-image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and huge image node");
    }

    const toWorldPoint = (localPoint) => ({
      x: node.transform.x + localPoint.x,
      y: node.transform.y + localPoint.y,
    });
    const session = brush.beginStroke({
      point: toWorldPoint({ x: 1000, y: 5200 }),
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = session;
    await session.ready;
    session.update({ point: toWorldPoint({ x: 2000, y: 5200 }) });
    session.update({ point: toWorldPoint({ x: 3000, y: 5200 }) });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const earlyStats = await getScreenshotDarkPixelStats(page, earlyClip);

  expect(earlyStats.darkPixelCount).toBeGreaterThan(300);

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(node?.type === "image" && session)) {
      throw new Error("Expected active brush session");
    }

    const toWorldPoint = (localPoint) => ({
      x: node.transform.x + localPoint.x,
      y: node.transform.y + localPoint.y,
    });
    const totalPoints = 120;

    for (let index = 1; index <= totalPoints; index += 1) {
      const progress = index / totalPoints;

      session.update({
        point: toWorldPoint({
          x: 3000 + (node.width * 0.7 - 3000) * progress,
          y: 5200 + Math.sin(progress * Math.PI * 6) * node.height * 0.18,
        }),
      });

      if (index % 12 === 0) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const lateStats = await getScreenshotDarkPixelStats(page, earlyClip);

  expect(lateStats.darkPixelCount).toBeGreaterThanOrEqual(
    Math.floor(earlyStats.darkPixelCount * 0.95)
  );

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("huge-image-1");
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(node?.type === "image" && session)) {
      throw new Error("Expected active brush session");
    }

    await session.complete({
      point: {
        x: node.transform.x + node.width * 0.7,
        y: node.transform.y + 5200,
      },
    });
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
  });
  await waitForAnimationFrames(page, 2);

  const afterRelease = await getScreenshotDarkPixelStats(page, earlyClip);

  expect(afterRelease.darkPixelCount).toBeGreaterThanOrEqual(
    Math.floor(earlyStats.darkPixelCount * 0.95)
  );
});

test("over-dense tiled raster preview stays anchored while panning", async ({
  page,
}) => {
  await gotoEditor(page);
  const tileSrc = await createOpaqueTileDataUrl(page);
  await loadRasterTestDocument(page, createDenseTiledImageDocument(tileSrc));
  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const imageNode = editor?.getNode("huge-image-1");

    if (!(editor && imageNode?.type === "image")) {
      throw new Error("Expected huge tiled image node");
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

test("rapid brush strokes on a large artboard paint through a working surface", async ({
  page,
}) => {
  const pageErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });

  await gotoEditor(page);
  await loadRasterTestDocument(page, createLargeArtboardDocument());
  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.select("artboard-1");
  });
  await page.keyboard.press("b");

  const strokes = [
    [
      { x: 620, y: 360 },
      { x: 840, y: 420 },
    ],
    [
      { x: 660, y: 560 },
      { x: 900, y: 620 },
    ],
    [
      { x: 700, y: 300 },
      { x: 920, y: 250 },
    ],
  ];
  let previousTileCount = 0;

  for (const [startOffset, endOffset] of strokes) {
    const start = await getCanvasStagePoint(page, startOffset);
    const end = await getCanvasStagePoint(page, endOffset);
    const clip = {
      height: Math.abs(end.y - start.y) + 100,
      width: end.x - start.x + 100,
      x: start.x - 50,
      y: Math.min(start.y, end.y) - 50,
    };

    await page.mouse.move(start.x, start.y);

    const baseline = await getScreenshotDarkPixelStats(page, clip);
    const expectedTileCount = previousTileCount;

    await dragBrush(page, [start, end], { steps: 4 });

    await expect
      .poll(
        async () => (await getCommittedImageState(page))?.tileSourceCount || 0
      )
      .toBeGreaterThan(expectedTileCount);

    previousTileCount =
      (await getCommittedImageState(page))?.tileSourceCount || 0;

    const afterStroke = await getScreenshotDarkPixelStats(page, clip);

    expect(afterStroke.darkPixelCount).toBeGreaterThan(
      baseline.darkPixelCount + 500
    );
  }

  const imageState = await getCommittedImageState(page);

  expect(imageState?.parentId).toBe("artboard-1");
  expect(pageErrors).toEqual([]);
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

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        firstPoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

  const firstState = await getCommittedImageState(page);

  await dragBrush(page, [secondPoint, secondPoint]);

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        secondPoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

  const expandedState = await getCommittedImageState(page);
  const pinnedSample = await getCommittedImageSampleAtClientPoint(
    page,
    firstPoint
  );

  expect(expandedState?.id).toBe(firstState?.id);
  expect(expandedState?.width).toBeGreaterThan(firstState?.width || 0);
  expect(expandedState?.height).toBeGreaterThan(firstState?.height || 0);
  expect(pinnedSample?.a).toBe(255);
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

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        firstPoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

  const firstState = await getCommittedImageState(page);

  await dragBrush(page, [secondPoint, secondPoint]);

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        secondPoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

  const expandedState = await getCommittedImageState(page);
  const pinnedSample = await getCommittedImageSampleAtClientPoint(
    page,
    firstPoint
  );

  expect(expandedState?.id).toBe(firstState?.id);
  expect(expandedState?.x).toBeLessThan(firstState?.x || 0);
  expect(expandedState?.width).toBeGreaterThan(firstState?.width || 0);
  expect(pinnedSample?.a).toBe(255);
});

test("expanded brush working canvas stays pinned while drawing", async ({
  page,
}) => {
  await gotoEditor(page);
  const src = await createTransparentImageDataUrl(page);
  await loadRasterTestDocument(page, createSmallImageDocument(src));
  await page.keyboard.press("b");

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("image-1");

    if (!(editor && node?.type === "image")) {
      throw new Error("Expected small image node");
    }

    editor.select("image-1");
    editor.setBrushSettings({
      hardness: 1,
      opacity: 1,
      size: 40,
      spacing: 0,
    });
    await editor.rasterStores.ensureHydrated(node);
  });

  const anchorClient = await getClientPointForImageLocalPoint(page, "image-1", {
    x: 72,
    y: 72,
  });
  const clip = {
    height: 60,
    width: 60,
    x: anchorClient.x - 30,
    y: anchorClient.y - 30,
  };

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const brush = editor?.tools.get("brush");
    const node = editor?.getNode("image-1");

    if (!(editor && brush && node?.type === "image")) {
      throw new Error("Expected brush and image node");
    }

    const session = brush.beginStroke({
      point: {
        x: node.transform.x + 72,
        y: node.transform.y + 72,
      },
    });

    if (!session) {
      throw new Error("Expected brush stroke session");
    }

    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = session;
    await session.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const beforeExpansion = await getScreenshotDarkPixelStats(page, clip);

  expect(beforeExpansion.darkPixelCount).toBeGreaterThan(300);
  expect(await getRasterStoreSurfaceState(page)).toMatchObject({ count: 1 });

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("image-1");
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(node?.type === "image" && session)) {
      throw new Error("Expected active brush session");
    }

    const toWorldPoint = (localPoint) => ({
      x: node.transform.x + localPoint.x,
      y: node.transform.y + localPoint.y,
    });
    const segments = [
      { x: 20, y: 30 },
      { x: -60, y: -20 },
      { x: -120, y: -80 },
      { x: -180, y: -130 },
    ];

    for (const segment of segments) {
      session.update({ point: toWorldPoint(segment) });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });

  const duringExpansion = await getScreenshotDarkPixelStats(page, clip);

  expect(duringExpansion.darkPixelCount).toBeGreaterThanOrEqual(
    Math.floor(beforeExpansion.darkPixelCount * 0.95)
  );

  await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.getNode("image-1");
    const session = window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__;

    if (!(node?.type === "image" && session)) {
      throw new Error("Expected active brush session");
    }

    await session.complete({
      point: {
        x: node.transform.x - 180,
        y: node.transform.y - 130,
      },
    });
    window.__PUNCHPRESS_ACTIVE_RASTER_BRUSH_TEST_SESSION__ = undefined;
  });
  await waitForAnimationFrames(page, 2);

  const afterRelease = await getScreenshotDarkPixelStats(page, clip);

  expect(afterRelease.darkPixelCount).toBeGreaterThanOrEqual(
    Math.floor(beforeExpansion.darkPixelCount * 0.95)
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

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        firstPoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

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
  const resizedPinnedSampleBeforeStroke =
    await getCommittedImageSampleAtClientPoint(page, firstPoint);
  const secondPoint = {
    x: firstPoint.x + 220,
    y: firstPoint.y + 40,
  };

  await dragBrush(page, [secondPoint, secondPoint]);

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        secondPoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

  const afterSecondStrokeState = await getCommittedImageState(page);
  const afterSecondStrokeShell = await getRasterShellState(page);
  const pinnedSample = await getCommittedImageSampleAtClientPoint(
    page,
    firstPoint
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

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        paintPoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

  const beforeErase = await getCommittedImageState(page);

  await page.keyboard.press("e");
  await setBrushSliderValue(page, "Brush size", 40);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);
  await dragBrush(page, [emptyPoint, emptyPoint]);

  await expect
    .poll(async () => {
      const state = await getCommittedImageState(page);

      return state?.tileSourceCount || 0;
    })
    .toBe(0);

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

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(page, point);

      return sample?.a ?? null;
    })
    .toBe(255);

  const paintedState = await getCommittedImageState(page);

  await page.keyboard.press("e");
  await setBrushSliderValue(page, "Brush size", 120);
  await setBrushSliderValue(page, "Brush opacity", 100);
  await setBrushSliderValue(page, "Brush hardness", 100);
  await dragBrush(page, [point, point]);

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(page, point);

      return sample?.a ?? null;
    })
    .toBe(0);

  const erasedState = await getCommittedImageState(page);

  expect(erasedState).toMatchObject({
    id: paintedState?.id,
  });
  expect(erasedState?.tileSourceCount).toBe(0);
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

  await expect
    .poll(
      async () => (await getCommittedImageState(page))?.tileSourceCount || 0
    )
    .toBeGreaterThan(0);

  const firstStrokeState = await getCommittedImageState(page);

  await dragBrush(page, [secondStart, secondEnd]);

  await expect
    .poll(
      async () => (await getCommittedImageState(page))?.tileSourceCount || 0
    )
    .toBeGreaterThan(firstStrokeState?.tileSourceCount || 0);

  const secondStrokeState = await getCommittedImageState(page);

  expect(firstStrokeState).toBeTruthy();
  expect(secondStrokeState).toBeTruthy();
  expect(secondStrokeState?.id).toBe(firstStrokeState?.id);
  expect(secondStrokeState?.tileSourceCount).toBeGreaterThan(
    firstStrokeState?.tileSourceCount || 0
  );
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

  await expect
    .poll(async () => {
      const sample = await getCommittedImageSampleAtClientPoint(
        page,
        samplePoint
      );

      return sample?.a ?? null;
    })
    .toBe(255);

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

      return sample?.a ?? null;
    })
    .toBe(0);

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
  await gotoEditor(page);
  const emptyLayerId = await page.evaluate(() => {
    return window.__PUNCHPRESS_EDITOR__?.addEmptyLayer();
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
  await gotoEditor(page);
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
  await waitForAnimationFrames(page, 2);

  await expect
    .poll(() => getRasterShellState(page))
    .toMatchObject({
      height: "96px",
      width: "96px",
    });
  await expect
    .poll(async () => {
      const state = await getCommittedImageState(page);

      return {
        height: state?.height ?? null,
        width: state?.width ?? null,
      };
    })
    .toEqual({
      height: 96,
      width: 96,
    });

  await page.mouse.up();

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
  await gotoEditor(page);
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
