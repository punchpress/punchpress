export const DEFAULT_VECTOR_PATH_COMPOSITION = "independent";

export const BOOLEAN_PATH_COMPOSITIONS = new Set([
  "unite",
  "subtract",
  "intersect",
  "exclude",
]);

export const VECTOR_PATH_COMPOSITIONS = new Set([
  DEFAULT_VECTOR_PATH_COMPOSITION,
  "compound-fill",
  ...BOOLEAN_PATH_COMPOSITIONS,
]);

export const getVectorPathComposition = (node) => {
  return node?.type === "vector"
    ? (node.pathComposition ?? DEFAULT_VECTOR_PATH_COMPOSITION)
    : null;
};

export const isBooleanPathComposition = (pathComposition) => {
  return BOOLEAN_PATH_COMPOSITIONS.has(pathComposition);
};

export const isVectorPathComposition = (pathComposition) => {
  return VECTOR_PATH_COMPOSITIONS.has(pathComposition);
};

export const getVectorBooleanMethodName = (pathComposition) => {
  switch (pathComposition) {
    case "subtract":
      return "subtract";
    case "intersect":
      return "intersect";
    case "exclude":
      return "exclude";
    default:
      return "unite";
  }
};

export const getVectorChildPathNodes = (editor, nodeId) => {
  return editor
    .getChildNodeIds(nodeId)
    .map((childNodeId) => editor.getNode(childNodeId))
    .filter((childNode) => childNode?.type === "path");
};

export const getVectorPathEditingChildId = (editor, nodeId) => {
  return getVectorChildPathNodes(editor, nodeId).at(-1)?.id || null;
};
