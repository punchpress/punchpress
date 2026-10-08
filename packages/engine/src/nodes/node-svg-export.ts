import { buildAppearanceElements } from "../appearance/appearance-elements";
import type { Bounds } from "../appearance/appearance-types";
import { buildAppearanceObjects } from "../appearance/appearance-render-plan";
import {
  buildEffectFilter,
  getEffectPresentation,
} from "../effects/effect-filter";
import { getNodeEffects } from "../effects/effect-model";
import {
  getLeafEffectPresentation,
  wrapEffectElements,
} from "../effects/effect-owner";
import {
  createOutputInkReader,
  getDocumentInkSource,
  unionBounds,
} from "../render-tree/output-ink";
import {
  createPaintIdAllocator,
  serializeSvgElements,
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
    background?: any;
    nodeById?: Map<string, unknown>;
  } = {}
) => {
  const width = options.width ?? ARTBOARD_WIDTH;
  const height = options.height ?? ARTBOARD_HEIGHT;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const background = options.background ?? "#2d2d2d";
  const nodeById =
    options.nodeById ?? new Map(nodes.map((node) => [node.id, node]));
  const getNode = (nodeId: string) => nodeById.get(nodeId);
  const body = [
    background
      ? `<rect width="${format(width)}" height="${format(height)}" fill="${background}"/>`
      : "",
  ];

  const makePaintId = createPaintIdAllocator();
  // Groups are not exported nodes, so walk the whole document graph.
  const inkSource = getDocumentInkSource(
    [...nodeById.values()],
    geometryById,
    getNode
  );
  const layers = createLayerWriter(body, getNode, {
    inkSource,
    makeId: makePaintId,
    offsetX,
    offsetY,
    readInk: createOutputInkReader(inkSource),
  });

  for (const node of nodes) {
    if (node.visible === false || node.type === "artboard") {
      continue;
    }

    const geometry = geometryById.get(node.id);
    if (!geometry) {
      continue;
    }

    layers.enter(node);

    if (node.type === "image") {
      body.push(buildSvgImageMarkup(node, geometry, 1, offsetX, offsetY));
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

    // Filter, then opacity: the shadow fades with its content.
    const elements = wrapEffectElements(
      buildAppearanceElements(
        buildAppearanceObjects(node, geometry, getNode),
        makePaintId
      ),
      getLeafEffectPresentation(node, geometry),
      makePaintId,
      node.id
    );

    body.push(
      wrapSvgOpacity(serializeSvgElements(elements), node.opacity ?? 1)
    );

    if (localTransform) {
      body.push("</g>");
    }

    body.push("</g>");
  }

  layers.closeAll();

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${format(width)}" height="${format(height)}" viewBox="0 0 ${format(width)} ${format(height)}">${body.join("")}</svg>`;
};

// Groups and artboards are compositing layers: their opacity (and a group's
// shadows) apply once to their flattened content, never multiplied into
// leaves. Nodes arrive in canonical paint order (each subtree contiguous), so
// layers open and close as the walk enters and leaves each container's
// subtree. SVG applies a group's filter before its opacity.
const createLayerWriter = (
  body: string[],
  getNode,
  { inkSource, makeId, offsetX, offsetY, readInk }
) => {
  const open: { closes: boolean; id: string }[] = [];

  // The group's shadows over its children's stage ink, moved into export
  // coordinates once.
  const getGroupFilterMarkup = (groupId: string) => {
    const group = getNode(groupId);

    if (group?.type !== "group") {
      return null;
    }

    const content = unionBounds(
      inkSource
        .getChildNodeIds(groupId)
        .map(readInk)
        .filter(Boolean) as Bounds[]
    );
    const presentation = getEffectPresentation(getNodeEffects(group), content);

    if (!presentation) {
      return null;
    }

    const id = makeId(JSON.stringify(["filter", groupId]));
    const ink = presentation.ink;
    const shifted = {
      ...presentation,
      ink: {
        ...ink,
        maxX: ink.maxX - offsetX,
        maxY: ink.maxY - offsetY,
        minX: ink.minX - offsetX,
        minY: ink.minY - offsetY,
      },
    };

    return {
      defs: `<defs>${serializeSvgElements([buildEffectFilter(shifted, id)])}</defs>`,
      id,
    };
  };

  const getLayerChain = (node) => {
    const chain: { id: string; opacity: number }[] = [];
    let parent = getNode(node.parentId);

    while (parent) {
      if (parent.type === "group" || parent.type === "artboard") {
        chain.unshift({ id: parent.id, opacity: parent.opacity ?? 1 });
      }

      parent = getNode(parent.parentId);
    }

    return chain;
  };

  return {
    closeAll: () => {
      while (open.length > 0) {
        if (open.pop()?.closes) {
          body.push("</g>");
        }
      }
    },
    enter: (node) => {
      const chain = getLayerChain(node);
      let shared = 0;

      while (
        shared < open.length &&
        shared < chain.length &&
        open[shared].id === chain[shared].id
      ) {
        shared += 1;
      }

      while (open.length > shared) {
        if (open.pop()?.closes) {
          body.push("</g>");
        }
      }

      for (const layer of chain.slice(shared)) {
        const filter = getGroupFilterMarkup(layer.id);
        const closes = layer.opacity < 1 || Boolean(filter);

        if (closes) {
          const opacity =
            layer.opacity < 1 ? ` opacity="${format(layer.opacity)}"` : "";

          body.push(
            filter
              ? `${filter.defs}<g filter="url(#${filter.id})"${opacity}>`
              : `<g${opacity}>`
          );
        }

        open.push({ closes, id: layer.id });
      }
    },
  };
};
