import { getImageNodeBounds } from "../nodes/image/image-capabilities";
import {
  getNodeTransformForPinnedWorldPoint,
  getNodeWorldPoint,
} from "../primitives/rotation";
import { createCanvas } from "../tools/brush-runtime";
import type { RasterAssetStore } from "./raster-asset-store";
import {
  RASTER_STORE_TILE_GUTTER,
  RASTER_STORE_TILE_SIZE,
  type RasterStoreTile,
} from "./raster-tile-store";

/**
 * Commit-side projection of the tile store into node manifests.
 *
 * Every store-backed commit leaves the node pure-tiled: no `src`, no base
 * frame, and exactly one manifest entry per painted store tile, each entry
 * the complete content of its tile's nominal rect. A node that is not yet in
 * that shape (an imported base image, a legacy append/overlay manifest, a
 * manifest whose grid no longer lines up with the store after a reload)
 * migrates on its next commit by re-encoding every non-blank store tile;
 * pure nodes re-encode only the tiles the commit's merge touched and swap
 * the matching entries. Manifest size is therefore bounded by painted area,
 * never by stroke count, and every entry's payload is self-complete — the
 * precondition for tile eviction.
 */

type Bounds = { maxX: number; maxY: number; minX: number; minY: number };

export type RasterTileSource = {
  col: number;
  height: number;
  ref: string;
  row: number;
  width: number;
  x: number;
  y: number;
};

type ManifestImageNode = {
  src?: string;
  tileSources?: RasterTileSource[];
  height: number;
  width: number;
  [key: string]: unknown;
};

export type EncodeTilePixels = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number
) => string | null;

const getStoreTileKey = (col: number, row: number) => `${col}:${row}`;

/**
 * Store tile key for a manifest entry. Payloads cover their tile's physical
 * (gutter-extended) extent, so an entry may start up to one gutter before its
 * tile's nominal origin; shifting by the gutter before flooring keys it to
 * the owning tile regardless.
 */
export const getManifestEntryStoreKey = (
  tileSource: { x: number; y: number },
  anchorX: number,
  anchorY: number,
  tileSize = RASTER_STORE_TILE_SIZE
) => {
  const col = Math.floor(
    (tileSource.x - anchorX + RASTER_STORE_TILE_GUTTER) / tileSize
  );
  const row = Math.floor(
    (tileSource.y - anchorY + RASTER_STORE_TILE_GUTTER) / tileSize
  );

  return getStoreTileKey(col, row);
};

/**
 * True when the node is already in the pure-tiled commit shape: src-less,
 * every manifest entry contained inside one store tile's physical
 * (gutter-extended) rect under the entry anchor, and no two entries sharing
 * a store tile. Only then can a commit replace per touched tile; anything
 * else (imported base, legacy append overlays, a reloaded manifest whose
 * grid drifted off the fresh store's tiling) migrates wholesale first.
 */
export const isPureTiledImageNode = (
  node: ManifestImageNode,
  {
    anchorX = 0,
    anchorY = 0,
    tileSize = RASTER_STORE_TILE_SIZE,
  }: { anchorX?: number; anchorY?: number; tileSize?: number } = {}
) => {
  if (node.src) {
    return false;
  }

  const gutter = RASTER_STORE_TILE_GUTTER;
  const keys = new Set<string>();

  for (const tileSource of node.tileSources || []) {
    const storeX = tileSource.x - anchorX;
    const storeY = tileSource.y - anchorY;
    const col = Math.floor((storeX + gutter) / tileSize);
    const row = Math.floor((storeY + gutter) / tileSize);

    if (
      storeX + tileSource.width > (col + 1) * tileSize + gutter ||
      storeY + tileSource.height > (row + 1) * tileSize + gutter
    ) {
      return false;
    }

    const key = getStoreTileKey(col, row);

    if (keys.has(key)) {
      return false;
    }

    keys.add(key);
  }

  return true;
};

/**
 * Existing manifest minus every entry whose store tile this commit re-encoded
 * (or fully erased), plus the replacement entries. The result keeps at most
 * one entry per store tile, so repeated strokes over the same region swap
 * refs instead of growing the manifest.
 */
export const getReplacedTileSources = ({
  anchorX,
  anchorY,
  existingTileSources,
  replacedKeys,
  tileSize = RASTER_STORE_TILE_SIZE,
  tileSources,
}: {
  anchorX: number;
  anchorY: number;
  existingTileSources: RasterTileSource[];
  replacedKeys: ReadonlySet<string>;
  tileSize?: number;
  tileSources: RasterTileSource[];
}) => {
  return [
    ...existingTileSources.filter(
      (tileSource) =>
        !replacedKeys.has(
          getManifestEntryStoreKey(tileSource, anchorX, anchorY, tileSize)
        )
    ),
    ...tileSources,
  ];
};

