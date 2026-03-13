import { clamp, format } from "../../primitives/math";
import {
  contoursToPath,
  getBounds,
  mapContours,
  translateContours,
} from "../../primitives/path-geometry";
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

const buildFallbackGeometry = (node) => {
  return {
    paths: [],
    bbox: getStrokeInflatedBounds(node, estimateBounds(node)),
    ready: false,
  };
};

const buildArchGeometry = (layout, node) => {
  const mergedContours =
    /** @type {ReturnType<typeof commandsToContours>} */ ([]);

  for (const glyph of layout.glyphs) {
    mergedContours.push(...translateContours(glyph.contours, glyph.baseX, 0));
  }

  const warpedContours = applyArchWarp(mergedContours, node.warp.bend);
  return {
    paths: [{ key: "shape-0", d: contoursToPath(warpedContours) }],
    bbox: getStrokeInflatedBounds(node, getBounds(warpedContours)),
    ready: true,
  };
};

const buildWaveGeometry = (layout, node) => {
  const mergedContours =
    /** @type {ReturnType<typeof commandsToContours>} */ ([]);

  for (const glyph of layout.glyphs) {
    mergedContours.push(...translateContours(glyph.contours, glyph.baseX, 0));
  }

  const warpedContours = applyWaveWarp(
    mergedContours,
    node.warp.amplitude,
    node.warp.cycles
  );

  return {
    paths: [{ key: "shape-0", d: contoursToPath(warpedContours) }],
    bbox: getStrokeInflatedBounds(node, getBounds(warpedContours)),
    ready: true,
  };
};

const buildCircleGeometry = (layout, node) => {
  const paths =
    /** @type {Array<{ d: string, key: string, transform?: string }>} */ ([]);
  const mergedContours =
    /** @type {ReturnType<typeof commandsToContours>} */ ([]);
  const totalWidth = Math.max(layout.totalWidth, 1);
  const radius = Math.max(1, node.warp.radius);

  for (const [index, glyph] of layout.glyphs.entries()) {
    const centerX = glyph.baseX + glyph.advance / 2;
    const u = clamp((centerX + totalWidth / 2) / totalWidth, 0, 1);
    const angleDeg = (u - 0.5) * node.warp.sweepDeg;
    const angleRad = (angleDeg * Math.PI) / 180;

    const arcX = radius * Math.sin(angleRad);
    const arcY = radius - radius * Math.cos(angleRad);

    paths.push({
      key: `glyph-${index}`,
      d: glyph.path,
      transform: `translate(${format(arcX)} ${format(arcY)}) rotate(${format(
        angleDeg
      )}) translate(${format(-glyph.centerX)} 0)`,
    });

    mergedContours.push(
      ...mapContours(glyph.contours, (point) => {
        const shiftedX = point.x - glyph.centerX;
        const shiftedY = point.y;
        const rotatedX =
          shiftedX * Math.cos(angleRad) - shiftedY * Math.sin(angleRad);
        const rotatedY =
          shiftedX * Math.sin(angleRad) + shiftedY * Math.cos(angleRad);

        return {
          x: rotatedX + arcX,
          y: rotatedY + arcY,
        };
      })
    );
  }

  return {
    paths,
    bbox: getStrokeInflatedBounds(node, getBounds(mergedContours)),
    ready: true,
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
    paths,
    bbox: getStrokeInflatedBounds(node, getBounds(mergedContours)),
    ready: true,
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
        ready: true,
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

    return buildFlatGeometry(layout, node);
  } catch {
    return buildFallbackGeometry(node);
  }
};
