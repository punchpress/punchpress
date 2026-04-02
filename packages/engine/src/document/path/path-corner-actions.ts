import {
  canRoundShapePoint,
  getShapeCornerRadiusSummary,
  getShapePointCornerControl,
} from "../../nodes/shape/shape-engine";
import {
  canRoundVectorPoint,
  getVectorCornerRadiusSummary,
  getVectorPointCornerControl,
  setAllVectorPointCornerRadii,
  setVectorPointCornerRadius,
} from "../../nodes/vector/vector-corner-controls";

const getScopedCornerPoints = (editor, nodeId) => {
  return editor.pathEditingNodeId === nodeId && editor.pathEditingPoints.length > 0
    ? editor.pathEditingPoints
    : null;
};

export const canRoundPathPoint = (editor, nodeId, point) => {
  const node = editor.getNode(nodeId);

  if (!point) {
    return false;
  }

  if (node?.type === "shape") {
    return canRoundShapePoint(node, point);
  }

  if (node?.type !== "vector") {
    return false;
  }

  return canRoundVectorPoint(node.contours, point);
};

export const getPathPointCornerControl = (editor, nodeId, point) => {
  const node = editor.getNode(nodeId);

  if (!point) {
    return null;
  }

  if (node?.type === "shape") {
    return getShapePointCornerControl(node, point);
  }

  if (node?.type !== "vector") {
    return null;
  }

  return getVectorPointCornerControl(node.contours, point);
};

export const getPathPointCornerRadius = (editor, nodeId, point) => {
  return getPathPointCornerControl(editor, nodeId, point)?.currentRadius ?? 0;
};

export const getPathCornerRadiusSummary = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  if (node.type === "shape") {
    return getShapeCornerRadiusSummary(node);
  }

  if (node.type !== "vector") {
    return null;
  }

  return getVectorCornerRadiusSummary(
    node.contours,
    getScopedCornerPoints(editor, nodeId)
  );
};

export const setPathPointCornerRadius = (
  editor,
  nodeId,
  point,
  cornerRadius
) => {
  const node = editor.getNode(nodeId);

  if (!(node && point)) {
    return false;
  }

  if (node.type === "shape") {
    if (!canRoundShapePoint(node, point)) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "shape") {
          return currentNode;
        }

        return {
          ...currentNode,
          cornerRadius: Math.max(0, cornerRadius || 0),
        };
      });
    });

    return true;
  }

  if (node.type !== "vector") {
    return false;
  }

  const nextContours = setVectorPointCornerRadius(
    node.contours,
    point,
    cornerRadius
  );

  if (!nextContours) {
    return false;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      return {
        ...currentNode,
        contours: nextContours,
      };
    });
  });

  return true;
};

export const setPathCornerRadius = (editor, nodeId, cornerRadius) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return false;
  }

  if (node.type === "shape") {
    if (!getShapeCornerRadiusSummary(node)) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "shape") {
          return currentNode;
        }

        return {
          ...currentNode,
          cornerRadius: Math.max(0, cornerRadius || 0),
        };
      });
    });

    return true;
  }

  if (node.type !== "vector") {
    return false;
  }

  const nextContours = setAllVectorPointCornerRadii(
    node.contours,
    cornerRadius,
    getScopedCornerPoints(editor, nodeId)
  );

  if (!nextContours) {
    return false;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      return {
        ...currentNode,
        contours: nextContours,
      };
    });
  });

  return true;
};
