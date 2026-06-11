import { describe, expect, test } from "bun:test";
import {
  commitMergedStrokeBounds,
  mergeStrokeStoreTile,
  RASTER_STORE_TILE_SIZE,
  RasterTileStore,
} from "../../../../packages/engine/src/raster/raster-tile-store";
import {
  getBrushDabCoverage,
  getBrushDabRenderRadius,
  getBrushDabSpacing,
} from "../../../../packages/engine/src/tools/brush-mask";

const TILE = RASTER_STORE_TILE_SIZE;
const COLOR = { b: 17, g: 17, r: 17 };

interface Point {
  x: number;
  y: number;
}

/**
 * Mirrors BrushStrokeSession's dab pipeline for a fully-hard, fully-opaque
 * paint brush: render-radius bounds, hard-brush coverage, solid fast path
 * with the previous dab as the skip circle, and segment interpolation at the
 * default spacing.
 */
class SolidStrokeSimulator {
  lastPoint: Point | null = null;
  lastSolidDabPoint: Point | null = null;
  radius: number;
  renderRadius: number;
  solidEnabled: boolean;
  spacing: number;
  store: RasterTileStore;

  constructor(store: RasterTileStore, size: number, { solid = true } = {}) {
    this.store = store;
    this.radius = size / 2;
    this.renderRadius = getBrushDabRenderRadius(size, 1);
    this.solidEnabled = solid;
    this.spacing = getBrushDabSpacing(size, 0, 1);
  }

  applyDab(point: Point) {
    const radius = this.radius;
    const bounds = {
      maxX: Math.ceil(point.x + this.renderRadius),
      maxY: Math.ceil(point.y + this.renderRadius),
      minX: Math.floor(point.x - this.renderRadius),
      minY: Math.floor(point.y - this.renderRadius),
    };
    const solid = this.solidEnabled
      ? {
          radius,
          skip: this.lastSolidDabPoint
            ? {
                radius,
                x: this.lastSolidDabPoint.x,
                y: this.lastSolidDabPoint.y,
              }
            : undefined,
        }
      : undefined;

    this.store.paintDab({
      bounds,
      color: COLOR,
      getCoverage: (x, y, centerPoint) => {
        const dx = x - centerPoint.x;
        const dy = y - centerPoint.y;

        return getBrushDabCoverage(
          (dx * dx + dy * dy) / (radius * radius),
          1,
          radius
        );
      },
      opacity: 1,
      point,
      solid,
    });

    if (this.solidEnabled) {
      this.lastSolidDabPoint = point;
    }
  }

  addPoint(point: Point, { onDab = null as (() => void) | null } = {}) {
    if (!this.lastPoint) {
      this.applyDab(point);
      onDab?.();
      this.lastPoint = point;
      return;
    }

    const distance = Math.hypot(
      point.x - this.lastPoint.x,
      point.y - this.lastPoint.y
    );
    const steps = Math.max(1, Math.ceil(distance / this.spacing));

    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;

      this.applyDab({
        x: this.lastPoint.x + (point.x - this.lastPoint.x) * progress,
        y: this.lastPoint.y + (point.y - this.lastPoint.y) * progress,
      });
      onDab?.();
    }

    this.lastPoint = point;
  }
}

const paintPolyline = (
  store: RasterTileStore,
  polyline: Point[],
  size: number,
  { onDab = null as (() => void) | null, solid = true } = {}
) => {
  const simulator = new SolidStrokeSimulator(store, size, { solid });

  for (const point of polyline) {
    simulator.addPoint(point, { onDab });
  }

  return simulator;
};

/** Per-tile chunked merge exactly as BrushStrokeSession.finishCommit runs it. */
const mergeLikeFinishCommit = (
  store: RasterTileStore,
  strokeStore: RasterTileStore,
  { anchorX = 0, anchorY = 0, onChunk = null as (() => void) | null } = {}
) => {
  const strokeBounds = strokeStore.getPaintedBounds();

  if (!strokeBounds) {
    return;
  }

  for (const strokeTile of strokeStore.getTilesForBounds(strokeBounds, {
    create: false,
  })) {
    mergeStrokeStoreTile({
      anchorX,
      anchorY,
      mode: "paint",
      store,
      strokeTile,
    });
    strokeTile.merged = true;
    onChunk?.();
  }

  strokeStore.revision += 1;
  commitMergedStrokeBounds({ anchorX, anchorY, store, strokeBounds });
};

