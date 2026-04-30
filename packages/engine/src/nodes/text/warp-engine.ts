import { format } from "../../primitives/math";
import {
  contoursToPath,
  getBounds,
  mapContours,
  translateContours,
} from "../../primitives/path-geometry";
import {
  buildWordBridgeContours,
  createTextHitRegions,
  getBoundsContours,
} from "./text-hit-regions";
import {
  buildCircleTextGeometry,
  getArchGuide,
  getCircleCenterAngleDeg,
  getCircleGuide,
  getCirclePoint,
  getCircleTrackingSpanDeg,
  getSlantGuide,
  getWaveGuide,
} from "./text-path";
import { estimateBounds, inflateBounds, layoutGlyphs } from "./warp-layout";

const getStrokeInflatedBounds = (node, bbox) => {
  const strokeInset = Math.max(node.strokeWidth / 2, 0);
  if (strokeInset === 0) {
    return bbox;
  }

  return inflateBounds(bbox, strokeInset);
};

export const applyArchWarp = (contours, bend) => {
  const bounds = getBounds(contours);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const halfWidth = Math.max(bounds.width / 2, 1);
  const halfHeight = Math.max(bounds.height / 2, 1);

  return mapContours(contours, (point) => {
    const u = (point.x - centerX) / halfWidth;

    return {
      x: point.x,
      y: point.y + bend * (1 - u * u) * halfHeight,
    };
  });
};

export const applyWaveWarp = (contours, amplitude, cycles) => {
  const bounds = getBounds(contours);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const halfWidth = Math.max(bounds.width / 2, 1);

  return mapContours(contours, (point) => {
    const u = (point.x - centerX) / halfWidth;
    const normalized = (u + 1) / 2;

    return {
      x: point.x,
      y: point.y + amplitude * Math.sin(2 * Math.PI * cycles * normalized),
    };
  });
};

export const applySlantWarp = (contours, rise) => {
  const bounds = getBounds(contours);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const halfWidth = Math.max(bounds.width / 2, 1);

  return mapContours(contours, (point) => {
    const u = (point.x - centerX) / halfWidth;

    return {
      x: point.x,
      y: point.y + (rise * u) / 2,
    };
  });
};

const getMergedGlyphContours = (layout) => {
  const contours =
    /** @type {Array<{ closed: boolean, points: Array<{ x: number, y: number }> }>} */ ([]);

  for (const glyph of layout.glyphs) {
    contours.push(...translateContours(glyph.contours, glyph.baseX, 0));
  }

  return contours;
};

const getCircleBridgePointMapper = (layout, node) => {
  const guide = getCircleGuide(node.warp);
  const isInverted = node.warp.inverted === true;
  const baseCenters =
    layout.naturalGlyphCenters ||
    layout.glyphs.map((glyph) => glyph.baseX + glyph.centerX);
  const baseCenterOrigin =
    baseCenters.length > 0
      ? ((baseCenters[0] ?? 0) + (baseCenters.at(-1) ?? 0)) / 2
      : 0;
  const baseSpanWidth =
    baseCenters.length > 1
      ? Math.max((baseCenters.at(-1) ?? 0) - (baseCenters[0] ?? 0), 1)
      : 1;
  const spanDeg = getCircleTrackingSpanDeg(node, layout.glyphs.length);
  const signedSpanDeg = isInverted ? -spanDeg : spanDeg;
  const centerAngleDeg = getCircleCenterAngleDeg(node.warp);

  return (point) => {
    const angleDeg =
      centerAngleDeg +
      ((point.x - baseCenterOrigin) / baseSpanWidth) * signedSpanDeg;
    const basePoint = getCirclePoint(guide.radius, angleDeg);
    const rotationDeg = angleDeg + (isInverted ? 180 : 0);
    const rotationRad = (rotationDeg * Math.PI) / 180;

    return {
      x: basePoint.x - point.y * Math.sin(rotationRad),
      y: basePoint.y + point.y * Math.cos(rotationRad),
    };
  };
};

const buildFallbackGeometry = (node) => {
  const bbox = getStrokeInflatedBounds(node, estimateBounds(node));

  return {
    hitRegions: createTextHitRegions(node, getBoundsContours(bbox)),
    paths: [],
    bbox,
    guide: null,
    ready: false,
    selectionBounds: null,
  };
};