const getAlphaBoundsInRegion = (
  tile: RasterStoreTile,
  region: Bounds
): (Bounds & { nominalHit: boolean }) | null => {
  const words = new Uint32Array(
    tile.pixels.buffer,
    tile.pixels.byteOffset,
    tile.pixels.length / 4
  );
  const nominalMinX = tile.nominalX - tile.x;
  const nominalMinY = tile.nominalY - tile.y;
  const nominalMaxX = nominalMinX + tile.nominalWidth;
  const nominalMaxY = nominalMinY + tile.nominalHeight;
  let nominalHit = false;
  let minX = region.maxX;
  let minY = region.maxY;
  let maxX = region.minX - 1;
  let maxY = region.minY - 1;

  for (let y = region.minY; y < region.maxY; y += 1) {
    const rowOffset = y * tile.width;

    for (let x = region.minX; x < region.maxX; x += 1) {
      if (words[rowOffset + x] >>> 24 === 0) {
        continue;
      }

      if (
        !nominalHit &&
        x >= nominalMinX &&
        x < nominalMaxX &&
        y >= nominalMinY &&
        y < nominalMaxY
      ) {
        nominalHit = true;
      }

      if (x < minX) {
        minX = x;
      }

      if (x > maxX) {
        maxX = x;
      }

      if (y < minY) {
        minY = y;
      }

      maxY = y;
    }
  }

  return maxX < minX
    ? null
    : { maxX: maxX + 1, maxY: maxY + 1, minX, minY, nominalHit };
};

/**
 * Default tile payload encoder: synchronous canvas toDataURL by design (the
 * async toBlob family intermittently kills the Chromium renderer under
 * concurrent large-commit load; off-thread encoding is the stage 5b worker).
 */
export const encodeTilePixelsToPngDataUrl: EncodeTilePixels = (
  pixels,
  width,
  height
) => {
  const canvas = createCanvas(width, height);
  const context = canvas?.getContext("2d", { willReadFrequently: true });

  if (!(canvas && context)) {
    return null;
  }

  context.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas.toDataURL("image/png");
};

/**
 * Encode one store tile's complete merged content into the asset store and
 * return its manifest entry, or null when the tile holds no visible pixels
 * (the caller then drops the tile's manifest key).
 *
 * The encode region is the tile's full physical rect — gutter included, so
 * adjacent payloads overlap by the gutter band exactly like the merge writes
 * them. The overlap matters for the committed-DOM fallback renderer:
 * abutting payloads drawn as separate images open bright GPU-rounding seams
 * at fractional zooms (sweep-asserted), and the duplicated band masks them.
 * The region is optionally clamped to `clampBounds` (store coords): the
 * node's legitimate plane region, which keeps pixels dropped by an artboard
 * crop from resurfacing. Within that region the payload trims to its alpha
 * bounds, so an entry is always the full non-transparent content of its
 * store tile.
 */
export const createStoreTileSource = ({
  anchorX,
  anchorY,
  assets,
  clampBounds = null,
  commitRevision,
  encodeTilePixels = encodeTilePixelsToPngDataUrl,
  nodeId,
  tile,
  tileSize = RASTER_STORE_TILE_SIZE,
}: {
  anchorX: number;
  anchorY: number;
  assets: RasterAssetStore;
  clampBounds?: Bounds | null;
  commitRevision: number;
  encodeTilePixels?: EncodeTilePixels;
  nodeId: string;
  tile: RasterStoreTile;
  tileSize?: number;
}): RasterTileSource | null => {
  const region = {
    maxX: tile.width,
    maxY: tile.height,
    minX: 0,
    minY: 0,
  };

  if (clampBounds) {
    region.minX = Math.max(region.minX, Math.floor(clampBounds.minX) - tile.x);
    region.minY = Math.max(region.minY, Math.floor(clampBounds.minY) - tile.y);
    region.maxX = Math.min(region.maxX, Math.ceil(clampBounds.maxX) - tile.x);
    region.maxY = Math.min(region.maxY, Math.ceil(clampBounds.maxY) - tile.y);
  }

  if (region.maxX <= region.minX || region.maxY <= region.minY) {
    return null;
  }

  const alphaBounds = getAlphaBoundsInRegion(tile, region);

  // A tile whose nominal region is blank owns no pixels: whatever sits in
  // its gutter duplicates a neighbor's nominal content, which that
  // neighbor's payload already carries. Encoding it would bloat manifests
  // with 2px sliver entries on every boundary-crossing stroke.
  if (!alphaBounds?.nominalHit) {
    return null;
  }

  const width = alphaBounds.maxX - alphaBounds.minX;
  const height = alphaBounds.maxY - alphaBounds.minY;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    const sourceOffset =
      ((alphaBounds.minY + row) * tile.width + alphaBounds.minX) * 4;

    pixels.set(
      tile.pixels.subarray(sourceOffset, sourceOffset + width * 4),
      row * width * 4
    );
  }

  const dataUrl = encodeTilePixels(pixels, width, height);

  if (!dataUrl) {
    return null;
  }

  const x = tile.x + alphaBounds.minX + anchorX;
  const y = tile.y + alphaBounds.minY + anchorY;
  const ref = `assets/raster/${nodeId}/tiles/${commitRevision}_${tile.col}_${tile.row}.png`;

  assets.putDataUrl(ref, dataUrl, "image/png");

  return {
    col: Math.floor(x / tileSize),
    height,
    ref,
    row: Math.floor(y / tileSize),
    width,
    x,
    y,
  };
};

