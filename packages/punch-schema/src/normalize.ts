import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "./vector-stroke-style";

export const normalizeNodeForSchema = (node: Record<string, unknown>) => {
  if (node.type !== "path") {
    return node;
  }

  return {
    ...node,
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
  return nodes.map((node) => normalizeNodeForSchema(node)) as TNode[];
};
