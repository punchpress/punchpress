export const shouldFitFirstAddedNode = (editor) => {
  return editor.nodes.every((node) => node.type === "empty");
};

export const fitFirstAddedNode = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return;
  }

  if (node.type === "artboard") {
    const bounds = editor.getNodeRenderFrame(nodeId)?.bounds;

    if (!bounds) {
      return;
    }

    editor.focusCanvasBounds(bounds, {
      paddingX: bounds.width * 0.1,
      paddingY: bounds.height * 0.1,
    });
    return;
  }

  editor.scheduleViewportFocus([nodeId]);
};
