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

  let ownerNodeId: string | null = null;
  let currentNode = editor.getNode(nodeId);

  while (currentNode) {
    if (currentNode.type === "vector") {
      ownerNodeId = currentNode.id;
      break;
    }

    if (!currentNode.parentId || currentNode.parentId === "root") {
      break;
    }

    currentNode = editor.getNode(currentNode.parentId);
  }

  if (!ownerNodeId) {
    return null;
  }

  const ownerNode = editor.getNode(ownerNodeId);

  if (!ownerNode || ownerNode.type !== "vector") {
    return null;
  }

  const pathComposition = ownerNode.pathComposition || "independent";

  if (pathComposition === "independent") {
    return null;
  }

  let childPathCount = 0;

  for (const childNodeId of editor.getChildNodeIds(ownerNodeId)) {
    if (editor.getNode(childNodeId)?.type !== "path") {
      continue;
    }

    childPathCount += 1;
    if (childPathCount >= 2) {
      break;
    }
  }

  if (childPathCount < 2) {
    return null;
  }

  return {
    nodeId: ownerNodeId,
    pathComposition,
  };
};
