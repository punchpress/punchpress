interface TileCanvasEntry {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  imageData: ImageData;
  revision: number;
}

const tileCanvasCache = new WeakMap<object, TileCanvasEntry>();

/**
 * Canvas snapshot of a store tile's pixels, cached per tile by revision.
 * This cache is the sole consumer of the store's per-tile sync rect:
 * snapshot it, clear it, and resync only the changed pixels. A missing rect
 * on a changed revision falls back to a full-tile resync.
 */
export const getTileCanvas = (tile) => {
  let entry = tileCanvasCache.get(tile);

  if (entry && entry.revision === tile.revision) {
    return entry.canvas;
  }

  const syncRect = tile.syncRect;

  tile.syncRect = null;

  if (!entry) {
    const canvas = document.createElement("canvas");

    canvas.width = tile.width;
    canvas.height = tile.height;

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    entry = {
      canvas,
      context,
      imageData: new ImageData(tile.pixels, tile.width, tile.height),
      revision: -1,
    };
    tileCanvasCache.set(tile, entry);
    entry.context.putImageData(entry.imageData, 0, 0);
    entry.revision = tile.revision;
    return entry.canvas;
  }

  const rect = syncRect
    ? {
        height:
          Math.min(tile.height, syncRect.maxY) - Math.max(0, syncRect.minY),
        width: Math.min(tile.width, syncRect.maxX) - Math.max(0, syncRect.minX),
        x: Math.max(0, syncRect.minX),
        y: Math.max(0, syncRect.minY),
      }
    : null;

  if (rect && rect.width > 0 && rect.height > 0) {
    entry.context.putImageData(
      entry.imageData,
      0,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
  } else {
    entry.context.putImageData(entry.imageData, 0, 0);
  }

  entry.revision = tile.revision;
  return entry.canvas;
};
