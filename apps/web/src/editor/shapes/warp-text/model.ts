import { createLocalFontDescriptor } from "../../local-fonts";

export const createId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `node-${Math.random().toString(36).slice(2, 10)}`;
};

export const getDefaultWarp = (kind) => {
  if (kind === "arch") {
    return { kind: "arch", bend: 0.4 };
  }

  if (kind === "wave") {
    return { kind: "wave", amplitude: 180, cycles: 2 };
  }

  if (kind === "circle") {
    return { kind: "circle", radius: 1100, sweepDeg: 180 };
  }

  return { kind: "none" };
};

export const isNodeVisible = (node) => {
  return node?.visible !== false;
};

export const getNodeTransform = (node) => {
  return node.transform;
};

export const getNodeX = (node) => {
  return node.transform.x;
};

export const getNodeY = (node) => {
  return node.transform.y;
};

export const getNodeRotation = (node) => {
  return node.transform.rotation;
};

export const getNodeScaleX = (node) => {
  return node.transform.scaleX;
};

export const getNodeScaleY = (node) => {
  return node.transform.scaleY;
};

export const getNodeCssTransform = (node) => {
  const rotation = getNodeRotation(node) || 0;
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;

  return rotation || scaleX !== 1 || scaleY !== 1
    ? `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`
    : undefined;
};

export const withNodeTransform = (node, transformPatch) => {
  return {
    ...node,
    transform: {
      ...node.transform,
      ...transformPatch,
    },
  };
};

export const createDefaultNode = (font) => {
  return {
    id: createId(),
    type: "text",
    text: "YOUR TEXT",
    font: createLocalFontDescriptor(font),
    fontSize: 400,
    tracking: 10,
    fill: "#ffffff",
    stroke: "#000000",
    strokeWidth: 12,
    visible: true,
    warp: { kind: "arch", bend: 0.4 },
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 2250,
      y: 2700,
    },
  };
};
