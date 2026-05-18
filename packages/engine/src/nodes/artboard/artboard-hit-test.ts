import { isArtboardNode } from "../node-tree";

export const containsPoint = (bounds, point) => {
  return Boolean(
    bounds &&
      point &&
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY
  );
};

export const getTopmostArtboardAtPoint = (
  editor,
  point,
  excludedNodeIds = new Set()
) => {
  return (
    [...editor.nodes].reverse().find((node) => {
      if (
        !isArtboardNode(node) ||
        excludedNodeIds.has(node.id) ||
        !editor.isNodeEffectivelyVisible(node.id)
      ) {
        return false;
      }

      return containsPoint(editor.getNodeRenderFrame(node.id)?.bounds, point);
    }) || null
  );
};
