export interface PixelGridTarget {
  kind: "frame" | "raster";
  node: any;
  sourceNodeId: string;
}

export const getPixelGridTarget = (editor): PixelGridTarget | null => {
  const activeNode = editor.activeLayer;

  if (
    !activeNode ||
    !editor.isNodeEffectivelyVisible(activeNode.id)
  ) {
    return null;
  }

  const frame = getOwningFrame(editor, activeNode);

  if (frame) {
    return {
      kind: "frame",
      node: frame,
      sourceNodeId: activeNode.id,
    };
  }

  if (activeNode.type !== "image") {
    return null;
  }

  const cropPreview = editor.getRasterCropPreviewNode?.();

  return {
    kind: "raster",
    node:
      cropPreview?.id === activeNode.id
        ? cropPreview
        : activeNode,
    sourceNodeId: activeNode.id,
  };
};

const getOwningFrame = (editor, node) => {
  let currentNode = node;

  while (currentNode) {
    if (currentNode.type === "artboard") {
      return currentNode;
    }

    if (!(currentNode.parentId && currentNode.parentId !== "root")) {
      return null;
    }

    currentNode = editor.getNode(currentNode.parentId);
  }

  return null;
};
