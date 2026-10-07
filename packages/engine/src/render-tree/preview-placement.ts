import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { isContainerNode } from "../nodes/node-tree";

interface PlacementPreview {
  effectiveNodeIdSet?: ReadonlySet<string>;
  nodeIds?: readonly string[];
}

interface ResolvedPlacement {
  effectiveNodeIdSet: ReadonlySet<string> | undefined;
  nodes: unknown;
  pathEditingNodeId: string | null;
  placedNodeIds: readonly string[];
  previewNodeIds: readonly string[];
  result: string[];
}

const cacheByEditor = new WeakMap<object, ResolvedPlacement>();

// Maps a transform preview onto the placed shells and surfaces that must move.
// A preview root that is itself placed (or a vector whose rendered child paths
// are all previewing) moves as one shell. A root that is not placed (a group or
// artboard) moves the placed nodes beneath it that the gesture commits: leaves
// in the committed set, and vector or dense-group surfaces whose leaves all are.
// Move previews keep their id list and committed set across a gesture, so the
// result is reused for delta-only updates.
export const getPreviewPlacementNodeIds = (
  editor,
  placedNodeIds: readonly string[],
  preview: PlacementPreview | null
): string[] => {
  const previewNodeIds = preview?.nodeIds || [];

  if (!(placedNodeIds.length > 0 && previewNodeIds.length > 0)) {
    return [];
  }

  const cached = cacheByEditor.get(editor);
  const pathEditingNodeId = editor.pathEditingNodeId ?? null;

  if (
    cached &&
    cached.nodes === editor.nodes &&
    cached.placedNodeIds === placedNodeIds &&
    cached.previewNodeIds === previewNodeIds &&
    cached.effectiveNodeIdSet === preview?.effectiveNodeIdSet &&
    cached.pathEditingNodeId === pathEditingNodeId
  ) {
    return cached.result;
  }

  const result = resolvePreviewPlacement(
    editor,
    placedNodeIds,
    previewNodeIds,
    preview?.effectiveNodeIdSet
  );

  cacheByEditor.set(editor, {
    effectiveNodeIdSet: preview?.effectiveNodeIdSet,
    nodes: editor.nodes,
    pathEditingNodeId,
    placedNodeIds,
    previewNodeIds,
    result,
  });

  return result;
};

const resolvePreviewPlacement = (
  editor,
  placedNodeIds: readonly string[],
  previewNodeIds: readonly string[],
  committedNodeIdSet: ReadonlySet<string> | undefined
) => {
  const placedNodeIdSet = new Set(placedNodeIds);

  if (previewNodeIds.every((nodeId) => placedNodeIdSet.has(nodeId))) {
    return [...previewNodeIds];
  }

  const previewNodeIdSet = new Set(previewNodeIds);
  const descendantsByRoot = getCoveredDescendantsByPreviewRoot(
    editor,
    placedNodeIds,
    previewNodeIdSet,
    committedNodeIdSet || previewNodeIdSet
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

      currentNode =
        currentNode.parentId && currentNode.parentId !== ROOT_PARENT_ID
          ? editor.getNode(currentNode.parentId)
          : null;
    }
  }

  return descendantsByRoot;
};

// Commit targets are leaves (or contour vectors), while the render tree places
// vectors and dense groups as one surface; such a surface moves only when the
// gesture commits every leaf it paints.
const isCommittedPlacement = (
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

    currentNode =
      currentNode.parentId && currentNode.parentId !== ROOT_PARENT_ID
        ? editor.getNode(currentNode.parentId)
        : null;
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