const buildArchGeometry = (layout, node) => {
  const mergedContours = getMergedGlyphContours(layout);
  const bridgeContours = buildWordBridgeContours(layout, node);
  const flatBounds = getBounds(mergedContours);
  const warpedContours = applyArchWarp(mergedContours, node.warp.bend);
  const warpedBridgeContours = applyArchWarp(bridgeContours, node.warp.bend);
  const warpedBounds = getBounds(warpedContours);

  return {
    guide: getArchGuide(flatBounds, node.warp.bend, warpedBounds),
    hitRegions: createTextHitRegions(
      node,
      warpedContours,
      warpedBridgeContours
    ),
    paths: [{ key: "shape-0", d: contoursToPath(warpedContours) }],
    bbox: getStrokeInflatedBounds(node, warpedBounds),
    ready: true,
    selectionBounds: null,
  };
};

const buildWaveGeometry = (layout, node) => {
  const mergedContours = getMergedGlyphContours(layout);
  const bridgeContours = buildWordBridgeContours(layout, node);
  const flatBounds = getBounds(mergedContours);
  const warpedContours = applyWaveWarp(
    mergedContours,
    node.warp.amplitude,
    node.warp.cycles
  );
  const warpedBridgeContours = applyWaveWarp(
    bridgeContours,
    node.warp.amplitude,
    node.warp.cycles
  );
  const warpedBounds = getBounds(warpedContours);

  return {
    guide: getWaveGuide(
      flatBounds,
      node.warp.amplitude,
      node.warp.cycles,
      warpedBounds
    ),
    hitRegions: createTextHitRegions(
      node,
      warpedContours,
      warpedBridgeContours
    ),
    paths: [{ key: "shape-0", d: contoursToPath(warpedContours) }],
    bbox: getStrokeInflatedBounds(node, warpedBounds),
    ready: true,
    selectionBounds: null,
  };
};

const buildSlantGeometry = (layout, node) => {
  const mergedContours = getMergedGlyphContours(layout);
  const bridgeContours = buildWordBridgeContours(layout, node);
  const flatBounds = getBounds(mergedContours);
  const warpedContours = applySlantWarp(mergedContours, node.warp.rise);
  const warpedBridgeContours = applySlantWarp(bridgeContours, node.warp.rise);
  const warpedBounds = getBounds(warpedContours);

  return {
    guide: getSlantGuide(flatBounds, node.warp.rise, warpedBounds),
    hitRegions: createTextHitRegions(
      node,
      warpedContours,
      warpedBridgeContours
    ),
    paths: [{ key: "shape-0", d: contoursToPath(warpedContours) }],
    bbox: getStrokeInflatedBounds(node, warpedBounds),
    ready: true,
    selectionBounds: null,
  };
};

const buildCircleGeometry = (layout, node) => {
  const geometry = buildCircleTextGeometry(layout, node);
  const bridgeContours = mapContours(
    buildWordBridgeContours(layout, node),
    getCircleBridgePointMapper(layout, node)
  );

  return {
    guide: geometry.guide,
    hitRegions: createTextHitRegions(node, geometry.contours, bridgeContours),
    paths: geometry.paths,
    bbox: getStrokeInflatedBounds(node, geometry.bbox),
    ready: true,
    selectionBounds: getStrokeInflatedBounds(node, geometry.selectionBounds),
  };
};

const buildFlatGeometry = (layout, node) => {
  const paths =
    /** @type {Array<{ d: string, key: string, transform?: string }>} */ ([]);
  const mergedContours = getMergedGlyphContours(layout);
  const bridgeContours = buildWordBridgeContours(layout, node);

  for (const [index, glyph] of layout.glyphs.entries()) {
    paths.push({
      key: `glyph-${index}`,
      d: glyph.path,
      transform: `translate(${format(glyph.baseX)} 0)`,
    });
  }

  return {
    guide: null,
    hitRegions: createTextHitRegions(node, mergedContours, bridgeContours),
    paths,
    bbox: getStrokeInflatedBounds(node, getBounds(mergedContours)),
    ready: true,
    selectionBounds: null,
  };
};

export const buildNodeGeometry = (node, font) => {
  try {
    const layout = layoutGlyphs(node, font);

    if (layout.glyphs.length === 0) {
      const bbox = getStrokeInflatedBounds(node, {
        minX: -20,
        minY: -20,
        maxX: 20,
        maxY: 20,
        width: 40,
        height: 40,
      });

      return {
        hitRegions: createTextHitRegions(node, getBoundsContours(bbox)),
        paths: [],
        bbox,
        guide: null,
        ready: true,
        selectionBounds: null,
      };
    }

    if (node.warp.kind === "arch") {
      return buildArchGeometry(layout, node);
    }

    if (node.warp.kind === "wave") {
      return buildWaveGeometry(layout, node);
    }

    if (node.warp.kind === "circle") {
      return buildCircleGeometry(layout, node);
    }

    if (node.warp.kind === "slant") {
      return buildSlantGeometry(layout, node);
    }

    return buildFlatGeometry(layout, node);
  } catch {
    return buildFallbackGeometry(node);
  }
};
