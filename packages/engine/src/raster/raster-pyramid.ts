import { createCanvas } from "../tools/brush-runtime";
import {
  RASTER_PYRAMID_MAX_LEVEL,
  type RasterStoreTile,
  type RasterTileStore,
} from "./raster-tile-store";

export { RASTER_PYRAMID_MAX_LEVEL };

type PyramidTile = {
  canvas: HTMLCanvasElement | null;
  stale: boolean;
};

/**
 * Display pyramid level for a compositor scale (canvas pixels per store
 * pixel). Level L decimates by 2^L, so we pick the level whose texel is the
 * last one at or above one canvas pixel: level = floor(log2(1 / scale)).
 * Boundaries land on the coarser level (scale 0.5 -> 1, 0.25 -> 2); anything
 * above 0.5 stays at level 0. Clamped to [0, RASTER_PYRAMID_MAX_LEVEL];
 * non-positive scales report the max level.
 */
export const getRasterPyramidLevelForScale = (scale: number) => {
  if (!(Number.isFinite(scale) && scale > 0)) {
    return RASTER_PYRAMID_MAX_LEVEL;
  }

  const level = Math.floor(Math.log2(1 / scale));

  return Math.min(RASTER_PYRAMID_MAX_LEVEL, Math.max(0, level));
};

let scratchCanvas: HTMLCanvasElement | null = null;
let scratchContext: CanvasRenderingContext2D | null = null;

const getStoreTileScratch = (tile: RasterStoreTile) => {
  if (!scratchContext) {
    scratchCanvas = createCanvas(tile.width, tile.height);
    scratchContext = scratchCanvas?.getContext("2d") || null;

    if (!(scratchCanvas && scratchContext)) {
      return null;
    }
  }

  if (
    scratchCanvas.width !== tile.width ||
    scratchCanvas.height !== tile.height
  ) {
    scratchCanvas.width = tile.width;
    scratchCanvas.height = tile.height;
  }

  scratchContext.putImageData(
    new ImageData(tile.pixels, tile.width, tile.height),
    0,
    0
  );
  return scratchCanvas;
};

/**
 * Lazily built mipmap levels over a store's committed tiles. A level-L tile
 * is a tileSize-square canvas covering the store rect
 * [col * tileSize * 2^L, row * tileSize * 2^L] + tileSize * 2^L, downscaled
 * 2:1 from its four children (level L-1 pyramid tiles, or the level-0 store
 * tiles for L = 1). Tiles build on first request and rebuild after the
 * owning store reports their coords dirty via beginFrame().
 */
export class RasterTilePyramid {
  private levels = new Map<number, Map<string, PyramidTile>>();
  private store: RasterTileStore;

  constructor(store: RasterTileStore) {
    this.store = store;
  }

  /** Instance seam so compositors reach level selection without an import. */
  getLevelForScale(scale: number) {
    return getRasterPyramidLevelForScale(scale);
  }

  /**
   * Drain the store's per-level dirty coords and mark matching cached tiles
   * stale. Call once per repaint before any getTile calls.
   */
  beginFrame() {
    for (let level = 1; level <= RASTER_PYRAMID_MAX_LEVEL; level += 1) {
      const dirtyCoords = this.store.takeDirtyLevelCoords(level);

      if (!dirtyCoords) {
        continue;
      }

      const cache = this.levels.get(level);

      if (!cache) {
        continue;
      }

      for (const key of dirtyCoords) {
        const tile = cache.get(key);

        if (tile) {
          tile.stale = true;
        }
      }
    }
  }

  getTile(level: number, col: number, row: number): { canvas: HTMLCanvasElement } | null {
    if (level < 1 || level > RASTER_PYRAMID_MAX_LEVEL) {
      return null;
    }

    let cache = this.levels.get(level);

    if (!cache) {
      cache = new Map();
      this.levels.set(level, cache);
    }

    const key = `${col}:${row}`;
    let tile = cache.get(key);

    if (!tile || tile.stale) {
      tile = this.buildTile(level, col, row, tile?.canvas || null);
      cache.set(key, tile);
    }

    return tile.canvas ? { canvas: tile.canvas } : null;
  }

  private buildTile(
    level: number,
    col: number,
    row: number,
    reusableCanvas: HTMLCanvasElement | null
  ): PyramidTile {
    const tileSize = this.store.tileSize;
    const half = tileSize / 2;
    let canvas = reusableCanvas;
    let context: CanvasRenderingContext2D | null = null;

    if (canvas) {
      context = canvas.getContext("2d");
      context?.clearRect(0, 0, tileSize, tileSize);
    }

    let hasContent = false;

    for (let quadrantRow = 0; quadrantRow < 2; quadrantRow += 1) {
      for (let quadrantCol = 0; quadrantCol < 2; quadrantCol += 1) {
        const childCol = col * 2 + quadrantCol;
        const childRow = row * 2 + quadrantRow;
        const source =
          level === 1
            ? this.getStoreTileSource(childCol, childRow)
            : this.getChildTileSource(level - 1, childCol, childRow);

        if (!source) {
          continue;
        }

        if (!context) {
          canvas = canvas || createCanvas(tileSize, tileSize);
          context = canvas?.getContext("2d") || null;

          if (!context) {
            return { canvas: null, stale: false };
          }

          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
        }

        context.drawImage(
          source.canvas,
          source.sourceX,
          source.sourceY,
          tileSize,
          tileSize,
          quadrantCol * half,
          quadrantRow * half,
          half,
          half
        );
        hasContent = true;
      }
    }

    return { canvas: hasContent ? canvas : null, stale: false };
  }

  private getChildTileSource(level: number, col: number, row: number) {
    const child = this.getTile(level, col, row);

    return child ? { canvas: child.canvas, sourceX: 0, sourceY: 0 } : null;
  }

  private getStoreTileSource(col: number, row: number) {
    const storeTile = this.store.getTile(col, row);

    if (!storeTile) {
      return null;
    }

    const scratch = getStoreTileScratch(storeTile);

    if (!scratch) {
      return null;
    }

    // Source rect covers the nominal region only; gutters stay out of the
    // pyramid so level tiles abut exactly.
    return {
      canvas: scratch,
      sourceX: this.store.gutter,
      sourceY: this.store.gutter,
    };
  }
}
