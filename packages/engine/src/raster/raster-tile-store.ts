import { incrementPerfCounter, measurePerf } from "../perf/perf-hooks";

export const RASTER_STORE_TILE_SIZE = 512;
export const RASTER_STORE_TILE_GUTTER = 2;
export const RASTER_PYRAMID_MAX_LEVEL = 8;

export type RasterStoreTile = {
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nominalX: number;
  nominalY: number;
  nominalWidth: number;
  nominalHeight: number;
  pixels: Uint8ClampedArray;
  floatPixels: Float32Array | null;
  merged: boolean;
  revision: number;
  /**
   * Tile-local pixel rect (exclusive max) covering writes since the last
   * consumer sync. Writers union into it alongside revision bumps; the render
   * tile-canvas cache snapshots and clears it to resync only changed pixels.
   */
  syncRect: Bounds | null;
};

type Bounds = { maxX: number; maxY: number; minX: number; minY: number };

type DabWrite = {
  bounds: Bounds;
  color?: { b: number; g: number; r: number };
  getCoverage: (x: number, y: number, point: { x: number; y: number }) => number;
  opacity: number;
  point: { x: number; y: number };
  /**
   * Marks a fully-hard, fully-opaque paint dab so the store can fill the
   * analytic circle interior with saturated pixels and run coverage math only
   * on the one-pixel antialias band. `skip` is an optional caller guarantee
   * that an identical solid dab (same color, full opacity) was already painted
   * at that circle, so pixels whose centers lie inside the skip interior
   * already hold the saturated color and can be left untouched.
   */
  solid?: { radius: number; skip?: { radius: number; x: number; y: number } };
};

const getTileKey = (col: number, row: number) => `${col}:${row}`;

const getClampedBounds = (bounds: Bounds) => {
  const minX = Math.floor(bounds.minX);
  const minY = Math.floor(bounds.minY);
  const maxX = Math.ceil(bounds.maxX + 1);
  const maxY = Math.ceil(bounds.maxY + 1);

  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  return { maxX, maxY, minX, minY };
};

const unionBounds = (current: Bounds | null, next: Bounds): Bounds =>
  current
    ? {
        maxX: Math.max(current.maxX, next.maxX),
        maxY: Math.max(current.maxY, next.maxY),
        minX: Math.min(current.minX, next.minX),
        minY: Math.min(current.minY, next.minY),
      }
    : next;

export class RasterTileStore {
  dirtyBounds: Bounds | null = null;
  dirtyLevelCoords = new Map<number, Set<string>>();
  gutter: number;
  paintedBounds: Bounds | null = null;
  revision = 0;
  tiles = new Map<string, RasterStoreTile>();
  tileSize: number;

  constructor({
    gutter = RASTER_STORE_TILE_GUTTER,
    tileSize = RASTER_STORE_TILE_SIZE,
  } = {}) {
    this.gutter = gutter;
    this.tileSize = tileSize;
  }

  get tileCount() {
    return this.tiles.size;
  }

  getTile(col: number, row: number) {
    return this.tiles.get(getTileKey(col, row)) || null;
  }

  getOrCreateTile(col: number, row: number) {
    const key = getTileKey(col, row);
    const existingTile = this.tiles.get(key);

    if (existingTile) {
      return existingTile;
    }

    const nominalX = col * this.tileSize;
    const nominalY = row * this.tileSize;
    const width = this.tileSize + this.gutter * 2;
    const height = this.tileSize + this.gutter * 2;
    const tile: RasterStoreTile = {
      col,
      floatPixels: null,
      height,
      merged: false,
      nominalHeight: this.tileSize,
      nominalWidth: this.tileSize,
      nominalX,
      nominalY,
      pixels: new Uint8ClampedArray(width * height * 4),
      revision: 0,
      row,
      syncRect: null,
      width,
      x: nominalX - this.gutter,
      y: nominalY - this.gutter,
    };
    this.tiles.set(key, tile);
    incrementPerfCounter("brush.tile.create");
    return tile;
  }

