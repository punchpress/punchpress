import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/punch-schema";
import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from "../constants";
import { format } from "../primitives/math";
import {
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
} from "./text/model";

const getNodeLocalTransform = (node, bbox) => {
  const rotation = getNodeRotation(node) || 0;
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;

  if (!(rotation || scaleX !== 1 || scaleY !== 1)) {
    return null;
  }

  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;
  const transforms = [`translate(${format(centerX)} ${format(centerY)})`];

  if (rotation) {
    transforms.push(`rotate(${format(rotation)})`);
  }

  if (scaleX !== 1 || scaleY !== 1) {
    transforms.push(`scale(${format(scaleX)} ${format(scaleY)})`);
  }

  transforms.push(`translate(${format(-centerX)} ${format(-centerY)})`);

  return transforms.join(" ");
};

const getPathOpacity = (node, path, inheritedOpacity) => {
  const nodeOpacity = node.opacity ?? 1;
  const pathOpacity = path.opacity;

  if (node.type === "vector") {
    return (pathOpacity ?? 1) * nodeOpacity * inheritedOpacity;
  }

  return (pathOpacity ?? nodeOpacity) * inheritedOpacity;
};

const buildSvgPathMarkup = (node, path, inheritedOpacity) => {
  const fill =
    path.closed === false ? "none" : (path.fill ?? node.fill ?? "none");
  const stroke = path.stroke ?? node.stroke ?? "none";
  const transform = path.transform ? ` transform="${path.transform}"` : "";
  const fillRuleValue =
    path.fillRule ?? (node.type === "path" ? node.fillRule : null);
  const fillRule = fillRuleValue ? ` fill-rule="${fillRuleValue}"` : "";
  const strokeLineCap =
    path.strokeLineCap ??
    (node.type === "path"
      ? (node.strokeLineCap ?? DEFAULT_VECTOR_STROKE_LINE_CAP)
      : DEFAULT_VECTOR_STROKE_LINE_CAP);
  const strokeLineJoin =
    path.strokeLineJoin ??
    (node.type === "path"
      ? (node.strokeLineJoin ?? DEFAULT_VECTOR_STROKE_LINE_JOIN)
      : DEFAULT_VECTOR_STROKE_LINE_JOIN);
  const strokeMiterLimit =
    path.strokeMiterLimit ??
    (node.type === "path"
      ? (node.strokeMiterLimit ?? DEFAULT_VECTOR_STROKE_MITER_LIMIT)
      : DEFAULT_VECTOR_STROKE_MITER_LIMIT);
  const strokeWidth = path.strokeWidth ?? node.strokeWidth ?? 0;
  const opacityValue = getPathOpacity(node, path, inheritedOpacity);
  const opacity =
    opacityValue === 1 ? "" : ` opacity="${format(opacityValue)}"`;

  return `<path d="${path.d}"${transform}${fillRule}${opacity} fill="${fill}" stroke="${stroke}" stroke-width="${format(
    strokeWidth
  )}" paint-order="fill stroke" stroke-linejoin="${strokeLineJoin}" stroke-linecap="${strokeLineCap}" stroke-miterlimit="${format(
    strokeMiterLimit
  )}"/>`;
};

export const buildSvgExport = (nodes, geometryById, options = {}) => {
  const width = options.width ?? ARTBOARD_WIDTH;
  const height = options.height ?? ARTBOARD_HEIGHT;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const inheritedOpacityById = options.inheritedOpacityById ?? new Map();
  const background = options.background ?? "#2d2d2d";
  const body = [
    background
      ? `<rect width="${format(width)}" height="${format(height)}" fill="${background}"/>`
      : "",
  ];

  for (const node of nodes) {
    if (node.visible === false || node.type === "artboard") {
      continue;
    }

    const geometry = geometryById.get(node.id);
    if (!geometry || geometry.paths.length === 0) {
      continue;
    }

    body.push(
      `<g transform="translate(${format(getNodeX(node) - offsetX)} ${format(
        getNodeY(node) - offsetY
      )})">`
    );

    const localTransform = getNodeLocalTransform(node, geometry.bbox);

    if (localTransform) {
      body.push(`<g transform="${localTransform}">`);
    }

    const inheritedOpacity = inheritedOpacityById.get(node.id) ?? 1;

    for (const path of geometry.paths) {
      body.push(buildSvgPathMarkup(node, path, inheritedOpacity));
    }

    if (localTransform) {
      body.push("</g>");
    }

    body.push("</g>");
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${format(width)}" height="${format(height)}" viewBox="0 0 ${format(width)} ${format(height)}">${body.join("")}</svg>`;
};
