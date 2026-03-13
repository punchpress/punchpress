import { round } from "../../../editor/primitives/math";
import { estimateBounds } from "../../../editor/shapes/warp-text/warp-layout";

export const applySingleDragUpdate = (editor, nodeId, dragEvent) => {
  if (!(nodeId && dragEvent)) {
    return;
  }

  const node = editor.getNode(nodeId);
  if (!node) {
    return;
  }

  const bbox = editor.getNodeGeometry(nodeId)?.bbox || estimateBounds(node);

  editor.updateNode(nodeId, {
    transform: {
      x: round(dragEvent.left - bbox.minX, 2),
      y: round(dragEvent.top - bbox.minY, 2),
    },
  });
};

export const applyGroupDragUpdate = (editor, nodeIds, dragEvents) => {
  if (!(nodeIds.length > 0 && dragEvents.length > 0)) {
    return;
  }

  editor.updateNodes(nodeIds, (node) => {
    const groupEvent = dragEvents.find(
      (item) => item.target?.dataset.nodeId === node.id
    );

    if (!groupEvent) {
      return node;
    }

    const bbox =
      groupEvent.datas?.bbox ||
      editor.getNodeGeometry(node.id)?.bbox ||
      estimateBounds(node);

    return {
      transform: {
        x: round(groupEvent.left - bbox.minX, 2),
        y: round(groupEvent.top - bbox.minY, 2),
      },
    };
  });
};
