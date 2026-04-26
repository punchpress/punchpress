import { buildPathNodeGeometry } from "../../nodes/path/path-engine";
import { getShapePathEditResult } from "../../nodes/shape/shape-engine";
import { buildVectorNodeGeometry } from "../../nodes/vector/vector-engine";
import { getNodeTransformForPinnedWorldPoint } from "../../primitives/rotation";
import { toPathPointKey } from "../../state/store/path/path-point-selection";

export const updateVectorContours = (
  editor,
  nodeId,
  contours,
  {
    pinnedLocalPoint = null,
    pinnedWorldPoint = null,
  }: {
    pinnedLocalPoint?: { x: number; y: number } | null;
    pinnedWorldPoint?: { x: number; y: number } | null;
  } = {}
) => {
  const node = editor.getNode(nodeId);

  if (!(node && contours)) {
    return false;
  }

  if (node.type === "path") {
    const nextContour = contours[0];

    if (!nextContour) {
      return false;
    }

    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "path") {
          return currentNode;
        }

        const nextNode = {
          ...currentNode,
          closed: nextContour.closed,
          segments: nextContour.segments,
        };
        const nextGeometry = buildPathNodeGeometry(nextNode);
        const nextTransform =
          nextGeometry.bbox && pinnedLocalPoint && pinnedWorldPoint
            ? getNodeTransformForPinnedWorldPoint(
                nextNode,
                nextGeometry.bbox,
                pinnedLocalPoint,
                pinnedWorldPoint
              )
            : null;

        return {
          closed: nextContour.closed,
          segments: nextContour.segments,
          transform: nextTransform
            ? {
                ...currentNode.transform,
                ...nextTransform,
              }
            : undefined,
        };
      });
    });

    return true;
  }

  if (node.type !== "vector") {
    return false;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      const nextNode = {
        ...currentNode,
        contours,
      };
      const nextGeometry = buildVectorNodeGeometry(nextNode);
      const nextTransform =
        nextGeometry.bbox && pinnedLocalPoint && pinnedWorldPoint
          ? getNodeTransformForPinnedWorldPoint(
              nextNode,
              nextGeometry.bbox,
              pinnedLocalPoint,
              pinnedWorldPoint
            )
          : null;

      return {
        contours,
        transform: nextTransform
          ? {
              ...currentNode.transform,
              ...nextTransform,
            }
          : undefined,
      };
    });
  });

  return true;
};

export const updateEditablePath = (editor, nodeId, contours, options) => {
  const session = editor.getEditablePathSession(nodeId);

  if (!(session && contours)) {
    return false;
  }

  switch (session.backend) {
    case "vector-path":
      if (session.nodeType === "shape") {
        const node = editor.getNode(nodeId);
        const shapeEditResult =
          node?.type === "shape"
            ? getShapePathEditResult(node, contours, "replace")
            : null;

        if (!shapeEditResult) {
          return false;
        }

        editor.run(() => {
          editor
            .getState()
            .updateNodeById(
              nodeId,
              shapeEditResult.kind === "shape"
                ? shapeEditResult.patch
                : shapeEditResult.node
            );
        });

        return true;
      }

      return updateVectorContours(editor, nodeId, contours, options);
    default:
      return false;
  }
};

export const offsetEditablePathPoints = (contours, points, delta) => {
  const pointKeys = new Set(
    (points || []).map((point) => toPathPointKey(point))
  );

  if (pointKeys.size === 0) {
    return null;
  }

  return contours.map((contour, contourIndex) => {
    return {
      ...contour,
      segments: contour.segments.map((segment, segmentIndex) => {
        if (!pointKeys.has(`${contourIndex}:${segmentIndex}`)) {
          return segment;
        }

        return {
          ...segment,
          point: {
            x: segment.point.x + (delta.x || 0),
            y: segment.point.y + (delta.y || 0),
          },
        };
      }),
    };
  });
};

export const moveSelectedPathPointsBy = (editor, nodeId, delta) => {
  const session = editor.getEditablePathSession(nodeId);
  const points = editor.pathEditingPoints;

  if (!(session?.contours && points.length > 0)) {
    return false;
  }

  const nextContours = offsetEditablePathPoints(
    session.contours,
    points,
    delta
  );

  if (!nextContours) {
    return false;
  }

  return updateEditablePath(editor, nodeId, nextContours);
};
