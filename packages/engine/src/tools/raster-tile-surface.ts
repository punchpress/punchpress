// @ts-nocheck TODO(typecheck-baseline): raster runtime exempt — in-flight redesign owns these files
import { incrementPerfCounter, measurePerf } from "../perf/perf-hooks";

export const RASTER_TILE_SIZE = 512;
export const RASTER_TILE_GUTTER = 2;

const createCanvas = (width, height) => {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const getTileKey = (col, row) => `${col}:${row}`;

const createFloatPixelData = (width, height) => {
  return new Float32Array(width * height * 4);
};

const getTileBounds = (bounds) => {
  const minX = Math.floor(bounds.minX);
  const minY = Math.floor(bounds.minY);
  const maxX = Math.ceil(bounds.maxX + 1);
  const maxY = Math.ceil(bounds.maxY + 1);

  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  return { maxX, maxY, minX, minY };
};

const getTileRect = (col, row, tileSize) => {
  const x = col * tileSize;
  const y = row * tileSize;

  return {
    maxX: x + tileSize,
    maxY: y + tileSize,
    minX: x,
    minY: y,
  };
};

const getSquaredDistanceToRect = (point, rect) => {
  const dx =
    point.x < rect.minX ? rect.minX - point.x : Math.max(0, point.x - rect.maxX);
  const dy =
    point.y < rect.minY ? rect.minY - point.y : Math.max(0, point.y - rect.maxY);

  return dx * dx + dy * dy;
};

const doesSegmentIntersectRect = (startPoint, endPoint, rect) => {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  let minT = 0;
  let maxT = 1;
  const edges = [
    [-dx, startPoint.x - rect.minX],
    [dx, rect.maxX - startPoint.x],
    [-dy, startPoint.y - rect.minY],
    [dy, rect.maxY - startPoint.y],
  ];

  for (const [edgeDelta, edgeDistance] of edges) {
    if (edgeDelta === 0) {
      if (edgeDistance < 0) {
        return false;
      }

      continue;
    }

    const t = edgeDistance / edgeDelta;

    if (edgeDelta < 0) {
      minT = Math.max(minT, t);
    } else {
      maxT = Math.min(maxT, t);
    }

    if (minT > maxT) {
      return false;
    }
  }

  return true;
};

const doesTileIntersectNativeStroke = ({
  endPoint,
  lineWidth,
  rect,
  startPoint,
}) => {
  const radius = lineWidth / 2 + 1;

  if (startPoint.x === endPoint.x && startPoint.y === endPoint.y) {
    return getSquaredDistanceToRect(startPoint, rect) <= radius * radius;
  }

  return doesSegmentIntersectRect(startPoint, endPoint, {
    maxX: rect.maxX + radius,
    maxY: rect.maxY + radius,
    minX: rect.minX - radius,
    minY: rect.minY - radius,
  });
};

const doesTileIntersectBounds = (tile, bounds) => {
  const x = tile.nominalX ?? tile.x;
  const y = tile.nominalY ?? tile.y;
  const width = tile.nominalWidth ?? tile.width;
  const height = tile.nominalHeight ?? tile.height;

  return !(
    x + width <= bounds.minX ||
    y + height <= bounds.minY ||
    x >= bounds.maxX ||
    y >= bounds.maxY
  );
};

export class RasterTileSurface {
  constructor({ height, tileSize = RASTER_TILE_SIZE, width }) {
    this.dirtyBounds = null;
    this.height = Math.max(1, Math.round(height));
    this.tileSize = tileSize;
    this.tiles = new Map();
    this.width = Math.max(1, Math.round(width));
  }

  getOrCreateTile(col, row) {
    const key = getTileKey(col, row);
    const existingTile = this.tiles.get(key);

    if (existingTile) {
      return existingTile;
    }

    const nominalX = col * this.tileSize;
    const nominalY = row * this.tileSize;
    const nominalWidth = this.tileSize;
    const nominalHeight = this.tileSize;
    const x = nominalX - RASTER_TILE_GUTTER;
    const y = nominalY - RASTER_TILE_GUTTER;
    const width = nominalWidth + RASTER_TILE_GUTTER * 2;
    const height = nominalHeight + RASTER_TILE_GUTTER * 2;
    const canvas = createCanvas(width, height);
    const context = canvas?.getContext("2d", { willReadFrequently: true });

    if (!(canvas && context)) {
      return null;
    }

    const tile = {
      canvas,
      col,
      context,
      floatData: null,
      height,
      nominalHeight,
      nominalWidth,
      nominalX,
      nominalY,
      row,
      width,
      x,
      y,
    };
    this.tiles.set(key, tile);
    incrementPerfCounter("brush.tile.create");
    return tile;
  }

  getTilesForBounds(bounds) {
    const clampedBounds = getTileBounds(bounds);

    if (!clampedBounds) {
      return [];
    }

    const minCol = Math.floor(clampedBounds.minX / this.tileSize);
    const maxCol = Math.floor((clampedBounds.maxX - 1) / this.tileSize);
    const minRow = Math.floor(clampedBounds.minY / this.tileSize);
    const maxRow = Math.floor((clampedBounds.maxY - 1) / this.tileSize);
    const tiles = [];

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const tile = this.getOrCreateTile(col, row);

        if (tile) {
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  getExistingTilesForBounds(bounds) {
    const clampedBounds = getTileBounds(bounds);

    if (!clampedBounds) {
      return [];
    }

    return [...this.tiles.values()].filter((tile) =>
      doesTileIntersectBounds(tile, clampedBounds)
    );
  }

  getTilesForNativeStroke({ bounds, endPoint, lineWidth, startPoint }) {
    const clampedBounds = getTileBounds(bounds);

    if (!clampedBounds) {
      return [];
    }

    const minCol = Math.floor(clampedBounds.minX / this.tileSize);
    const maxCol = Math.floor((clampedBounds.maxX - 1) / this.tileSize);
    const minRow = Math.floor(clampedBounds.minY / this.tileSize);
    const maxRow = Math.floor((clampedBounds.maxY - 1) / this.tileSize);
    const tiles = [];

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const rect = getTileRect(col, row, this.tileSize);

        if (
          !doesTileIntersectNativeStroke({
            endPoint,
            lineWidth,
            rect,
            startPoint,
          })
        ) {
          continue;
        }

        const tile = this.getOrCreateTile(col, row);

        if (tile) {
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  recordDirtyBounds(bounds) {
    const clampedBounds = getTileBounds(bounds);

    if (!clampedBounds) {
      return;
    }

    this.dirtyBounds = this.dirtyBounds
      ? {
          maxX: Math.max(this.dirtyBounds.maxX, clampedBounds.maxX),
          maxY: Math.max(this.dirtyBounds.maxY, clampedBounds.maxY),
          minX: Math.min(this.dirtyBounds.minX, clampedBounds.minX),
          minY: Math.min(this.dirtyBounds.minY, clampedBounds.minY),
        }
      : clampedBounds;
  }

  drawNativeStroke({ bounds, color, endPoint, lineWidth, startPoint }) {
    const tiles = this.getTilesForNativeStroke({
      bounds,
      endPoint,
      lineWidth,
      startPoint,
    });

    measurePerf("brush.tile.nativeStroke.draw", () => {
      for (const tile of tiles) {
        const { context } = tile;

        context.save();
        context.translate(-tile.x, -tile.y);
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
        context.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        context.strokeStyle = context.fillStyle;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = lineWidth;

        if (startPoint.x === endPoint.x && startPoint.y === endPoint.y) {
          context.beginPath();
          context.arc(endPoint.x, endPoint.y, lineWidth / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.beginPath();
          context.moveTo(startPoint.x, startPoint.y);
          context.lineTo(endPoint.x, endPoint.y);
          context.stroke();
        }

        context.restore();
      }
    });

    incrementPerfCounter("brush.tile.nativeStroke.segment");
    incrementPerfCounter("brush.tile.touched", tiles.length);
    this.recordDirtyBounds(bounds);
  }

  drawPaintDab({
    bounds,
    color,
    getCoverage,
    opacity,
    point,
  }) {
    const tiles = this.getTilesForBounds(bounds);

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

        if (!tile.floatData) {
          tile.floatData = createFloatPixelData(tile.width, tile.height);
        }

        const width = localMaxX - localMinX + 1;
        const height = localMaxY - localMinY + 1;
        const imageData = tile.context.getImageData(
          localMinX,
          localMinY,
          width,
          height
        );
        const data = imageData.data;

        for (let y = localMinY; y <= localMaxY; y += 1) {
          for (let x = localMinX; x <= localMaxX; x += 1) {
            const worldX = tile.x + x;
            const worldY = tile.y + y;
            const coverage = getCoverage(worldX + 0.5, worldY + 0.5, point);

            if (coverage <= 0) {
              continue;
            }

            const sourceAlpha = Math.min(1, Math.max(0, coverage * opacity));
            const targetOffset = (y * tile.width + x) * 4;
            const targetAlpha = tile.floatData[targetOffset + 3];
            const outputAlpha =
              sourceAlpha + targetAlpha * (1 - sourceAlpha);
            const localOffset = ((y - localMinY) * width + x - localMinX) * 4;

            if (outputAlpha <= 0) {
              tile.floatData[targetOffset] = 0;
              tile.floatData[targetOffset + 1] = 0;
              tile.floatData[targetOffset + 2] = 0;
              tile.floatData[targetOffset + 3] = 0;
              data[localOffset] = 0;
              data[localOffset + 1] = 0;
              data[localOffset + 2] = 0;
              data[localOffset + 3] = 0;
              continue;
            }

            const outputRed =
              (color.r / 255 * sourceAlpha +
                tile.floatData[targetOffset] *
                  targetAlpha *
                  (1 - sourceAlpha)) /
              outputAlpha;
            const outputGreen =
              (color.g / 255 * sourceAlpha +
                tile.floatData[targetOffset + 1] *
                  targetAlpha *
                  (1 - sourceAlpha)) /
              outputAlpha;
            const outputBlue =
              (color.b / 255 * sourceAlpha +
                tile.floatData[targetOffset + 2] *
                  targetAlpha *
                  (1 - sourceAlpha)) /
              outputAlpha;

            tile.floatData[targetOffset] = outputRed;
            tile.floatData[targetOffset + 1] = outputGreen;
            tile.floatData[targetOffset + 2] = outputBlue;
            tile.floatData[targetOffset + 3] = outputAlpha;

            data[localOffset] = Math.round(outputRed * 255);
            data[localOffset + 1] = Math.round(outputGreen * 255);
            data[localOffset + 2] = Math.round(outputBlue * 255);
            data[localOffset + 3] = Math.round(outputAlpha * 255);
          }
        }

        tile.context.putImageData(imageData, localMinX, localMinY);
      }
    });

    incrementPerfCounter("brush.tile.dab");
    incrementPerfCounter("brush.tile.touched", tiles.length);
    this.recordDirtyBounds(bounds);
  }

  createDirtyWorkingTiles() {
    if (!this.dirtyBounds) {
      return null;
    }

    return measurePerf("brush.tile.working.tiles", () => {
      incrementPerfCounter("brush.tile.working");
      return {
        bounds: this.dirtyBounds,
        tiles: this.getDirtyTiles().map((tile) => ({
          canvas: tile.canvas,
          height: tile.height,
          width: tile.width,
          x: tile.x,
          y: tile.y,
        })),
      };
    });
  }

  getDirtyTiles() {
    if (!this.dirtyBounds) {
      return [];
    }

    return this.getExistingTilesForBounds(this.dirtyBounds);
  }
}
