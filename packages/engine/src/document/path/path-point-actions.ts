import { getShapePathEditResult } from "../../nodes/shape/shape-engine";
import {
  deleteVectorPoint as deleteVectorPointOnContours,
  setVectorPointType as setVectorPointTypeOnContours,
} from "../../nodes/vector/point-edit";
import { insertVectorPoint as insertVectorPointOnContours } from "../../nodes/vector/point-insert";
import { getUniformVectorCornerRadius } from "../../nodes/vector/vector-corner-controls";

export const setVectorPointType = (editor, nodeId, point, pointType) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "vector" && point)) {
    return false;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      return {
        ...currentNode,
        contours: setVectorPointTypeOnContours(currentNode.contours, {
          contourIndex: point.contourIndex,
          pointType,
          segmentIndex: point.segmentIndex,
        }),
      };
    });
  });

  return true;
};

export const insertVectorPoint = (editor, nodeId, target) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "vector" && target)) {
    return false;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      const inheritedCornerRadius = getUniformVectorCornerRadius(
        currentNode.contours
      );
      const nextSegments = target.segments.map((segment, segmentIndex) => {
        if (
          segmentIndex !== target.segmentIndex ||
          typeof inheritedCornerRadius !== "number" ||
          segment.pointType !== "corner"
        ) {
          return segment;
        }

        return {
          ...segment,
          cornerRadius: inheritedCornerRadius,
        };
      });

      return {
        ...currentNode,
        contours: insertVectorPointOnContours(currentNode.contours, {
          ...target,
          segments: nextSegments,
        }),
      };
    });
    editor.getState().setPathEditingPoint({
      contourIndex: target.contourIndex,
      segmentIndex: target.segmentIndex,
    });
  });

  return true;
};

export const insertPathPoint = (editor, nodeId, target) => {
  const session = editor.getEditablePathSession(nodeId);

  if (!(session && target)) {
    return false;
  }

  if (session.nodeType === "shape") {
    const node = editor.getNode(nodeId);
    const nextContour = {
      closed: session.contours[target.contourIndex]?.closed ?? true,
      segments: target.segments,
    };
    const shapeEditResult =
      node?.type === "shape"
        ? getShapePathEditResult(node, [nextContour], "insert")
        : null;

    if (!(shapeEditResult && session.interactionPolicy.canInsertPoint)) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(
        nodeId,
        shapeEditResult.kind === "shape"
          ? shapeEditResult.patch
          : shapeEditResult.node
      );
      editor.getState().setPathEditingPoint({
        contourIndex: target.contourIndex,
        segmentIndex: target.segmentIndex,
      });
    });

    return true;
  }

  return insertVectorPoint(editor, nodeId, target);
};

export const deleteVectorPoint = (editor, nodeId, point) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "vector" && point)) {
    return false;
  }

  const result = deleteVectorPointOnContours(node.contours, {
    contourIndex: point.contourIndex,
    segmentIndex: point.segmentIndex,
  });

  editor.run(() => {
    if (result.contours.length === 0) {
      editor.getState().deleteNodeById(nodeId);
      return;
    }

    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      return {
        ...currentNode,
        contours: result.contours,
      };
    });
    editor.getState().setPathEditingPoint(result.selectedPoint);
  });

  return true;
};

export const deletePathPoint = (editor, nodeId, point) => {
  const session = editor.getEditablePathSession(nodeId);

  if (!(session && point)) {
    return false;
  }

  if (session.nodeType === "shape") {
    const node = editor.getNode(nodeId);

    if (node?.type !== "shape") {
      return false;
    }

    const result = deleteVectorPointOnContours(session.contours, {
      contourIndex: point.contourIndex,
      segmentIndex: point.segmentIndex,
    });
    const shapeEditResult = getShapePathEditResult(node, result.contours, "delete");

    if (!shapeEditResult) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(
        nodeId,
        shapeEditResult.kind === "shape"
          ? shapeEditResult.patch
          : shapeEditResult.node
      );
      editor.getState().setPathEditingPoint(result.selectedPoint);
    });

    return true;
  }

  return deleteVectorPoint(editor, nodeId, point);
};

export const getPathPointType = (editor, nodeId, point) => {
  const session = editor.getEditablePathSession(nodeId);

  if (!point) {
    return null;
  }

  return (
    session?.contours?.[point.contourIndex]?.segments[point.segmentIndex]
      ?.pointType || null
  );
};

export const setPathPointType = (editor, nodeId, point, pointType) => {
  const session = editor.getEditablePathSession(nodeId);

  if (!(session?.contours && point)) {
    return false;
  }

  if (session.nodeType === "shape") {
    const node = editor.getNode(nodeId);

    if (node?.type !== "shape") {
      return false;
    }

    const nextContours = setVectorPointTypeOnContours(session.contours, {
      contourIndex: point.contourIndex,
      pointType,
      segmentIndex: point.segmentIndex,
    });
    const shapeEditResult = getShapePathEditResult(
      node,
      nextContours,
      "point-type"
    );

    if (!shapeEditResult) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(
        nodeId,
        shapeEditResult.kind === "shape"
          ? shapeEditResult.patch
          : shapeEditResult.node
      );
    });

    return true;
  }

  return setVectorPointType(editor, nodeId, point, pointType);
};
