import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from "../../constants";
import { clamp, format } from "../../primitives/math";
import {
  commandsToContours,
  contoursToPath,
  getBounds,
  mapContours,
  translateContours,
} from "../../primitives/path-geometry";

export const estimateBounds = (node) => {
  const halfWidth = Math.max(
    120,
    node.fontSize * Math.max(1, node.text.length * 0.28)
  );
  const halfHeight = Math.max(90, node.fontSize * 0.7);

  return {
    minX: -halfWidth,
    minY: -halfHeight,
    maxX: halfWidth,
    maxY: halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  };
};

export const inflateBounds = (bbox, amount) => {
  return {
    minX: bbox.minX - amount,
    minY: bbox.minY - amount,
    maxX: bbox.maxX + amount,
    maxY: bbox.maxY + amount,
    width: bbox.width + amount * 2,
    height: bbox.height + amount * 2,
  };
};

const getStrokeInflatedBounds = (node, bbox) => {
  const strokeInset = Math.max(node.strokeWidth / 2, 0);
  if (strokeInset === 0) {
    return bbox;
  }

  return inflateBounds(bbox, strokeInset);
};

export const layoutGlyphs = (node, font) => {
  const text = node.text.length > 0 ? [...node.text] : [" "];
  const scale = node.fontSize / font.unitsPerEm;
  let cursorX = 0;

  const glyphs =
    /** @type {Array<{ advance: number, baseX: number, centerX: number, contours: ReturnType<typeof commandsToContours>, path: string }>} */ ([]);

  for (const char of text) {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(0, 0, node.fontSize);
    const contours = commandsToContours(path.commands, 1);
    const bounds = getBounds(contours);
    const advance =
      (glyph.advanceWidth || font.unitsPerEm) * scale + node.tracking;
    const centerX =
      bounds.width > 0 ? (bounds.minX + bounds.maxX) / 2 : advance / 2;

    glyphs.push({
      path: path.toPathData(3),
      contours,
      advance,
      baseX: cursorX,
      centerX,
    });

    cursorX += advance;
  }

  const totalWidth = Math.max(cursorX - node.tracking, 0);
  const centeringOffset = -totalWidth / 2;

  for (const glyph of glyphs) {
    glyph.baseX += centeringOffset;
  }

  return {
    glyphs,
    totalWidth,
  };
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

export const buildSvgExport = (nodes, geometryById) => {
  const body = [
    `<rect width="${ARTBOARD_WIDTH}" height="${ARTBOARD_HEIGHT}" fill="#2d2d2d"/>`,
  ];

  for (const node of nodes) {
    const geometry = geometryById.get(node.id);
    if (!geometry || geometry.paths.length === 0) {
      continue;
    }

    body.push(`<g transform="translate(${format(node.x)} ${format(node.y)})">`);

    if (node.rotation) {
      const centerX = (geometry.bbox.minX + geometry.bbox.maxX) / 2;
      const centerY = (geometry.bbox.minY + geometry.bbox.maxY) / 2;

      body.push(
        `<g transform="rotate(${format(node.rotation)} ${format(centerX)} ${format(centerY)})">`
      );
    }

    for (const path of geometry.paths) {
      const transform = path.transform ? ` transform="${path.transform}"` : "";
      body.push(
        `<path d="${path.d}"${transform} fill="${node.fill}" stroke="${node.stroke}" stroke-width="${format(
          node.strokeWidth
        )}" paint-order="stroke fill" stroke-linejoin="round" stroke-linecap="round"/>`
      );
    }

    if (node.rotation) {
      body.push("</g>");
    }

    body.push("</g>");
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${ARTBOARD_WIDTH}" height="${ARTBOARD_HEIGHT}" viewBox="0 0 ${ARTBOARD_WIDTH} ${ARTBOARD_HEIGHT}">${body.join("")}</svg>`;
};
