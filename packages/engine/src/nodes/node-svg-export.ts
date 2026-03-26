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

const buildSvgPathMarkup = (node, path) => {
  const stroke = node.stroke ?? "none";
  const transform = path.transform ? ` transform="${path.transform}"` : "";

  return `<path d="${path.d}"${transform} fill="${node.fill}" stroke="${stroke}" stroke-width="${format(
    node.strokeWidth
  )}" paint-order="stroke fill" stroke-linejoin="round" stroke-linecap="round"/>`;
};

export const buildSvgExport = (nodes, geometryById) => {
  const body = [
    `<rect width="${ARTBOARD_WIDTH}" height="${ARTBOARD_HEIGHT}" fill="#2d2d2d"/>`,
  ];

  for (const node of nodes) {
    if (node.visible === false) {
      continue;
    }

    const geometry = geometryById.get(node.id);
    if (!geometry || geometry.paths.length === 0) {
      continue;
    }

    body.push(
      `<g transform="translate(${format(getNodeX(node))} ${format(
        getNodeY(node)
      )})">`
    );

    const localTransform = getNodeLocalTransform(node, geometry.bbox);

    if (localTransform) {
      body.push(`<g transform="${localTransform}">`);
    }

    for (const path of geometry.paths) {
      body.push(buildSvgPathMarkup(node, path));
    }

    if (localTransform) {
      body.push("</g>");
    }

    body.push("</g>");
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${ARTBOARD_WIDTH}" height="${ARTBOARD_HEIGHT}" viewBox="0 0 ${ARTBOARD_WIDTH} ${ARTBOARD_HEIGHT}">${body.join("")}</svg>`;
};
