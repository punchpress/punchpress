import { createCanvas, loadImageToCanvas } from "../tools/brush-runtime";
import { RasterTileStore } from "./raster-tile-store";

export type RasterStoreEntry = {
  anchorX: number;
  anchorY: number;
  hydrated: boolean;
  hydrating: Promise<void> | null;
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
      store: new RasterTileStore(),
    };
    this.entries.set(nodeId, entry);
    return entry;
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

const hydrateImageSource = async (store, source) => {
  const loaded = await loadImageToCanvas(
    { height: source.height, src: source.src, width: source.width },
    null
  );

  if (!loaded?.context) {
    return;
  }

  const bounds = {
    maxX: source.x + source.width,
    maxY: source.y + source.height,
    minX: source.x,
    minY: source.y,
  };

  for (const tile of store.getTilesForBounds(bounds)) {
    const minX = Math.max(tile.x, Math.floor(bounds.minX));
    const minY = Math.max(tile.y, Math.floor(bounds.minY));
    const maxX = Math.min(tile.x + tile.width, Math.ceil(bounds.maxX));
    const maxY = Math.min(tile.y + tile.height, Math.ceil(bounds.maxY));
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
      loaded.canvas,
      minX - source.x,
      minY - source.y,
      width,
      height,
      0,
      0,
      width,
      height
    );

    const imageData = scratchContext.getImageData(0, 0, width, height);

    blendImageDataOverTile(tile, imageData, minX - tile.x, minY - tile.y);
    tile.revision += 1;
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
