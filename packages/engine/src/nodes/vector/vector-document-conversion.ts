import {
  expandContourOwnedVectorNode,
  isContourOwnedVector,
} from "./vector-contour-expansion";

const expandVectorNodes = (nodes) => {
  return nodes.flatMap((node) => {
    return isContourOwnedVector(node)
      ? expandContourOwnedVectorNode(node)
      : [node];
  });
};

export const toInternalEditorNodes = (nodes) => {
  return expandVectorNodes(nodes);
};

export const toSerializableDocumentNodes = (nodes) => {
  return expandVectorNodes(nodes);
};
