export const resolvePreviewPlacementNodeIds = (
  editor,
  visibleNodeIds,
  preview
) => {
  const previewNodeIds = preview?.nodeIds || [];

  if (!(visibleNodeIds.length > 0 && previewNodeIds?.length > 0)) {
    return [];
  }

  const visibleNodeIdSet = new Set(visibleNodeIds);
  const previewNodeIdSet = new Set(previewNodeIds);
  const effectiveNodeIdSet = preview.effectiveNodeIdSet || previewNodeIdSet;
  const resolvedNodeIds: string[] = [];

  for (const previewNodeId of previewNodeIds) {
    let currentNode = editor.getNode(previewNodeId);

    while (currentNode) {
      if (
        visibleNodeIdSet.has(currentNode.id) &&
        canMapPreviewToVisibleNode(editor, currentNode.id, previewNodeIdSet)
      ) {
        resolvedNodeIds.push(currentNode.id);
        break;
      }

      currentNode = currentNode.parentId
        ? editor.getNode(currentNode.parentId)
        : null;
    }

    for (const visibleNodeId of visibleNodeIds) {
      if (
        effectiveNodeIdSet.has(visibleNodeId) &&
        editor.isDescendantOf(visibleNodeId, previewNodeId)
      ) {
        resolvedNodeIds.push(visibleNodeId);
      }
    }
  }

  return [...new Set(resolvedNodeIds)];
};

const canMapPreviewToVisibleNode = (
  editor,
  visibleNodeId,
  previewNodeIdSet
) => {
  if (editor.pathEditingNodeId) {
    return false;
  }

  if (previewNodeIdSet.has(visibleNodeId)) {
    return true;
  }

  const visibleNode = editor.getNode(visibleNodeId);

  if (visibleNode?.type !== "vector") {
    return false;
  }

  const renderedChildPathIds = editor
    .getChildNodeIds(visibleNodeId)
    .filter((childNodeId) => {
      if (!editor.isNodeEffectivelyVisible(childNodeId)) {
        return false;
      }

      if (editor.pathEditingNodeId === childNodeId) {
        return false;
      }

      return editor.getNode(childNodeId)?.type === "path";
    });

  return (
    renderedChildPathIds.length > 0 &&
    renderedChildPathIds.every((childNodeId) =>
      previewNodeIdSet.has(childNodeId)
    )
  );
};
