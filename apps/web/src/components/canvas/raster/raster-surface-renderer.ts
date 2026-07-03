import { getTileCanvas } from "./raster-tile-canvas-cache";

/** Local-px padding on the inverse-projected viewport when culling tiles. */
const RASTER_SURFACE_CULL_PADDING = 4;

/**
 * Node-local px -> host-relative CSS px. Mirrors the DOM chain exactly: the
 * shell translates to the render frame origin, the transform element applies
 * the frame transform about its center, and the viewer maps world to screen
 * as (world - viewport) * zoom.
 */
const getLocalToHostMatrix = (surface) => {
  const { frameHeight, frameTransform, frameWidth, frameX, frameY } = surface;
  const { viewportX, viewportY, zoom } = surface;
  const view = new DOMMatrix([
    zoom,
    0,
    0,
    zoom,
    (frameX - viewportX) * zoom,
    (frameY - viewportY) * zoom,
  ]);

  if (!frameTransform) {
    return view;
  }

  const centerX = frameWidth / 2;
  const centerY = frameHeight / 2;

  return view
    .multiply(new DOMMatrix([1, 0, 0, 1, centerX, centerY]))
    .multiply(new DOMMatrix(frameTransform))
    .multiply(new DOMMatrix([1, 0, 0, 1, -centerX, -centerY]));
};

/** Bounding box of the inverse-projected viewport in node-local px. */
const getLocalViewportBounds = (localToHost, surface) => {
  const inverse = localToHost.inverse();
  const corners = [
    { x: 0, y: 0 },
    { x: surface.hostWidth, y: 0 },
    { x: surface.hostWidth, y: surface.hostHeight },
    { x: 0, y: surface.hostHeight },
  ].map((corner) => inverse.transformPoint(corner));

  if (corners.some((corner) => !Number.isFinite(corner.x + corner.y))) {
    return null;
  }

  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);

  return {
    maxX: Math.max(...xs) + RASTER_SURFACE_CULL_PADDING,
    maxY: Math.max(...ys) + RASTER_SURFACE_CULL_PADDING,
    minX: Math.min(...xs) - RASTER_SURFACE_CULL_PADDING,
    minY: Math.min(...ys) - RASTER_SURFACE_CULL_PADDING,
  };
};

/**
 * Device-space edge snapper for an axis-aligned local->device matrix. Two
 * abutting tiles drawn through one shared transform still land their common
 * edge on a fractional device coordinate, and the two antialiased edge
 * coverages composite to less than full alpha -- a faint bright seam line
 * under GPU raster. Snapping EDGES (not origins) to integers gives neighbors
 * the exact same snapped edge, so every device pixel is covered exactly once.
 * Returns null when the matrix rotates or flips; those draws go through the
 * shared transform instead.
 */
const getDeviceEdgeSnapper = (matrix) => {
  if (
    Math.abs(matrix.b) > 1e-6 ||
    Math.abs(matrix.c) > 1e-6 ||
    matrix.a <= 0 ||
    matrix.d <= 0
  ) {
    return null;
  }

  return {
    x: (localX) => Math.round(matrix.a * localX + matrix.e),
    y: (localY) => Math.round(matrix.d * localY + matrix.f),
  };
};

const drawSnappedRect = (context, snap, source, rect) => {
  const x0 = snap.x(rect.minX);
  const x1 = snap.x(rect.maxX);
  const y0 = snap.y(rect.minY);
  const y1 = snap.y(rect.maxY);

  if (x1 <= x0 || y1 <= y0) {
    return;
  }

  context.drawImage(
    source.canvas,
    source.x,
    source.y,
    source.width,
    source.height,
    x0,
    y0,
    x1 - x0,
    y1 - y0
  );
};

/**
 * Draw a tile's nominal (gutter-free) region at its integer store
 * coordinates: edge-snapped in device space when the transform is
 * axis-aligned, through the shared context transform otherwise.
 */
const drawTileNominalRegion = (context, snap, tile, offsetX, offsetY) => {
  const tileCanvas = getTileCanvas(tile);

  if (!tileCanvas) {
    return;
  }

  const source = {
    canvas: tileCanvas,
    height: tile.nominalHeight,
    width: tile.nominalWidth,
    x: tile.nominalX - tile.x,
    y: tile.nominalY - tile.y,
  };

  if (snap) {
    drawSnappedRect(context, snap, source, {
      maxX: tile.nominalX + tile.nominalWidth + offsetX,
      maxY: tile.nominalY + tile.nominalHeight + offsetY,
      minX: tile.nominalX + offsetX,
      minY: tile.nominalY + offsetY,
    });
    return;
  }

  context.drawImage(
    source.canvas,
    source.x,
    source.y,
    source.width,
    source.height,
    tile.nominalX + offsetX,
    tile.nominalY + offsetY,
    tile.nominalWidth,
    tile.nominalHeight
  );
};