const distanceToSegment = (x: number, y: number, a: Point, b: Point) => {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const lengthSquared = abX * abX + abY * abY;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(0, ((x - a.x) * abX + (y - a.y) * abY) / lengthSquared)
        );

  return Math.hypot(x - (a.x + abX * t), y - (a.y + abY * t));
};

/**
 * Scans every pixel whose center is at least `margin` inside the stroked
 * polyline and returns the first one whose alpha is not saturated, reading
 * through the nominal owner tile (getPixelAt).
 */
const findInteriorHole = (
  store: RasterTileStore,
  polyline: Point[],
  radius: number,
  { anchorX = 0, anchorY = 0, margin = 2 } = {}
) => {
  const interiorRadius = radius - margin;
  const minX = Math.floor(Math.min(...polyline.map((p) => p.x)) - radius);
  const maxX = Math.ceil(Math.max(...polyline.map((p) => p.x)) + radius);
  const minY = Math.floor(Math.min(...polyline.map((p) => p.y)) - radius);
  const maxY = Math.ceil(Math.max(...polyline.map((p) => p.y)) + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let distance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < polyline.length - 1; index += 1) {
        distance = Math.min(
          distance,
          distanceToSegment(
            x + 0.5,
            y + 0.5,
            polyline[index],
            polyline[index + 1]
          )
        );
      }

      if (distance > interiorRadius) {
        continue;
      }

      const alpha = store.getPixelAt(x - anchorX, y - anchorY)[3];

      if (alpha !== 255) {
        return { alpha, distance, x, y };
      }
    }
  }

  return null;
};

/**
 * Every physical pixel duplicated across tile gutters must match the value
 * the nominal owner tile reports for the same world pixel. Returns the first
 * channel mismatch above the tolerance.
 */
const findGutterMismatch = (store: RasterTileStore, { tolerance = 1 } = {}) => {
  for (const tile of store.tiles.values()) {
    for (let localY = 0; localY < tile.height; localY += 1) {
      const worldY = tile.y + localY;
      const insideNominalY =
        worldY >= tile.nominalY && worldY < tile.nominalY + tile.nominalHeight;

      for (let localX = 0; localX < tile.width; localX += 1) {
        const worldX = tile.x + localX;
        const insideNominalX =
          worldX >= tile.nominalX && worldX < tile.nominalX + tile.nominalWidth;

        if (insideNominalX && insideNominalY) {
          continue;
        }

        const offset = (localY * tile.width + localX) * 4;
        const owner = store.getPixelAt(worldX, worldY);

        for (let channel = 0; channel < 4; channel += 1) {
          if (
            Math.abs(tile.pixels[offset + channel] - owner[channel]) > tolerance
          ) {
            return {
              channel,
              gutter: [...tile.pixels.subarray(offset, offset + 4)],
              owner,
              tile: `${tile.col}:${tile.row}`,
              worldX,
              worldY,
            };
          }
        }
      }
    }
  }

  return null;
};

const getMaxStoreChannelDiff = (a: RasterTileStore, b: RasterTileStore) => {
  const keys = new Set([...a.tiles.keys(), ...b.tiles.keys()]);
  let maxDiff = 0;

  for (const key of keys) {
    const pixelsA = a.tiles.get(key)?.pixels;
    const pixelsB = b.tiles.get(key)?.pixels;

    if (!(pixelsA && pixelsB)) {
      const pixels = pixelsA || pixelsB;

      // A tile materialized on one side only counts only if it has content.
      for (let offset = 0; offset < (pixels?.length || 0); offset += 1) {
        maxDiff = Math.max(maxDiff, pixels[offset]);
      }
      continue;
    }

    for (let offset = 0; offset < pixelsA.length; offset += 1) {
      maxDiff = Math.max(maxDiff, Math.abs(pixelsA[offset] - pixelsB[offset]));
    }
  }

  return maxDiff;
};

/**
 * Byte-level twin of the compositor's persistent tile-canvas cache
 * (getTileCanvas in canvas-raster-store-surface): one shadow buffer per tile,
 * revision gate, syncRect snapshot-and-clear, partial copy with the same
 * clamping, full copy on a missing rect.
 */