const getTileSourceWithOffset = (
  tileSource: RasterTileSource,
  offsetX: number,
  offsetY: number,
  tileSize: number
): RasterTileSource => {
  if (!(offsetX || offsetY)) {
    return tileSource;
  }

  const x = tileSource.x + offsetX;
  const y = tileSource.y + offsetY;

  return {
    ...tileSource,
    col: Math.floor(x / tileSize),
    row: Math.floor(y / tileSize),
    x,
    y,
  };
};

/**
 * Node state for a store-backed commit: pure-tiled (no src, no base frame),
 * plane bounds covering the node rect and every manifest entry. Entries at
 * negative plane coords shift the whole manifest right/down and pin the
 * node's world position (growth is metadata-only; store pixels never move).
 * `trimToTiles` — used for a brush stroke that just created its layer — sizes
 * the plane to the painted entries alone instead of preserving the node rect.
 */
export const getTiledImageCommitState = ({
  node,
  tileSize = RASTER_STORE_TILE_SIZE,
  tileSources,
  trimToTiles = false,
}: {
  node: ManifestImageNode;
  tileSize?: number;
  tileSources: RasterTileSource[];
  trimToTiles?: boolean;
}) => {
  const rects = tileSources.map((tileSource) => ({
    maxX: tileSource.x + tileSource.width,
    maxY: tileSource.y + tileSource.height,
    minX: tileSource.x,
    minY: tileSource.y,
  }));

  if (!trimToTiles || rects.length === 0) {
    rects.push({ maxX: node.width, maxY: node.height, minX: 0, minY: 0 });
  }

  const bounds = {
    maxX: Math.max(...rects.map((rect) => rect.maxX)),
    maxY: Math.max(...rects.map((rect) => rect.maxY)),
    minX: Math.min(...rects.map((rect) => rect.minX)),
    minY: Math.min(...rects.map((rect) => rect.minY)),
  };
  const offsetX = trimToTiles
    ? -Math.floor(bounds.minX)
    : Math.max(0, -Math.floor(bounds.minX));
  const offsetY = trimToTiles
    ? -Math.floor(bounds.minY)
    : Math.max(0, -Math.floor(bounds.minY));
  const width = Math.max(1, Math.ceil(bounds.maxX) + offsetX);
  const height = Math.max(1, Math.ceil(bounds.maxY) + offsetY);
  const nextTileSources = tileSources.map((tileSource) =>
    getTileSourceWithOffset(tileSource, offsetX, offsetY, tileSize)
  );
  const nextNode = {
    ...node,
    height,
    width,
  };
  const transform =
    offsetX || offsetY
      ? getNodeTransformForPinnedWorldPoint(
          nextNode,
          getImageNodeBounds(nextNode),
          { x: offsetX, y: offsetY },
          getNodeWorldPoint(node, getImageNodeBounds(node), { x: 0, y: 0 })
        )
      : node.transform;

  return {
    node: {
      ...node,
      baseHeight: undefined,
      baseWidth: undefined,
      baseX: undefined,
      baseY: undefined,
      height,
      mimeType: "image/png",
      src: undefined,
      tileSources: nextTileSources,
      transform: {
        ...(node.transform as object),
        ...(transform as object),
      },
      width,
    },
    offsetX,
    offsetY,
  };
};

export { getStoreTileKey };
