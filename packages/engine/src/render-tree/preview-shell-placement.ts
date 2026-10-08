import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { isContainerNode } from "../nodes/node-tree";

// The per-shell fallback for content no moving layer covers. A preview root
// that is itself placed (or a vector whose rendered child paths are all
// previewing) moves as one shell. A root that is not placed (a group or
// artboard) moves the placed nodes beneath it that the gesture commits:
// leaves in the committed set, and vector or dense-group surfaces whose
// leaves all are.
export const resolvePlacedPreviewNodeIds = (
  editor,
  placedNodeIds: readonly string[],
  previewNodeIds: readonly string[],
  committedNodeIdSet: ReadonlySet<string>
): string[] => {
  if (placedNodeIds.length === 0) {
    return [];
  }

  const placedNodeIdSet = new Set(placedNodeIds);

  if (previewNodeIds.every((nodeId) => placedNodeIdSet.has(nodeId))) {
    return [...previewNodeIds];
  }

  const previewNodeIdSet = new Set(previewNodeIds);
  const descendantsByRoot = getCoveredDescendantsByPreviewRoot(
    editor,
    placedNodeIds,
    previewNodeIdSet,
    committedNodeIdSet
  );
  const resolvedNodeIds: string[] = [];

  for (const previewNodeId of previewNodeIds) {
    const placedAncestorId = getPlacedPreviewAncestorId(
      editor,
      previewNodeId,
      placedNodeIdSet,
      previewNodeIdSet
    );

    if (placedAncestorId) {
      resolvedNodeIds.push(placedAncestorId);
    }

    resolvedNodeIds.push(...(descendantsByRoot.get(previewNodeId) || []));
  }

  return [...new Set(resolvedNodeIds)];
};

// Commit targets are leaves (or contour vectors), while the render tree places
// vectors and dense groups as one surface; such a surface moves only when the
// gesture commits every leaf it paints.
export const isCommittedPlacement = (
  editor,
  placedNodeId: string,
  committedNodeIdSet: ReadonlySet<string>
) => {
  if (committedNodeIdSet.has(placedNodeId)) {
    return true;
  }

  if (
    editor.pathEditingNodeId ||
    !isContainerNode(editor.getNode(placedNodeId))
  ) {
    return false;
  }

  const leafNodeIds = editor.getDescendantLeafNodeIds(placedNodeId);

  return (
    leafNodeIds.length > 0 &&
    leafNodeIds.every((nodeId) => committedNodeIdSet.has(nodeId))
  );
};

// Each placed id walks its ancestor chain once and is bucketed, in placed
// (paint) order, under every preview root it is or descends from. Cost is
// O(placed × depth) however many roots the preview names.
const getCoveredDescendantsByPreviewRoot = (
  editor,
  placedNodeIds: readonly string[],
  previewNodeIdSet: ReadonlySet<string>,
  committedNodeIdSet: ReadonlySet<string>
) => {
  const descendantsByRoot = new Map<string, string[]>();

  for (const placedNodeId of placedNodeIds) {
    let currentNode = editor.getNode(placedNodeId);
    let isCovered: boolean | null = null;

    while (currentNode) {
      if (previewNodeIdSet.has(currentNode.id)) {
        isCovered ??= isCommittedPlacement(
          editor,
          placedNodeId,
          committedNodeIdSet
        );

        if (!isCovered) {
          break;
        }

        const descendants = descendantsByRoot.get(currentNode.id) || [];
        descendants.push(placedNodeId);
        descendantsByRoot.set(currentNode.id, descendants);
      }

      currentNode = getParentNode(editor, currentNode);
    }
  }

  return descendantsByRoot;
};

// The nearest placed node at or above a preview root that can stand in for it.
const getPlacedPreviewAncestorId = (
  editor,
  previewNodeId: string,
  placedNodeIdSet: ReadonlySet<string>,
  previewNodeIdSet: ReadonlySet<string>
) => {
  let currentNode = editor.getNode(previewNodeId);

  while (currentNode) {
    if (
      placedNodeIdSet.has(currentNode.id) &&
      canMapPreviewToPlacedNode(editor, currentNode.id, previewNodeIdSet)
    ) {
      return currentNode.id;
    }

    currentNode = getParentNode(editor, currentNode);
  }

  return null;
};

const canMapPreviewToPlacedNode = (
  editor,
  placedNodeId: string,
  previewNodeIdSet: ReadonlySet<string>
) => {
  if (editor.pathEditingNodeId) {
    return false;
  }

  if (previewNodeIdSet.has(placedNodeId)) {
    return true;
  }

  if (editor.getNode(placedNodeId)?.type !== "vector") {
    return false;
  }

  const renderedChildPathIds = editor
    .getChildNodeIds(placedNodeId)
    .filter((childNodeId) => {
      return (
        editor.isNodeEffectivelyVisible(childNodeId) &&
        editor.getNode(childNodeId)?.type === "path"
      );
    });

  return (
    renderedChildPathIds.length > 0 &&
    renderedChildPathIds.every((childNodeId) =>
      previewNodeIdSet.has(childNodeId)
    )
  );
};

const getParentNode = (editor, node) => {
  return node.parentId && node.parentId !== ROOT_PARENT_ID
    ? editor.getNode(node.parentId)
    : null;
};