class TileCanvasShadowCache {
  entries = new Map<object, { bytes: Uint8ClampedArray; revision: number }>();

  frame(store: RasterTileStore) {
    for (const tile of store.tiles.values()) {
      this.sync(tile);
    }
  }

  sync(tile) {
    let entry = this.entries.get(tile);

    if (entry && entry.revision === tile.revision) {
      return;
    }

    const syncRect = tile.syncRect;

    tile.syncRect = null;

    if (!entry) {
      entry = {
        bytes: new Uint8ClampedArray(tile.pixels),
        revision: tile.revision,
      };
      this.entries.set(tile, entry);
      return;
    }

    const rect = syncRect
      ? {
          height:
            Math.min(tile.height, syncRect.maxY) - Math.max(0, syncRect.minY),
          width:
            Math.min(tile.width, syncRect.maxX) - Math.max(0, syncRect.minX),
          x: Math.max(0, syncRect.minX),
          y: Math.max(0, syncRect.minY),
        }
      : null;

    if (rect && rect.width > 0 && rect.height > 0) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        const start = (y * tile.width + rect.x) * 4;

        entry.bytes.set(
          tile.pixels.subarray(start, start + rect.width * 4),
          start
        );
      }
    } else {
      entry.bytes.set(tile.pixels);
    }

    entry.revision = tile.revision;
  }

  findStalePixel(store: RasterTileStore) {
    for (const tile of store.tiles.values()) {
      const entry = this.entries.get(tile);

      if (!entry) {
        return { tile: `${tile.col}:${tile.row}`, unsynced: true };
      }

      for (let offset = 0; offset < tile.pixels.length; offset += 1) {
        if (entry.bytes[offset] !== tile.pixels[offset]) {
          return {
            cached: entry.bytes[offset],
            offset,
            stored: tile.pixels[offset],
            tile: `${tile.col}:${tile.row}`,
            unsynced: false,
          };
        }
      }
    }

    return null;
  }
}

// Polylines exercise wobble joints, joints exactly on tile seams,
// near-coincident centers, and crossings of both column and row boundaries.
const WOBBLE_ACROSS_COLUMNS: Point[] = [
  { x: 380, y: 420 },
  { x: 560, y: 380 },
  { x: 700, y: 470 },
  { x: 900, y: 430 },
  { x: 1100, y: 520 },
];
const JOINT_ON_SEAM: Point[] = [
  { x: 380, y: 300 },
  { x: TILE, y: 300 },
  { x: 640, y: 430 },
];
const NEAR_COINCIDENT: Point[] = [
  { x: 500, y: 500 },
  { x: 500.4, y: 500.2 },
  { x: 500.5, y: 500.2 },
  { x: 620, y: 560 },
];
const CROSS_BOTH_AXES: Point[] = [
  { x: 360, y: 380 },
  { x: 540, y: 470 },
  { x: 470, y: 620 },
  { x: 660, y: 700 },
];

describe("H3: solid+skip polyline stroke-store bytes", () => {
  const cases: [string, Point[], number][] = [
    ["wobble across two column seams", WOBBLE_ACROSS_COLUMNS, 200],
    ["joint exactly on a tile seam", JOINT_ON_SEAM, 180],
    ["near-coincident consecutive centers", NEAR_COINCIDENT, 160],
    ["crossing column and row seams", CROSS_BOTH_AXES, 240],
  ];

  for (const [name, polyline, size] of cases) {
    test(`${name}: full interior coverage and coverage-path parity`, () => {
      const solidStore = new RasterTileStore();
      const referenceStore = new RasterTileStore();

      paintPolyline(solidStore, polyline, size, { solid: true });
      paintPolyline(referenceStore, polyline, size, { solid: false });

      expect(findInteriorHole(solidStore, polyline, size / 2)).toBeNull();
      expect(findGutterMismatch(solidStore)).toBeNull();
      expect(
        getMaxStoreChannelDiff(solidStore, referenceStore)
      ).toBeLessThanOrEqual(1);
    });
  }
});

