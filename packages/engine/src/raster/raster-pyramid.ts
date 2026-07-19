import { createCanvas, getNow } from "../tools/brush-runtime";
import {
  RASTER_PYRAMID_MAX_LEVEL,
  type RasterStoreTile,
  type RasterTileStore,
} from "./raster-tile-store";

/**
 * Sync rebuild budget per draw pass. A whole-layer merge dirties every
 * visible level tile at once, and rebuilding them all in one compositor
 * draw was a multi-second frame; past the budget, stale tiles draw their
 * previous canvas (stale zoomed-out content beats a hitch) and refine over
 * the following frames.
 */
const PYRAMID_REBUILD_BUDGET_MS = 6;

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
  private rebuildDeadline = Number.POSITIVE_INFINITY;
  private allowBlankDeferral = false;
  private deferredCount = 0;
  private deferredRebuilds = false;

  constructor(store: RasterTileStore) {
    this.store = store;
  }

  /**
   * True when the last draw pass ran out of rebuild budget and served stale
   * canvases. The caller schedules another repaint so the remaining tiles
   * refine.
   */
  hasDeferredRebuilds() {
    return this.deferredRebuilds;
  }

  /** Instance seam so compositors reach level selection without an import. */
  getLevelForScale(scale: number) {
    return getRasterPyramidLevelForScale(scale);
  }

  /**
   * Drain the store's per-level dirty coords and mark matching cached tiles
   * stale. Call once per repaint before any getTile calls.
   * `allowBlankDeferral` lets even first builds (no previous canvas) defer
   * past the budget — safe only while another layer covers the blanks (the
   * committed-DOM fallback during initial hydration).
   */
  beginFrame({ allowBlankDeferral = false } = {}) {
    this.rebuildDeadline = getNow() + PYRAMID_REBUILD_BUDGET_MS;
    this.allowBlankDeferral = allowBlankDeferral;
    this.deferredRebuilds = false;

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
      // Over the per-draw rebuild budget, a stale tile keeps serving its
      // previous canvas; a missing tile must build regardless (blank
      // flashes are a bug) unless the caller declared blanks covered.
      if (
        getNow() >= this.rebuildDeadline &&
        (tile?.canvas || this.allowBlankDeferral)
      ) {
        this.deferredRebuilds = true;
        this.deferredCount += 1;
        return tile?.canvas ? { canvas: tile.canvas } : null;
      }

      tile = this.buildTile(level, col, row, tile || null);
      cache.set(key, tile);
    }

    return tile.canvas ? { canvas: tile.canvas } : null;
  }

  /**
   * Cached tile canvas without building or rebuilding. The compositor's
   * hollow-tile fallback reads through this: stale zoomed-out content beats
   * a blank flash while a rehydration is in flight.
   */
  peekTile(level: number, col: number, row: number) {
    const tile = this.levels.get(level)?.get(`${col}:${row}`);

    return tile?.canvas ? { canvas: tile.canvas } : null;
  }

  /**
   * Build a store tile's level-1 ancestor while the tile's pixels are still
   * resident — called immediately before eviction so zoomed-out rendering
   * keeps coverage once the tile goes hollow. Drains pending dirty coords
   * first so the ancestor reflects the latest writes.
   */
  ensureBaseAncestor(col: number, row: number) {
    this.beginFrame();
    this.getTile(1, Math.floor(col / 2), Math.floor(row / 2));
  }

  private buildTile(
    level: number,
    col: number,
    row: number,
    previousTile: PyramidTile | null
  ): PyramidTile {
    const tileSize = this.store.tileSize;
    const half = tileSize / 2;
    const deferredCountBefore = this.deferredCount;
    let canvas = previousTile?.canvas || null;
    let context: CanvasRenderingContext2D | null =
      canvas?.getContext("2d") || null;
    let hasContent = false;
    let lostHollowContent = false;
    const ensureContext = () => {
      if (!context) {
        canvas = canvas || createCanvas(tileSize, tileSize);
        context = canvas?.getContext("2d") || null;

        if (context) {
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
        }
      }

      return context;
    };

    for (let quadrantRow = 0; quadrantRow < 2; quadrantRow += 1) {
      for (let quadrantCol = 0; quadrantCol < 2; quadrantCol += 1) {
        const childCol = col * 2 + quadrantCol;
        const childRow = row * 2 + quadrantRow;

        // A hollow child's pixels are not resident: keep the previous
        // canvas's quadrant (its content is still valid — eviction does not
        // change committed content, and eviction pre-builds this ancestor).
        // A hollow-from-birth child (initial hydration worklist) simply has
        // no content yet; its hydration marks pyramid dirt, which re-marks
        // this tile stale then. Only an EVICTED child with no previous
        // canvas needs an on-demand rehydration and a stale retry — its
        // byte-exact restore intentionally skips pyramid dirt.
        if (level === 1 && this.store.isHollow(childCol, childRow)) {
          if (previousTile?.canvas) {
            hasContent = true;
          } else if (this.store.getHollowTile(childCol, childRow)?.evicted) {
            lostHollowContent = true;
            this.store.onHollowTileNeeded?.(childCol, childRow);
          }

          continue;
        }

        const source =
          level === 1
            ? this.getStoreTileSource(childCol, childRow)
            : this.getChildTileSource(level - 1, childCol, childRow);

        if (!source) {
          context?.clearRect(quadrantCol * half, quadrantRow * half, half, half);
          continue;
        }

        const targetContext = ensureContext();

        if (!targetContext) {
          return { canvas: null, stale: false };
        }

        targetContext.clearRect(
          quadrantCol * half,
          quadrantRow * half,
          half,
          half
        );
        targetContext.drawImage(
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

    return {
      canvas: hasContent ? canvas : null,
      // A build fed by a deferred (stale) child must itself stay stale so
      // it rebuilds once the child refines.
      stale: lostHollowContent || this.deferredCount > deferredCountBefore,
    };
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
