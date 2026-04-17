import {
  canRoundShapePoint,
  getShapeCornerRadiusSummary,
  getShapePointCornerControl,
} from "../../nodes/shape/shape-engine";
import {
  canRoundVectorPoint,
  getEligibleVectorCornerPoints,
  getStableVectorCornerRadiusMax,
  getVectorCornerRadiusSummary,
  getVectorPointCornerControl,
  setAllVectorPointCornerRadii,
  setVectorPointCornerRadius,
} from "../../nodes/vector/vector-corner-controls";
import { clampCornerRadius } from "../../primitives/corner-radius";

const getScopedCornerPoints = (editor, nodeId) => {
  return editor.pathEditingPoints.length > 0 &&
    (!editor.pathEditingNodeId || editor.pathEditingNodeId === nodeId)
    ? editor.pathEditingPoints
    : null;
};

const getScopedCornerSummaryPoints = (editor, nodeId, contours) => {
  const scopedPoints = getScopedCornerPoints(editor, nodeId);

  if (!scopedPoints?.length) {
    return null;
  }

  return getEligibleVectorCornerPoints(contours, scopedPoints).length > 0
    ? scopedPoints
    : null;
};

const getPathContours = (node) => {
  if (node?.type !== "path") {
    return null;
  }

  return [
    {
      closed: node.closed,
      segments: node.segments,
    },
  ];
};

const resolvePathCornerSourceNode = (editor, nodeId, sourceNode) => {
  if (sourceNode?.id === nodeId) {
    return sourceNode;
  }

  return editor.getNode(nodeId);
};

export const canRoundPathPoint = (editor, nodeId, point) => {
  const node = editor.getNode(nodeId);

  if (!point) {
    return false;
  }

  if (node?.type === "shape") {
    return canRoundShapePoint(node, point);
  }

  if (node?.type === "path") {
    return canRoundVectorPoint(getPathContours(node), point);
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

  if (node?.type === "path") {
    return getVectorPointCornerControl(getPathContours(node), point);
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

  if (node.type === "path") {
    const contours = getPathContours(node);

    return getVectorCornerRadiusSummary(
      contours,
      getScopedCornerSummaryPoints(editor, nodeId, contours)
    );
  }

  if (node.type !== "vector") {
    return null;
  }

  return getVectorCornerRadiusSummary(
    node.contours,
    getScopedCornerSummaryPoints(editor, nodeId, node.contours)
  );
};

export const getPathCornerRadiusStableMax = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return 0;
  }

  if (node.type === "shape") {
    return getShapeCornerRadiusSummary(node)?.max || 0;
  }

  if (node.type === "path") {
    const contours = getPathContours(node);

    return getStableVectorCornerRadiusMax(
      contours,
      getScopedCornerSummaryPoints(editor, nodeId, contours)
    );
  }

  if (node.type !== "vector") {
    return 0;
  }

  return getStableVectorCornerRadiusMax(
    node.contours,
    getScopedCornerSummaryPoints(editor, nodeId, node.contours)
  );
};

export const setPathPointCornerRadius = (
  editor,
  nodeId,
  point,
  cornerRadius,
  sourceNode = null
) => {
  const node = resolvePathCornerSourceNode(editor, nodeId, sourceNode);

  if (!(node && point)) {
    return false;
  }

  if (node.type === "shape") {
    const cornerSummary = getShapeCornerRadiusSummary(node);

    if (!(canRoundShapePoint(node, point) && cornerSummary)) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "shape") {
          return currentNode;
        }

        return {
          ...currentNode,
          cornerRadius: clampCornerRadius(cornerRadius, 0, cornerSummary.max),
        };
      });
    });

    return true;
  }

  if (node.type === "path") {
    const nextContours = setVectorPointCornerRadius(
      getPathContours(node),
      point,
      cornerRadius
    );

    if (!nextContours) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "path") {
          return currentNode;
        }

        return {
          ...currentNode,
          closed: nextContours[0].closed,
          segments: nextContours[0].segments,
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

export const setPathCornerRadius = (
  editor,
  nodeId,
  cornerRadius,
  sourceNode = null
) => {
  const node = resolvePathCornerSourceNode(editor, nodeId, sourceNode);

  if (!node) {
    return false;
  }

  if (node.type === "shape") {
    const cornerSummary = getShapeCornerRadiusSummary(node);

    if (!cornerSummary) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "shape") {
          return currentNode;
        }

        return {
          ...currentNode,
          cornerRadius: clampCornerRadius(cornerRadius, 0, cornerSummary.max),
        };
      });
    });

    return true;
  }

  if (node.type === "path") {
    const nextContours = setAllVectorPointCornerRadii(
      getPathContours(node),
      cornerRadius,
      getScopedCornerPoints(editor, nodeId)
    );

    if (!nextContours) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "path") {
          return currentNode;
        }

        return {
          ...currentNode,
          closed: nextContours[0].closed,
          segments: nextContours[0].segments,
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
