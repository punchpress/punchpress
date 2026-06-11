import { incrementPerfCounter, measurePerf } from "../perf/perf-hooks";

export const RASTER_STORE_TILE_SIZE = 512;
export const RASTER_STORE_TILE_GUTTER = 2;

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
  revision: number;
};

type Bounds = { maxX: number; maxY: number; minX: number; minY: number };

type DabWrite = {
  bounds: Bounds;
  color?: { b: number; g: number; r: number };
  getCoverage: (x: number, y: number, point: { x: number; y: number }) => number;
  opacity: number;
  point: { x: number; y: number };
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
      nominalHeight: this.tileSize,
      nominalWidth: this.tileSize,
      nominalX,
      nominalY,
      pixels: new Uint8ClampedArray(width * height * 4),
      revision: 0,
      row,
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

        if (!tile.floatPixels) {
          tile.floatPixels = createFloatPixels(tile);
        }

        const floatPixels = tile.floatPixels;
        const pixels = tile.pixels;

        for (let y = localMinY; y <= localMaxY; y += 1) {
          for (let x = localMinX; x <= localMaxX; x += 1) {
            const coverage = getCoverage(
              tile.x + x + 0.5,
              tile.y + y + 0.5,
              point
            );

            if (coverage <= 0) {
              continue;
            }

            const sourceAlpha = Math.min(1, Math.max(0, coverage * opacity));
            const offset = (y * tile.width + x) * 4;
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

        tile.revision += 1;
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
