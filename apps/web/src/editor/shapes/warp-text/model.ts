import { WARP_TEXT_NODE_KIND } from "../../constants";

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

export const createDefaultNode = (fontUrl) => {
  return {
    id: createId(),
    kind: WARP_TEXT_NODE_KIND,
    text: "YOUR TEXT",
    fontUrl,
    fontSize: 400,
    tracking: 10,
    fill: "#ffffff",
    stroke: "#000000",
    strokeWidth: 12,
    visible: true,
    warp: { kind: "arch", bend: 0.4 },
    rotation: 0,
    x: 2250,
    y: 2700,
  };
};
