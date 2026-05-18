const offsetBounds = (bounds, delta) => {
  if (!(bounds && delta)) {
    return bounds;
  }

  return {
    ...bounds,
    maxX: bounds.maxX + (delta.x || 0),
    maxY: bounds.maxY + (delta.y || 0),
    minX: bounds.minX + (delta.x || 0),
    minY: bounds.minY + (delta.y || 0),
  };
};

const getAncestorArtboardId = (editor, nodeId) => {
  let currentNode = nodeId ? editor.getNode(nodeId) : null;

  while (currentNode?.parentId && currentNode.parentId !== "root") {
    const parentNode = editor.getNode(currentNode.parentId);

    if (parentNode?.type === "artboard") {
      return parentNode.id;
    }

    currentNode = parentNode;
  }

  return null;
};

export const getArtboardClipPath = (
  editor,
  nodeId,
  bounds,
  preview = null
) => {
  const artboardId = getAncestorArtboardId(editor, nodeId);

  if (!(bounds && artboardId)) {
    return "";
  }

  const artboardFrame = editor.getNodeRenderFrame(artboardId);
  const artboardBounds = preview?.nodeIds?.includes(artboardId)
    ? offsetBounds(artboardFrame?.bounds, preview.delta)
    : artboardFrame?.bounds;

  if (!artboardBounds) {
    return "";
  }

  const top = Math.max(0, artboardBounds.minY - bounds.minY);
  const right = Math.max(0, bounds.maxX - artboardBounds.maxX);
  const bottom = Math.max(0, bounds.maxY - artboardBounds.maxY);
  const left = Math.max(0, artboardBounds.minX - bounds.minX);

  return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
};