const drawPyramidLevel = (context, snap, pyramid, surface, entry, options) => {
  const { bounds, level } = options;
  const levelSpan = entry.store.tileSize * 2 ** level;
  const minCol = Math.floor(bounds.minX / levelSpan);
  const maxCol = Math.floor((bounds.maxX - 1) / levelSpan);
  const minRow = Math.floor(bounds.minY / levelSpan);
  const maxRow = Math.floor((bounds.maxY - 1) / levelSpan);

  pyramid.beginFrame();

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const tile = pyramid.getTile(level, col, row);

      if (!tile) {
        continue;
      }

      if (snap) {
        drawSnappedRect(
          context,
          snap,
          {
            canvas: tile.canvas,
            height: tile.canvas.height,
            width: tile.canvas.width,
            x: 0,
            y: 0,
          },
          {
            maxX: (col + 1) * levelSpan + surface.anchorX,
            maxY: (row + 1) * levelSpan + surface.anchorY,
            minX: col * levelSpan + surface.anchorX,
            minY: row * levelSpan + surface.anchorY,
          }
        );
        continue;
      }

      context.drawImage(
        tile.canvas,
        col * levelSpan + surface.anchorX,
        row * levelSpan + surface.anchorY,
        levelSpan,
        levelSpan
      );
    }
  }
};

const drawCommittedStore = (
  context,
  snap,
  editor,
  nodeId,
  surface,
  bounds,
  scale
) => {
  const entry = editor.getRasterStoreEntry?.(nodeId);

  if (!entry) {
    return;
  }

  const storeBounds = {
    maxX: bounds.maxX - surface.anchorX,
    maxY: bounds.maxY - surface.anchorY,
    minX: bounds.minX - surface.anchorX,
    minY: bounds.minY - surface.anchorY,
  };
  const pyramid = editor.rasterStores?.getPyramid?.(nodeId) || null;
  const level = pyramid ? pyramid.getLevelForScale(scale) : 0;

  if (pyramid && level > 0) {
    drawPyramidLevel(context, snap, pyramid, surface, entry, {
      bounds: storeBounds,
      level,
    });
    return;
  }

  for (const tile of entry.store.getTilesForBounds(storeBounds, {
    create: false,
  })) {
    drawTileNominalRegion(
      context,
      snap,
      tile,
      surface.anchorX,
      surface.anchorY
    );
  }
};

const drawStrokeOverlays = (context, snap, overlays, bounds) => {
  for (const overlay of overlays) {
    context.globalCompositeOperation =
      overlay.operation === "erase" ? "destination-out" : "source-over";

    for (const tile of overlay.strokeStore.getTilesForBounds(bounds, {
      create: false,
    })) {
      if (!tile.merged) {
        drawTileNominalRegion(context, snap, tile, 0, 0);
      }
    }
  }

  context.globalCompositeOperation = "source-over";
};

/**
 * Repaint one raster surface canvas: size the backing store to the viewport
 * at device resolution, then draw the committed store (through the pyramid
 * level closest to device resolution) and the live stroke overlays, all at
 * integer store coordinates through one shared store->device transform.
 */
export const drawRasterSurface = (canvas, editor, nodeId, surface) => {
  const dpr = surface.devicePixelRatio;
  const width = Math.max(1, Math.round(surface.hostWidth * dpr));
  const height = Math.max(1, Math.round(surface.hostHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);

  const localToHost = getLocalToHostMatrix(surface);
  const bounds = getLocalViewportBounds(localToHost, surface);

  if (!bounds) {
    return;
  }

  const localToDevice = new DOMMatrix([dpr, 0, 0, dpr, 0, 0]).multiply(
    localToHost
  );
  // Device pixels per store pixel drives DPR-aware pyramid level selection.
  const scale = Math.max(
    Math.hypot(localToDevice.a, localToDevice.b),
    Math.hypot(localToDevice.c, localToDevice.d)
  );
  const snap = getDeviceEdgeSnapper(localToDevice);

  if (!snap) {
    context.setTransform(localToDevice);
  }

  // Deep-zoom regime: once a store pixel spans more than 2 CSS px (zoom > 2
  // on an unscaled node), sample nearest-neighbor so pixels render as crisp
  // squares, Photoshop-style. Below that, smoothing stays on for downscale
  // and mild upscale.
  const cssScale = scale / dpr;
  const smoothing = cssScale <= 2;

  context.imageSmoothingEnabled = smoothing;

  if (smoothing) {
    context.imageSmoothingQuality = "high";
  }

  if (surface.hydrated) {
    drawCommittedStore(context, snap, editor, nodeId, surface, bounds, scale);
  }

  drawStrokeOverlays(
    context,
    snap,
    editor.getRasterStrokeOverlaysForNode?.(nodeId) || [],
    bounds
  );
  context.setTransform(1, 0, 0, 1, 0, 0);
};
