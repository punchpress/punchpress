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

const createFloatPixelData = (context, width, height) => {
  const imageData = context.getImageData(0, 0, width, height);
  const floatData = new Float32Array(width * height * 4);

  for (let index = 0; index < imageData.data.length; index += 1) {
    floatData[index] = imageData.data[index] / 255;
  }

  return floatData;
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

const isPointInsidePolygon = (point, polygon) => {
  if (!polygon?.length) {
    return true;
  }

  let inside = false;

  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
};

const getAxisAlignedPolygonBounds = (polygon) => {
  if (!polygon?.length) {
    return null;
  }

  const bounds = {
    maxX: Math.max(...polygon.map((point) => point.x)),
    maxY: Math.max(...polygon.map((point) => point.y)),
    minX: Math.min(...polygon.map((point) => point.x)),
    minY: Math.min(...polygon.map((point) => point.y)),
  };
  const isAxisAligned = polygon.every(
    (point) =>
      (point.x === bounds.minX || point.x === bounds.maxX) &&
      (point.y === bounds.minY || point.y === bounds.maxY)
  );

  return isAxisAligned ? bounds : null;
};

const isPointInsideWritableArea = (point, polygon, axisAlignedBounds) => {
  if (axisAlignedBounds) {
    return (
      point.x >= axisAlignedBounds.minX &&
      point.x < axisAlignedBounds.maxX &&
      point.y >= axisAlignedBounds.minY &&
      point.y < axisAlignedBounds.maxY
    );
  }

  return isPointInsidePolygon(point, polygon);
};

const getSquaredDistanceToRect = (point, rect) => {
  const dx =
    point.x < rect.minX
      ? rect.minX - point.x
      : Math.max(0, point.x - rect.maxX);
  const dy =
    point.y < rect.minY
      ? rect.minY - point.y
      : Math.max(0, point.y - rect.maxY);

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
    const sourceListeners = new Set();

    tile.notifySourceChanged = () => {
      for (const listener of sourceListeners) {
        listener();
      }
    };
    tile.subscribeToSource = (listener) => {
      sourceListeners.add(listener);
      return () => sourceListeners.delete(listener);
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

  drawNativeStroke({
    bounds,
    color,
    endPoint,
    lineWidth,
    startPoint,
    writablePolygon,
  }) {
    this.drawNativePath({
      color,
      lineWidth,
      points: [startPoint, endPoint],
      writablePolygon,
    });
    this.recordDirtyBounds(bounds);
  }

  drawNativePath({ color, lineWidth, points, writablePolygon }) {
    if (!points.length) {
      return;
    }

    const radius = lineWidth / 2 + 1;
    const tiles = new Set();

    if (points.length === 1) {
      const [point] = points;

      for (const tile of this.getTilesForNativeStroke({
        bounds: {
          maxX: point.x + radius,
          maxY: point.y + radius,
          minX: point.x - radius,
          minY: point.y - radius,
        },
        endPoint: point,
        lineWidth,
        startPoint: point,
      })) {
        tiles.add(tile);
      }
    } else {
      for (let index = 1; index < points.length; index += 1) {
        const startPoint = points[index - 1];
        const endPoint = points[index];

        for (const tile of this.getTilesForNativeStroke({
          bounds: {
            maxX: Math.max(startPoint.x, endPoint.x) + radius,
            maxY: Math.max(startPoint.y, endPoint.y) + radius,
            minX: Math.min(startPoint.x, endPoint.x) - radius,
            minY: Math.min(startPoint.y, endPoint.y) - radius,
          },
          endPoint,
          lineWidth,
          startPoint,
        })) {
          tiles.add(tile);
        }
      }
    }

    measurePerf("brush.tile.nativePath.draw", () => {
      for (const tile of tiles) {
        const { context } = tile;

        context.save();
        context.translate(-tile.x, -tile.y);
        if (writablePolygon?.length) {
          context.beginPath();
          context.moveTo(writablePolygon[0].x, writablePolygon[0].y);
          for (const point of writablePolygon.slice(1)) {
            context.lineTo(point.x, point.y);
          }
          context.closePath();
          context.clip();
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
        context.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        context.strokeStyle = context.fillStyle;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = lineWidth;

        if (points.length === 1) {
          const [point] = points;

          context.beginPath();
          context.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.beginPath();
          context.moveTo(points[0].x, points[0].y);
          for (const point of points.slice(1)) {
            context.lineTo(point.x, point.y);
          }
          context.stroke();
        }

        context.restore();
        tile.floatData = null;
        tile.notifySourceChanged();
      }
    });

    incrementPerfCounter(
      "brush.tile.nativeStroke.segment",
      Math.max(1, points.length - 1)
    );
    incrementPerfCounter("brush.tile.touched", tiles.length);
    this.recordDirtyBounds({
      maxX: Math.max(...points.map((point) => point.x)) + radius,
      maxY: Math.max(...points.map((point) => point.y)) + radius,
      minX: Math.min(...points.map((point) => point.x)) - radius,
      minY: Math.min(...points.map((point) => point.y)) - radius,
    });
  }

  drawHardRoundDabs({ color, dabs, writablePolygon }) {
    const dabsByTile = new Map();
    const writableBounds = getAxisAlignedPolygonBounds(writablePolygon);
    let touchedTileCount = 0;

    for (const dab of dabs) {
      const radius = dab.size / 2 + 0.5;
      const bounds = {
        maxX: Math.ceil(dab.center.x + radius),
        maxY: Math.ceil(dab.center.y + radius),
        minX: Math.floor(dab.center.x - radius),
        minY: Math.floor(dab.center.y - radius),
      };
      const tiles = this.getTilesForBounds(bounds);

      touchedTileCount += tiles.length;
      this.recordDirtyBounds(bounds);

      for (const tile of tiles) {
        const localBounds = {
          maxX: Math.min(tile.width - 1, Math.ceil(bounds.maxX - tile.x)),
          maxY: Math.min(tile.height - 1, Math.ceil(bounds.maxY - tile.y)),
          minX: Math.max(0, Math.floor(bounds.minX - tile.x)),
          minY: Math.max(0, Math.floor(bounds.minY - tile.y)),
        };
        const entry = dabsByTile.get(tile);

        if (entry) {
          entry.dabs.push(dab);
          entry.maxX = Math.max(entry.maxX, localBounds.maxX);
          entry.maxY = Math.max(entry.maxY, localBounds.maxY);
          entry.minX = Math.min(entry.minX, localBounds.minX);
          entry.minY = Math.min(entry.minY, localBounds.minY);
        } else {
          dabsByTile.set(tile, {
            dabs: [dab],
            ...localBounds,
          });
        }
      }
    }

    measurePerf("brush.tile.hardRoundDabs.draw", () => {
      for (const [tile, entry] of dabsByTile) {
        const { context } = tile;
        const width = entry.maxX - entry.minX + 1;
        const height = entry.maxY - entry.minY + 1;

        if (width <= 0 || height <= 0) {
          continue;
        }

        if (!tile.floatData) {
          tile.floatData = createFloatPixelData(
            context,
            tile.width,
            tile.height
          );
        }

        const imageData = context.getImageData(
          entry.minX,
          entry.minY,
          width,
          height
        );
        const data = imageData.data;

        for (const dab of entry.dabs) {
          const radius = dab.size / 2;
          const fullCoverageRadiusSquared = Math.max(0, radius - 0.5) ** 2;
          const outerRadiusSquared = (radius + 0.5) ** 2;
          const minX = Math.max(
            entry.minX,
            Math.floor(dab.center.x - radius - 0.5 - tile.x)
          );
          const minY = Math.max(
            entry.minY,
            Math.floor(dab.center.y - radius - 0.5 - tile.y)
          );
          const maxX = Math.min(
            entry.maxX,
            Math.ceil(dab.center.x + radius + 0.5 - tile.x)
          );
          const maxY = Math.min(
            entry.maxY,
            Math.ceil(dab.center.y + radius + 0.5 - tile.y)
          );

          for (let y = minY; y <= maxY; y += 1) {
            for (let x = minX; x <= maxX; x += 1) {
              const targetOffset = (y * tile.width + x) * 4;
              const targetAlpha = tile.floatData[targetOffset + 3];

              if (targetAlpha >= 1) {
                continue;
              }

              const worldX = tile.x + x + 0.5;
              const worldY = tile.y + y + 0.5;

              if (
                !isPointInsideWritableArea(
                  { x: worldX, y: worldY },
                  writablePolygon,
                  writableBounds
                )
              ) {
                continue;
              }

              const deltaX = worldX - dab.center.x;
              const deltaY = worldY - dab.center.y;
              const distanceSquared = deltaX * deltaX + deltaY * deltaY;

              if (distanceSquared >= outerRadiusSquared) {
                continue;
              }

              const sourceAlpha =
                distanceSquared <= fullCoverageRadiusSquared
                  ? 1
                  : radius + 0.5 - Math.sqrt(distanceSquared);

              if (sourceAlpha <= 0) {
                continue;
              }

              const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
              const localOffset =
                ((y - entry.minY) * width + x - entry.minX) * 4;

              tile.floatData[targetOffset] = color.r / 255;
              tile.floatData[targetOffset + 1] = color.g / 255;
              tile.floatData[targetOffset + 2] = color.b / 255;
              tile.floatData[targetOffset + 3] = outputAlpha;
              data[localOffset] = color.r;
              data[localOffset + 1] = color.g;
              data[localOffset + 2] = color.b;
              data[localOffset + 3] = Math.round(outputAlpha * 255);
            }
          }
        }

        context.putImageData(imageData, entry.minX, entry.minY);
        tile.notifySourceChanged();
      }
    });

    incrementPerfCounter("brush.tile.hardRoundDab", dabs.length);
    incrementPerfCounter("brush.tile.touched", touchedTileCount);
  }

  drawPaintDab({ bounds, color, getCoverage, opacity, point }) {
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
          tile.floatData = createFloatPixelData(
            tile.context,
            tile.width,
            tile.height
          );
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
            const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
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
              ((color.r / 255) * sourceAlpha +
                tile.floatData[targetOffset] *
                  targetAlpha *
                  (1 - sourceAlpha)) /
              outputAlpha;
            const outputGreen =
              ((color.g / 255) * sourceAlpha +
                tile.floatData[targetOffset + 1] *
                  targetAlpha *
                  (1 - sourceAlpha)) /
              outputAlpha;
            const outputBlue =
              ((color.b / 255) * sourceAlpha +
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
        tile.notifySourceChanged();
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
          subscribeToSource: tile.subscribeToSource,
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
