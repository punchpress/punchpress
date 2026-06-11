import { createCanvas } from "../tools/brush-runtime";
import { RasterTilePyramid } from "./raster-pyramid";
import { RasterTileStore } from "./raster-tile-store";

export type RasterStoreEntry = {
  anchorX: number;
  anchorY: number;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  pyramid: RasterTilePyramid | null;
  store: RasterTileStore;
};

export class RasterStoreManager {
  entries = new Map<string, RasterStoreEntry>();
  onChange: (() => void) | null;

  constructor({ onChange = null }: { onChange?: (() => void) | null } = {}) {
    this.onChange = onChange;
  }

  getEntry(nodeId: string) {
    return this.entries.get(nodeId) || null;
  }

  getStore(nodeId: string) {
    return this.entries.get(nodeId)?.store || null;
  }

  getOrCreateEntry(nodeId: string) {
    const existingEntry = this.entries.get(nodeId);

    if (existingEntry) {
      return existingEntry;
    }

    const entry: RasterStoreEntry = {
      anchorX: 0,
      anchorY: 0,
      hydrated: false,
      hydrating: null,
      pyramid: null,
      store: new RasterTileStore(),
    };
    this.entries.set(nodeId, entry);
    return entry;
  }

  getPyramid(nodeId: string) {
    const entry = this.entries.get(nodeId);

    if (!entry) {
      return null;
    }

    if (!entry.pyramid) {
      entry.pyramid = new RasterTilePyramid(entry.store);
    }

    return entry.pyramid;
  }

  ensureHydrated(node: { id: string }) {
    const entry = this.getOrCreateEntry(node.id);

    if (entry.hydrated) {
      return Promise.resolve();
    }

    if (!entry.hydrating) {
      entry.hydrating = hydrateStoreFromNode(entry.store, node).then(() => {
        entry.hydrated = true;
        entry.hydrating = null;
        this.onChange?.();
      });
    }

    return entry.hydrating;
  }

  release(nodeId: string) {
    this.entries.delete(nodeId);
  }

  releaseAll() {
    this.entries.clear();
  }
}

const hydrateStoreFromNode = async (store: RasterTileStore, node) => {
  const sources = [];

  if (node.src) {
    sources.push({
      height: node.baseHeight ?? node.height,
      src: node.src,
      width: node.baseWidth ?? node.width,
      x: node.baseX ?? 0,
      y: node.baseY ?? 0,
    });
  }

  for (const tileSource of node.tileSources || []) {
    sources.push({
      height: tileSource.height,
      src: tileSource.src,
      width: tileSource.width,
      x: tileSource.x,
      y: tileSource.y,
    });
  }

  for (const source of sources) {
    await hydrateImageSource(store, source);
  }

  store.consumeDirtyBounds();
};

const loadImageElement = (src) => {
  if (typeof Image === "undefined" || !src) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = new Image();

    image.addEventListener("error", () => resolve(null));
    image.addEventListener("load", () => resolve(image));
    image.src = src;
  });
};

const hasVisibleAlpha = (imageData) => {
  for (let offset = 3; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset] !== 0) {
      return true;
    }
  }

  return false;
};

const hydrateImageSource = async (store, source) => {
  const image = await loadImageElement(source.src);

  if (!image) {
    return;
  }

  const naturalWidth = image.naturalWidth || image.width || 1;
  const naturalHeight = image.naturalHeight || image.height || 1;
  const scaleX = source.width / naturalWidth;
  const scaleY = source.height / naturalHeight;
  const bounds = {
    maxX: source.x + source.width,
    maxY: source.y + source.height,
    minX: source.x,
    minY: source.y,
  };
  const minCol = Math.floor((bounds.minX - store.gutter) / store.tileSize);
  const maxCol = Math.floor(
    (Math.ceil(bounds.maxX) - 1 + store.gutter) / store.tileSize
  );
  const minRow = Math.floor((bounds.minY - store.gutter) / store.tileSize);
  const maxRow = Math.floor(
    (Math.ceil(bounds.maxY) - 1 + store.gutter) / store.tileSize
  );

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const tileX = col * store.tileSize - store.gutter;
      const tileY = row * store.tileSize - store.gutter;
      const tileWidth = store.tileSize + store.gutter * 2;
      const tileHeight = store.tileSize + store.gutter * 2;
      const minX = Math.max(tileX, Math.floor(bounds.minX));
      const minY = Math.max(tileY, Math.floor(bounds.minY));
      const maxX = Math.min(tileX + tileWidth, Math.ceil(bounds.maxX));
      const maxY = Math.min(tileY + tileHeight, Math.ceil(bounds.maxY));
      const width = maxX - minX;
      const height = maxY - minY;

      if (width <= 0 || height <= 0) {
        continue;
      }

      const scratch = createCanvas(width, height);
      const scratchContext = scratch?.getContext("2d", {
        willReadFrequently: true,
      });

      if (!scratchContext) {
        continue;
      }

      scratchContext.drawImage(
        image,
        (minX - source.x) / scaleX,
        (minY - source.y) / scaleY,
        width / scaleX,
        height / scaleY,
        0,
        0,
        width,
        height
      );

      const imageData = scratchContext.getImageData(0, 0, width, height);

      if (!hasVisibleAlpha(imageData)) {
        continue;
      }

      const tile = store.getOrCreateTile(col, row);

      blendImageDataOverTile(tile, imageData, minX - tile.x, minY - tile.y);
      tile.revision += 1;
      store.markTileDirtyForPyramid(tile);
    }
  }

  store.revision += 1;
};

const blendImageDataOverTile = (tile, imageData, offsetX, offsetY) => {
  const source = imageData.data;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const sourceOffset = (y * imageData.width + x) * 4;
      const sourceAlpha = source[sourceOffset + 3] / 255;

      if (sourceAlpha === 0) {
        continue;
      }

      const targetOffset =
        ((y + offsetY) * tile.width + (x + offsetX)) * 4;
      const targetAlpha = tile.pixels[targetOffset + 3] / 255;
      const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

      for (let channel = 0; channel < 3; channel += 1) {
        const sourceChannel = source[sourceOffset + channel] / 255;
        const targetChannel = tile.pixels[targetOffset + channel] / 255;

        tile.pixels[targetOffset + channel] = Math.round(
          ((sourceChannel * sourceAlpha +
            targetChannel * targetAlpha * (1 - sourceAlpha)) /
            outputAlpha) *
            255
        );
      }

      tile.pixels[targetOffset + 3] = Math.round(outputAlpha * 255);
    }
  }
};