describe("H2: chunked stroke-store merge into the main store", () => {
  for (const [name, anchorX, anchorY] of [
    ["zero anchor", 0, 0],
    ["anchor off the tile grid", 600, 256],
  ] as const) {
    test(`${name}: merged bytes keep full interior coverage`, () => {
      const strokeStore = new RasterTileStore();
      const store = new RasterTileStore();

      paintPolyline(strokeStore, CROSS_BOTH_AXES, 240, { solid: true });
      mergeLikeFinishCommit(store, strokeStore, { anchorX, anchorY });

      expect(
        findInteriorHole(store, CROSS_BOTH_AXES, 120, { anchorX, anchorY })
      ).toBeNull();
    });

    test(`${name}: merged tiles keep gutter duplicates consistent`, () => {
      const strokeStore = new RasterTileStore();
      const store = new RasterTileStore();

      paintPolyline(strokeStore, CROSS_BOTH_AXES, 240, { solid: true });
      mergeLikeFinishCommit(store, strokeStore, { anchorX, anchorY });

      expect(findGutterMismatch(store)).toBeNull();
    });
  }

  test("wobble stroke merge keeps gutter duplicates consistent", () => {
    const strokeStore = new RasterTileStore();
    const store = new RasterTileStore();

    paintPolyline(strokeStore, WOBBLE_ACROSS_COLUMNS, 200, { solid: true });
    mergeLikeFinishCommit(store, strokeStore);

    expect(findGutterMismatch(store)).toBeNull();
  });

  test("merge onto pre-painted tiles keeps gutter duplicates consistent", () => {
    const strokeStore = new RasterTileStore();
    const store = new RasterTileStore();

    // Committed content already covers the seam area before the stroke lands.
    paintPolyline(
      store,
      [
        { x: 420, y: 300 },
        { x: 620, y: 300 },
      ],
      160,
      {
        solid: true,
      }
    );
    paintPolyline(strokeStore, JOINT_ON_SEAM, 180, { solid: true });
    mergeLikeFinishCommit(store, strokeStore);

    expect(findGutterMismatch(store)).toBeNull();
    expect(findInteriorHole(store, JOINT_ON_SEAM, 90)).toBeNull();
  });
});

describe("H1: syncRect stays a superset of writes for the display cache", () => {
  test("frames consumed during stroke and chunked merge never go stale", () => {
    const strokeStore = new RasterTileStore();
    const store = new RasterTileStore();
    const shadow = new TileCanvasShadowCache();

    // Pre-existing committed content so main-store cache entries exist
    // before the merge (the partial putImageData path, not entry creation).
    paintPolyline(
      store,
      [
        { x: 400, y: 560 },
        { x: 700, y: 560 },
      ],
      160,
      {
        solid: true,
      }
    );
    shadow.frame(store);

    // Live preview consumes stroke-tile sync rects every few dabs.
    let dabCount = 0;

    paintPolyline(strokeStore, CROSS_BOTH_AXES, 240, {
      onDab: () => {
        dabCount += 1;
        if (dabCount % 3 === 0) {
          shadow.frame(strokeStore);
        }
      },
      solid: true,
    });
    shadow.frame(strokeStore);

    // Chunked merge with compositor frames between chunks.
    mergeLikeFinishCommit(store, strokeStore, {
      onChunk: () => {
        shadow.frame(store);
      },
    });
    shadow.frame(store);

    expect(shadow.findStalePixel(strokeStore)).toBeNull();
    expect(shadow.findStalePixel(store)).toBeNull();
  });

  test("sync rects accumulated while zoomed out resync fully on zoom-in", () => {
    const store = new RasterTileStore();
    const shadow = new TileCanvasShadowCache();

    paintPolyline(
      store,
      [
        { x: 400, y: 560 },
        { x: 700, y: 560 },
      ],
      160,
      {
        solid: true,
      }
    );
    // Zoomed in once: cache entries materialize for the committed tiles.
    shadow.frame(store);

    // Zoomed out: the pyramid path renders instead, so no frames consume the
    // main store while two strokes land and merge.
    for (const polyline of [CROSS_BOTH_AXES, WOBBLE_ACROSS_COLUMNS]) {
      const zoomedOutStroke = new RasterTileStore();

      paintPolyline(zoomedOutStroke, polyline, 200, { solid: true });
      mergeLikeFinishCommit(store, zoomedOutStroke);
    }

    // Zoom back in: one frame must resync everything that changed.
    shadow.frame(store);

    expect(shadow.findStalePixel(store)).toBeNull();
  });
});
