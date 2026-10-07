import { buildAppearanceObjects } from "../appearance/appearance-render-plan";
import {
  serializeAppearanceObjects,
  wrapSvgOpacity,
} from "../appearance/appearance-svg";
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

const buildSvgImageMarkup = (
  node,
  geometry,
  inheritedOpacity,
  offsetX,
  offsetY
) => {
  const opacityValue = (node.opacity ?? 1) * inheritedOpacity;
  const opacity =
    opacityValue === 1 ? "" : ` opacity="${format(opacityValue)}"`;
  const localTransform = getNodeLocalTransform(node, geometry.bbox);
  const openLocalTransform = localTransform
    ? `<g transform="${localTransform}">`
    : "";
  const closeLocalTransform = localTransform ? "</g>" : "";
  const baseMarkup = node.src
    ? `<image href="${node.src}" x="${format(node.baseX ?? 0)}" y="${format(
        node.baseY ?? 0
      )}" width="${format(node.baseWidth ?? node.width)}" height="${format(
        node.baseHeight ?? node.height
      )}" preserveAspectRatio="none"${opacity}/>`
    : "";
  const clippedRasterMarkup = `<svg x="0" y="0" width="${format(
    node.width
  )}" height="${format(node.height)}" overflow="hidden">${baseMarkup}</svg>`;

  return `<g transform="translate(${format(getNodeX(node) - offsetX)} ${format(
    getNodeY(node) - offsetY
  )})">${openLocalTransform}${clippedRasterMarkup}${closeLocalTransform}</g>`;
};

export const buildSvgExport = (
  nodes,
  geometryById,
  options: {
    width?: any;
    height?: any;
    offsetX?: any;
    offsetY?: any;
    inheritedOpacityById?: any;
    background?: any;
    nodeById?: Map<string, unknown>;
  } = {}
) => {
  const width = options.width ?? ARTBOARD_WIDTH;
  const height = options.height ?? ARTBOARD_HEIGHT;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const inheritedOpacityById = options.inheritedOpacityById ?? new Map();
  const background = options.background ?? "#2d2d2d";
  const nodeById =
    options.nodeById ?? new Map(nodes.map((node) => [node.id, node]));
  const getNode = (nodeId: string) => nodeById.get(nodeId);
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
    if (!geometry) {
      continue;
    }

    if (node.type === "image") {
      body.push(
        buildSvgImageMarkup(
          node,
          geometry,
          inheritedOpacityById.get(node.id) ?? 1,
          offsetX,
          offsetY
        )
      );
      continue;
    }

    if (geometry.paths.length === 0) {
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

    body.push(
      wrapSvgOpacity(
        serializeAppearanceObjects(
          buildAppearanceObjects(node, geometry.paths, getNode)
        ),
        (node.opacity ?? 1) * inheritedOpacity
      )
    );

    if (localTransform) {
      body.push("</g>");
    }

    body.push("</g>");
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${format(width)}" height="${format(height)}" viewBox="0 0 ${format(width)} ${format(height)}">${body.join("")}</svg>`;
};
