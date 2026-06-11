import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "./vector-stroke-style";

export const createRasterAssetId = (nodeId: string) => {
  return `asset_${nodeId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
};

export const normalizeNodeForSchema = (node: Record<string, unknown>) => {
  const opacity =
    typeof node.opacity === "number" && Number.isFinite(node.opacity)
      ? Math.min(1, Math.max(0, node.opacity))
      : 1;

  if (node.type === "image") {
    return {
      ...node,
      assetId:
        typeof node.assetId === "string" && node.assetId.length > 0
          ? node.assetId
          : createRasterAssetId(String(node.id || "image")),
      opacity,
    };
  }

  if (node.type !== "path") {
    return {
      ...node,
      opacity,
    };
  }

  const contours =
    Array.isArray(node.contours) && node.contours.length > 0
      ? node.contours
      : Array.isArray(node.segments) && node.segments.length > 0
        ? [
            {
              closed: typeof node.closed === "boolean" ? node.closed : true,
              segments: node.segments,
            },
          ]
        : node.contours;
  const { closed: _closed, segments: _segments, ...pathNode } = node;

  return {
    ...pathNode,
    contours,
    opacity,
    strokeLineCap: node.strokeLineCap ?? DEFAULT_VECTOR_STROKE_LINE_CAP,
    strokeLineJoin: node.strokeLineJoin ?? DEFAULT_VECTOR_STROKE_LINE_JOIN,
    strokeMiterLimit:
      typeof node.strokeMiterLimit === "number"
        ? node.strokeMiterLimit
        : DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  };
};

export const normalizeNodesForSchema = <TNode extends Record<string, unknown>>(
  nodes: readonly TNode[]
) => {
  return nodes.map((node) => normalizeNodeForSchema(node)) as unknown as TNode[];
};
