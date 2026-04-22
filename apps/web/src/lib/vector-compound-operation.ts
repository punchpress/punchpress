import type { Editor } from "@punchpress/engine";

export const BOOLEAN_VECTOR_COMPOUND_OPERATIONS = [
  {
    label: "Unite",
    value: "unite",
  },
  {
    label: "Subtract",
    value: "subtract",
  },
  {
    label: "Intersect",
    value: "intersect",
  },
  {
    label: "Exclude",
    value: "exclude",
  },
] as const;

export type VectorCompoundOperation =
  (typeof BOOLEAN_VECTOR_COMPOUND_OPERATIONS)[number]["value"];

const BOOLEAN_VECTOR_COMPOUND_OPERATION_SET = new Set<string>(
  BOOLEAN_VECTOR_COMPOUND_OPERATIONS.map((operation) => operation.value)
);

export const isBooleanVectorCompoundOperation = (
  value: string | null | undefined
): value is VectorCompoundOperation => {
  return Boolean(value && BOOLEAN_VECTOR_COMPOUND_OPERATION_SET.has(value));
};

export const getCompoundVectorOperationTarget = (
  editor: Editor,
  nodeId: string | null | undefined
) => {
  if (!nodeId) {
    return null;
  }

  const ownerNodeId = editor.getSelectionTargetNodeId(nodeId) || nodeId;
  const ownerNode = editor.getNode(ownerNodeId);

  if (ownerNode?.type !== "vector") {
    return null;
  }

  const childPathCount = editor
    .getChildNodeIds(ownerNodeId)
    .map((childNodeId) => editor.getNode(childNodeId))
    .filter((childNode) => childNode?.type === "path").length;
  const pathComposition = ownerNode.pathComposition || "independent";

  if (childPathCount < 2 || pathComposition === "independent") {
    return null;
  }

  return {
    nodeId: ownerNodeId,
    pathComposition,
  };
};