  getTilesForBounds(bounds: Bounds, { create = true } = {}) {
    const clampedBounds = getClampedBounds(bounds);

    if (!clampedBounds) {
      return [];
    }

    const minCol = Math.floor((clampedBounds.minX - this.gutter) / this.tileSize);
    const maxCol = Math.floor(
      (clampedBounds.maxX - 1 + this.gutter) / this.tileSize
    );
    const minRow = Math.floor((clampedBounds.minY - this.gutter) / this.tileSize);
    const maxRow = Math.floor(
      (clampedBounds.maxY - 1 + this.gutter) / this.tileSize
    );
    const tiles: RasterStoreTile[] = [];

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const tile = create
          ? this.getOrCreateTile(col, row)
          : this.getTile(col, row);

        if (tile) {
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  getPixelAt(x: number, y: number): [number, number, number, number] {
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);
    const tile = this.getTile(col, row);

    if (!tile) {
      return [0, 0, 0, 0];
    }

    const localX = Math.floor(x) - tile.x;
    const localY = Math.floor(y) - tile.y;
    const offset = (localY * tile.width + localX) * 4;

    return [
      tile.pixels[offset],
      tile.pixels[offset + 1],
      tile.pixels[offset + 2],
      tile.pixels[offset + 3],
    ];
  }

  paintDab(write: DabWrite) {
    this.applyDab(write, "paint");
  }

  eraseDab(write: DabWrite) {
    this.applyDab(write, "erase");
  }

  consumeDirtyBounds() {
    const dirtyBounds = this.dirtyBounds;

    this.dirtyBounds = null;
    return dirtyBounds;
  }

  markTileDirtyForPyramid(tile: { col: number; row: number }) {
    for (let level = 1; level <= RASTER_PYRAMID_MAX_LEVEL; level += 1) {
      const span = 2 ** level;
      // Math.floor, not >>: cols/rows are signed and bit shifts misbehave at
      // extreme magnitudes.
      const key = `${Math.floor(tile.col / span)}:${Math.floor(tile.row / span)}`;
      let coords = this.dirtyLevelCoords.get(level);

      if (!coords) {
        coords = new Set();
        this.dirtyLevelCoords.set(level, coords);
      }

      coords.add(key);
    }
  }

  takeDirtyLevelCoords(level: number) {
    const coords = this.dirtyLevelCoords.get(level);

    if (!coords || coords.size === 0) {
      return null;
    }

    this.dirtyLevelCoords.delete(level);
    return coords;
  }

  getPaintedBounds() {
    return this.paintedBounds;
  }

  releaseStrokeScratch() {
    for (const tile of this.tiles.values()) {
      tile.floatPixels = null;
    }
  }

  private applyDab(write: DabWrite, mode: "erase" | "paint") {
    const { bounds, color, getCoverage, opacity, point } = write;
    const tiles = this.getTilesForBounds(bounds, { create: mode === "paint" });

    if (tiles.length === 0) {
      return;
    }

    const red = (color?.r || 0) / 255;
    const green = (color?.g || 0) / 255;
    const blue = (color?.b || 0) / 255;
    const saturatedWord =
      (((255 << 24) |
        ((color?.b || 0) << 16) |
        ((color?.g || 0) << 8) |
        (color?.r || 0)) >>>
        0);

    measurePerf("brush.tile.dab.draw", () => {
      for (const tile of tiles) {
        const localMinX = Math.max(0, Math.floor(bounds.minX - tile.x));
        const localMinY = Math.max(0, Math.floor(bounds.minY - tile.y));
        const localMaxX = Math.min(
          tile.width - 1,
          Math.ceil(bounds.maxX - tile.x)
        );
        const localMaxY = Math.min(
          tile.height - 1,
          Math.ceil(bounds.maxY - tile.y)
        );

        if (localMaxX < localMinX || localMaxY < localMinY) {
          continue;
        }

        if (write.solid && mode === "paint") {
          paintSolidDabSpans({
            blue,
            green,
            localMaxX,
            localMaxY,
            localMinX,
            localMinY,
            red,
            saturatedWord,
            tile,
            write,
          });
          finishTileWrite(this, tile, localMinX, localMinY, localMaxX, localMaxY);
          continue;
        }

        if (!tile.floatPixels) {
          tile.floatPixels = createFloatPixels(tile);
        }

        const floatPixels = tile.floatPixels;
        const pixels = tile.pixels;
        const words = new Uint32Array(
          pixels.buffer,
          pixels.byteOffset,
          pixels.length / 4
        );

        for (let y = localMinY; y <= localMaxY; y += 1) {
          const rowOffset = y * tile.width;

          for (let x = localMinX; x <= localMaxX; x += 1) {
            const word = words[rowOffset + x];

            if (mode === "paint" && word === saturatedWord) {
              continue;
            }

            if (mode === "erase" && word >>> 24 === 0) {
              continue;
            }

            const offset = (rowOffset + x) * 4;
            const coverage = getCoverage(
              tile.x + x + 0.5,
              tile.y + y + 0.5,
              point
            );

            if (coverage <= 0) {
              continue;
            }

            const sourceAlpha = Math.min(1, Math.max(0, coverage * opacity));
            const targetAlpha = floatPixels[offset + 3];
            const outputAlpha =
              mode === "erase"
                ? targetAlpha * (1 - sourceAlpha)
                : sourceAlpha + targetAlpha * (1 - sourceAlpha);

            if (outputAlpha <= 0) {
              floatPixels[offset] = 0;
              floatPixels[offset + 1] = 0;
              floatPixels[offset + 2] = 0;
              floatPixels[offset + 3] = 0;
              pixels[offset] = 0;
              pixels[offset + 1] = 0;
              pixels[offset + 2] = 0;
              pixels[offset + 3] = 0;
              continue;
            }

            if (mode === "paint") {
              floatPixels[offset] =
                (red * sourceAlpha +
                  floatPixels[offset] * targetAlpha * (1 - sourceAlpha)) /
                outputAlpha;
              floatPixels[offset + 1] =
                (green * sourceAlpha +
                  floatPixels[offset + 1] * targetAlpha * (1 - sourceAlpha)) /
                outputAlpha;
              floatPixels[offset + 2] =
                (blue * sourceAlpha +
                  floatPixels[offset + 2] * targetAlpha * (1 - sourceAlpha)) /
                outputAlpha;
            }

            floatPixels[offset + 3] = outputAlpha;
            pixels[offset] = Math.round(floatPixels[offset] * 255);
            pixels[offset + 1] = Math.round(floatPixels[offset + 1] * 255);
            pixels[offset + 2] = Math.round(floatPixels[offset + 2] * 255);
            pixels[offset + 3] = Math.round(outputAlpha * 255);
          }
        }

        finishTileWrite(this, tile, localMinX, localMinY, localMaxX, localMaxY);
      }
    });

    this.revision += 1;
    incrementPerfCounter("brush.tile.dab");
    incrementPerfCounter("brush.tile.touched", tiles.length);

    const clampedBounds = getClampedBounds(bounds);

    if (clampedBounds) {
      this.dirtyBounds = unionBounds(this.dirtyBounds, clampedBounds);
      this.paintedBounds = unionBounds(this.paintedBounds, clampedBounds);
    }
  }
}

export const mergeStrokeStoreTile = ({
  anchorX = 0,
  anchorY = 0,
  mode,
  store,
  strokeTile,
}: {
  anchorX?: number;
  anchorY?: number;
  mode: "erase" | "paint";
  store: RasterTileStore;
  strokeTile: RasterStoreTile;
}) => {
  const strokeWords = new Uint32Array(
    strokeTile.pixels.buffer,
    strokeTile.pixels.byteOffset,
    strokeTile.pixels.length / 4
  );
  const tileSize = store.tileSize;
  const gutter = store.gutter;
  const nominalMinX = strokeTile.nominalX - strokeTile.x;
  const nominalMinY = strokeTile.nominalY - strokeTile.y;
  const nominalMaxX = nominalMinX + strokeTile.nominalWidth;
  const nominalMaxY = nominalMinY + strokeTile.nominalHeight;
  const touchedTiles = new Set<RasterStoreTile>();
  let cachedCol = Number.NaN;
  let cachedRow = Number.NaN;
  let cachedTile: RasterStoreTile | null = null;

  for (let y = nominalMinY; y < nominalMaxY; y += 1) {
    const rowOffset = y * strokeTile.width;

    for (let x = nominalMinX; x < nominalMaxX; x += 1) {
      const strokeAlphaByte = strokeWords[rowOffset + x] >>> 24;

      if (strokeAlphaByte === 0) {
        continue;
      }

      const strokeAlpha = strokeAlphaByte / 255;
      const strokeOffset = (rowOffset + x) * 4;
      const storeX = strokeTile.x + x - anchorX;
      const storeY = strokeTile.y + y - anchorY;
      const ownerCol = Math.floor(storeX / tileSize);
      const ownerRow = Math.floor(storeY / tileSize);
      const nearSeam =
        storeX - ownerCol * tileSize < gutter ||
        (ownerCol + 1) * tileSize - storeX <= gutter ||
        storeY - ownerRow * tileSize < gutter ||
        (ownerRow + 1) * tileSize - storeY <= gutter;

      if (nearSeam) {
        for (const targetTile of getPhysicallyContainingTiles(
          store,
          storeX,
          storeY,
          ownerCol,
          ownerRow,
          mode === "paint"
        )) {
          writeMergedPixel({
            mode,
            storeX,
            storeY,
            strokeAlpha,
            strokeOffset,
            strokeTile,
            targetTile,
          });
          touchedTiles.add(targetTile);
        }
        continue;
      }

      if (ownerCol !== cachedCol || ownerRow !== cachedRow) {
        cachedCol = ownerCol;
        cachedRow = ownerRow;
        cachedTile =
          mode === "paint"
            ? store.getOrCreateTile(ownerCol, ownerRow)
            : store.getTile(ownerCol, ownerRow);
      }

      if (!cachedTile) {
        continue;
      }

      writeMergedPixel({
        mode,
        storeX,
        storeY,
        strokeAlpha,
        strokeOffset,
        strokeTile,
        targetTile: cachedTile,
      });
      touchedTiles.add(cachedTile);
    }
  }

  const mergedStoreRect = {
    maxX: strokeTile.nominalX + strokeTile.nominalWidth - anchorX,
    maxY: strokeTile.nominalY + strokeTile.nominalHeight - anchorY,
    minX: strokeTile.nominalX - anchorX,
    minY: strokeTile.nominalY - anchorY,
  };

  for (const targetTile of touchedTiles) {
    targetTile.floatPixels = null;
    targetTile.syncRect = unionBounds(targetTile.syncRect, {
      maxX: Math.min(
        targetTile.width,
        Math.ceil(mergedStoreRect.maxX - targetTile.x)
      ),
      maxY: Math.min(
        targetTile.height,
        Math.ceil(mergedStoreRect.maxY - targetTile.y)
      ),
      minX: Math.max(0, Math.floor(mergedStoreRect.minX - targetTile.x)),
      minY: Math.max(0, Math.floor(mergedStoreRect.minY - targetTile.y)),
    });
    targetTile.revision += 1;
    store.markTileDirtyForPyramid(targetTile);
  }
};

export const commitMergedStrokeBounds = ({
  anchorX = 0,
  anchorY = 0,
  store,
  strokeBounds,
}: {
  anchorX?: number;
  anchorY?: number;
  store: RasterTileStore;
  strokeBounds: Bounds;
}) => {
  const mergedBounds = {
    maxX: strokeBounds.maxX - anchorX,
    maxY: strokeBounds.maxY - anchorY,
    minX: strokeBounds.minX - anchorX,
    minY: strokeBounds.minY - anchorY,
  };

  store.revision += 1;
  store.dirtyBounds = unionBounds(store.dirtyBounds, mergedBounds);
  store.paintedBounds = unionBounds(store.paintedBounds, mergedBounds);
  return mergedBounds;
};

export const mergeStrokeStore = ({
  anchorX = 0,
  anchorY = 0,
  mode,
  store,
  strokeStore,
}: {
  anchorX?: number;
  anchorY?: number;
  mode: "erase" | "paint";
  store: RasterTileStore;
  strokeStore: RasterTileStore;
}) => {
  const strokeBounds = strokeStore.getPaintedBounds();

  if (!strokeBounds) {
    return null;
  }

  for (const strokeTile of strokeStore.getTilesForBounds(strokeBounds, {
    create: false,
  })) {
    mergeStrokeStoreTile({ anchorX, anchorY, mode, store, strokeTile });
    strokeTile.merged = true;
  }

  return commitMergedStrokeBounds({ anchorX, anchorY, store, strokeBounds });
};

/**
 * Tiles whose physical (gutter-extended) extent contains the store pixel. In
 * create mode every container materializes, not just the nominal owner:
 * merge order is row-major, so a seam pixel can need a neighbor tile that no
 * earlier stroke tile has created yet, and skipping the write would leave
 * that tile's gutter blank while its owner holds paint.
 */
const getPhysicallyContainingTiles = (
  store: RasterTileStore,
  storeX: number,
  storeY: number,
  ownerCol: number,
  ownerRow: number,
  create: boolean
) => {
  const cols = [ownerCol];
  const rows = [ownerRow];

  if (storeX - ownerCol * store.tileSize < store.gutter) {
    cols.push(ownerCol - 1);
  }

  if ((ownerCol + 1) * store.tileSize - storeX <= store.gutter) {
    cols.push(ownerCol + 1);
  }

  if (storeY - ownerRow * store.tileSize < store.gutter) {
    rows.push(ownerRow - 1);
  }

  if ((ownerRow + 1) * store.tileSize - storeY <= store.gutter) {
    rows.push(ownerRow + 1);
  }

  const tiles: RasterStoreTile[] = [];

  for (const col of cols) {
    for (const row of rows) {
      const tile = create
        ? store.getOrCreateTile(col, row)
        : store.getTile(col, row);

      if (tile) {
        tiles.push(tile);
      }
    }
  }

  return tiles;
};

const writeMergedPixel = ({
  mode,
  storeX,
  storeY,
  strokeAlpha,
  strokeOffset,
  strokeTile,
  targetTile,
}) => {
  const localX = storeX - targetTile.x;
  const localY = storeY - targetTile.y;

  if (
    localX < 0 ||
    localY < 0 ||
    localX >= targetTile.width ||
    localY >= targetTile.height
  ) {
    return;
  }

  const targetOffset = (localY * targetTile.width + localX) * 4;
  const targetAlpha = targetTile.pixels[targetOffset + 3] / 255;

  if (mode === "erase") {
    targetTile.pixels[targetOffset + 3] = Math.round(
      targetAlpha * (1 - strokeAlpha) * 255
    );
    return;
  }

  if (strokeAlpha >= 1) {
    targetTile.pixels[targetOffset] = strokeTile.pixels[strokeOffset];
    targetTile.pixels[targetOffset + 1] = strokeTile.pixels[strokeOffset + 1];
    targetTile.pixels[targetOffset + 2] = strokeTile.pixels[strokeOffset + 2];
    targetTile.pixels[targetOffset + 3] = 255;
    return;
  }

  const outputAlpha = strokeAlpha + targetAlpha * (1 - strokeAlpha);

  if (outputAlpha <= 0) {
    return;
  }

  for (let channel = 0; channel < 3; channel += 1) {
    const strokeChannel = strokeTile.pixels[strokeOffset + channel] / 255;
    const targetChannel = targetTile.pixels[targetOffset + channel] / 255;

    targetTile.pixels[targetOffset + channel] = Math.round(
      ((strokeChannel * strokeAlpha +
        targetChannel * targetAlpha * (1 - strokeAlpha)) /
        outputAlpha) *
        255
    );
  }

  targetTile.pixels[targetOffset + 3] = Math.round(outputAlpha * 255);
};

const finishTileWrite = (
  store: RasterTileStore,
  tile: RasterStoreTile,
  localMinX: number,
  localMinY: number,
  localMaxX: number,
  localMaxY: number
) => {
  tile.syncRect = unionBounds(tile.syncRect, {
    maxX: localMaxX + 1,
    maxY: localMaxY + 1,
    minX: localMinX,
    minY: localMinY,
  });
  tile.revision += 1;
  store.markTileDirtyForPyramid(tile);
};

/**
 * Fast path for fully-hard, fully-opaque paint dabs. Each row is bounded by
 * the outer (antialias) circle, the interior span is computed analytically
 * and filled with the saturated RGBA word, and only the one-pixel antialias
 * band at span ends and circle caps runs the coverage path, so stroke edges
 * stay antialiased. When the caller passes a `skip` circle (the previous
 * identical solid dab), interior pixels inside that circle are not rewritten,
 * so heavily overlapping stroke dabs only pay for their new crescent.
 * Interior writes update the float scratch only when it already exists;
 * otherwise float buffers stay lazy and re-seed from bytes on the next soft
 * dab.
 */
const paintSolidDabSpans = ({
  blue,
  green,
  localMaxX,
  localMaxY,
  localMinX,
  localMinY,
  red,
  saturatedWord,
  tile,
  write,
}: {
  blue: number;
  green: number;
  localMaxX: number;
  localMaxY: number;
  localMinX: number;
  localMinY: number;
  red: number;
  saturatedWord: number;
  tile: RasterStoreTile;
  write: DabWrite;
}) => {
  const { getCoverage, opacity, point } = write;
  const radius = write.solid?.radius || 0;
  const skip = write.solid?.skip || null;
  const interiorRadius = radius - 0.5;
  const interiorRadiusSquared = interiorRadius * interiorRadius;
  const outerRadius = radius + 0.5;
  const outerRadiusSquared = outerRadius * outerRadius;
  const skipRadiusSquared = skip
    ? (skip.radius - 0.5) * (skip.radius - 0.5)
    : 0;
  const floatPixels = tile.floatPixels;
  const pixels = tile.pixels;
  const words = new Uint32Array(
    pixels.buffer,
    pixels.byteOffset,
    pixels.length / 4
  );
  const localCenterX = point.x - tile.x;

  const blendEdgePixel = (x: number, y: number, rowOffset: number) => {
    if (words[rowOffset + x] === saturatedWord) {
      return;
    }

    const coverage = getCoverage(tile.x + x + 0.5, tile.y + y + 0.5, point);

    if (coverage <= 0) {
      return;
    }

    const sourceAlpha = Math.min(1, Math.max(0, coverage * opacity));
    const offset = (rowOffset + x) * 4;

    if (floatPixels) {
      const targetAlpha = floatPixels[offset + 3];
      const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

      floatPixels[offset] =
        (red * sourceAlpha +
          floatPixels[offset] * targetAlpha * (1 - sourceAlpha)) /
        outputAlpha;
      floatPixels[offset + 1] =
        (green * sourceAlpha +
          floatPixels[offset + 1] * targetAlpha * (1 - sourceAlpha)) /
        outputAlpha;
      floatPixels[offset + 2] =
        (blue * sourceAlpha +
          floatPixels[offset + 2] * targetAlpha * (1 - sourceAlpha)) /
        outputAlpha;
      floatPixels[offset + 3] = outputAlpha;
      pixels[offset] = Math.round(floatPixels[offset] * 255);
      pixels[offset + 1] = Math.round(floatPixels[offset + 1] * 255);
      pixels[offset + 2] = Math.round(floatPixels[offset + 2] * 255);
      pixels[offset + 3] = Math.round(outputAlpha * 255);
      return;
    }

    const targetAlpha = pixels[offset + 3] / 255;
    const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
    const targetWeight = (targetAlpha * (1 - sourceAlpha)) / outputAlpha;
    const sourceWeight = sourceAlpha / outputAlpha;

    pixels[offset] = Math.round(
      (red * sourceWeight + (pixels[offset] / 255) * targetWeight) * 255
    );
    pixels[offset + 1] = Math.round(
      (green * sourceWeight + (pixels[offset + 1] / 255) * targetWeight) * 255
    );
    pixels[offset + 2] = Math.round(
      (blue * sourceWeight + (pixels[offset + 2] / 255) * targetWeight) * 255
    );
    pixels[offset + 3] = Math.round(outputAlpha * 255);
  };

  const fillSpan = (rowOffset: number, fromX: number, toX: number) => {
    for (let x = fromX; x <= toX; x += 1) {
      words[rowOffset + x] = saturatedWord;

      if (floatPixels) {
        const offset = (rowOffset + x) * 4;

        floatPixels[offset] = red;
        floatPixels[offset + 1] = green;
        floatPixels[offset + 2] = blue;
        floatPixels[offset + 3] = 1;
      }
    }
  };

  for (let y = localMinY; y <= localMaxY; y += 1) {
    const dy = tile.y + y + 0.5 - point.y;
    const outerHalfWidthSquared = outerRadiusSquared - dy * dy;

    if (outerHalfWidthSquared <= 0) {
      continue;
    }

    const rowOffset = y * tile.width;
    const outerHalfWidth = Math.sqrt(outerHalfWidthSquared);
    const rowMinX = Math.max(
      localMinX,
      Math.ceil(localCenterX - outerHalfWidth - 0.5)
    );
    const rowMaxX = Math.min(
      localMaxX,
      Math.floor(localCenterX + outerHalfWidth - 0.5)
    );

    if (rowMinX > rowMaxX) {
      continue;
    }

    const interiorHalfWidthSquared = interiorRadiusSquared - dy * dy;
    let spanMinX = rowMaxX + 1;
    let spanMaxX = rowMinX - 1;

    if (interiorHalfWidthSquared > 0) {
      const halfWidth = Math.sqrt(interiorHalfWidthSquared);

      spanMinX = Math.max(rowMinX, Math.ceil(localCenterX - halfWidth - 0.5));
      spanMaxX = Math.min(rowMaxX, Math.floor(localCenterX + halfWidth - 0.5));
    }

    const leftEdgeMaxX = Math.min(spanMinX - 1, rowMaxX);

    for (let x = rowMinX; x <= leftEdgeMaxX; x += 1) {
      blendEdgePixel(x, y, rowOffset);
    }

    if (spanMinX <= spanMaxX) {
      // Subtract the skip circle's interior span (computed with the same
      // formula the previous dab used to fill it) from this row's span.
      let skipMinX = spanMaxX + 1;
      let skipMaxX = spanMaxX;

      if (skip) {
        const skipDy = tile.y + y + 0.5 - skip.y;
        const skipHalfWidthSquared = skipRadiusSquared - skipDy * skipDy;

        if (skipHalfWidthSquared > 0) {
          const skipHalfWidth = Math.sqrt(skipHalfWidthSquared);
          const localSkipCenterX = skip.x - tile.x;

          skipMinX = Math.ceil(localSkipCenterX - skipHalfWidth - 0.5);
          skipMaxX = Math.floor(localSkipCenterX + skipHalfWidth - 0.5);

          if (skipMaxX < skipMinX - 1) {
            skipMaxX = skipMinX - 1;
          }
        }
      }

      fillSpan(rowOffset, spanMinX, Math.min(spanMaxX, skipMinX - 1));
      fillSpan(rowOffset, Math.max(spanMinX, skipMaxX + 1), spanMaxX);
    }

    const rightEdgeMinX = Math.max(spanMaxX + 1, spanMinX);

    for (let x = rightEdgeMinX; x <= rowMaxX; x += 1) {
      blendEdgePixel(x, y, rowOffset);
    }
  }
};

const createFloatPixels = (tile: RasterStoreTile) => {
  const floatPixels = new Float32Array(tile.width * tile.height * 4);

  for (let offset = 0; offset < tile.pixels.length; offset += 4) {
    const alphaByte = tile.pixels[offset + 3];

    if (alphaByte === 0) {
      continue;
    }

    floatPixels[offset] = tile.pixels[offset] / 255;
    floatPixels[offset + 1] = tile.pixels[offset + 1] / 255;
    floatPixels[offset + 2] = tile.pixels[offset + 2] / 255;
    floatPixels[offset + 3] = alphaByte / 255;
  }

  return floatPixels;
};
