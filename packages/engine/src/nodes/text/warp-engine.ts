import { format } from "../../primitives/math";
import {
  contoursToPath,
  getBounds,
  mapContours,
  translateContours,
} from "../../primitives/path-geometry";
import {
  buildCircleTextGeometry,
  getArchGuide,
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

const buildFallbackGeometry = (node) => {
  return {
    paths: [],
    bbox: getStrokeInflatedBounds(node, estimateBounds(node)),
    guide: null,
    ready: false,
    selectionBounds: null,
  };
};

const buildArchGeometry = (layout, node) => {
  const mergedContours =
    /** @type {ReturnType<typeof commandsToContours>} */ ([]);

  for (const glyph of layout.glyphs) {
    mergedContours.push(...translateContours(glyph.contours, glyph.baseX, 0));
  }

  const flatBounds = getBounds(mergedContours);
  const warpedContours = applyArchWarp(mergedContours, node.warp.bend);
  const warpedBounds = getBounds(warpedContours);

  return {
    guide: getArchGuide(flatBounds, node.warp.bend, warpedBounds),
    paths: [{ key: "shape-0", d: contoursToPath(warpedContours) }],
    bbox: getStrokeInflatedBounds(node, warpedBounds),
    ready: true,
    selectionBounds: null,
  };
};

const buildWaveGeometry = (layout, node) => {
  const mergedContours =
    /** @type {ReturnType<typeof commandsToContours>} */ ([]);

  for (const glyph of layout.glyphs) {
    mergedContours.push(...translateContours(glyph.contours, glyph.baseX, 0));
  }

  const flatBounds = getBounds(mergedContours);
  const warpedContours = applyWaveWarp(
    mergedContours,
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
    paths: [{ key: "shape-0", d: contoursToPath(warpedContours) }],
    bbox: getStrokeInflatedBounds(node, warpedBounds),
    ready: true,
    selectionBounds: null,
  };
};

const buildSlantGeometry = (layout, node) => {
  const mergedContours =
    /** @type {ReturnType<typeof commandsToContours>} */ ([]);

  for (const glyph of layout.glyphs) {
    mergedContours.push(...translateContours(glyph.contours, glyph.baseX, 0));
  }

  const flatBounds = getBounds(mergedContours);
  const warpedContours = applySlantWarp(mergedContours, node.warp.rise);
  const warpedBounds = getBounds(warpedContours);

  return {
    guide: getSlantGuide(flatBounds, node.warp.rise, warpedBounds),
    paths: [{ key: "shape-0", d: contoursToPath(warpedContours) }],
    bbox: getStrokeInflatedBounds(node, warpedBounds),
    ready: true,
    selectionBounds: null,
  };
};

const buildCircleGeometry = (layout, node) => {
  const geometry = buildCircleTextGeometry(layout, node);

  return {
    guide: geometry.guide,
    paths: geometry.paths,
    bbox: getStrokeInflatedBounds(node, geometry.bbox),
    ready: true,
    selectionBounds: getStrokeInflatedBounds(node, geometry.selectionBounds),
  };
};

const buildFlatGeometry = (layout, node) => {
  const paths =
    /** @type {Array<{ d: string, key: string, transform?: string }>} */ ([]);
  const mergedContours =
    /** @type {ReturnType<typeof commandsToContours>} */ ([]);

  for (const [index, glyph] of layout.glyphs.entries()) {
    paths.push({
      key: `glyph-${index}`,
      d: glyph.path,
      transform: `translate(${format(glyph.baseX)} 0)`,
    });

    mergedContours.push(...translateContours(glyph.contours, glyph.baseX, 0));
  }

  return {
    guide: null,
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
      return {
        paths: [],
        bbox: getStrokeInflatedBounds(node, {
          minX: -20,
          minY: -20,
          maxX: 20,
          maxY: 20,
          width: 40,
          height: 40,
        }),
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
