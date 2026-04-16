import { getShapePathEditResult } from "../../nodes/shape/shape-engine";
import {
  deleteVectorPoint as deleteVectorPointOnContours,
  setVectorPointType as setVectorPointTypeOnContours,
} from "../../nodes/vector/point-edit";
import { insertVectorPoint as insertVectorPointOnContours } from "../../nodes/vector/point-insert";
import {
  getUniformVectorCornerRadius,
  setVectorPointCornerRadius,
} from "../../nodes/vector/vector-corner-controls";

const toDescendingDeletionOrder = (points) => {
  return [...(points || [])].sort((a, b) => {
    if (a.contourIndex !== b.contourIndex) {
      return b.contourIndex - a.contourIndex;
    }

    return b.segmentIndex - a.segmentIndex;
  });
};

const deleteSelectedPointsFromContours = (contours, points) => {
  let nextContours = contours;
  let selectedPoint: { contourIndex: number; segmentIndex: number } | null =
    null;
  let didDelete = false;

  for (const point of toDescendingDeletionOrder(points)) {
    const result = deleteVectorPointOnContours(nextContours, {
      contourIndex: point.contourIndex,
      segmentIndex: point.segmentIndex,
    });

    if (result.contours === nextContours) {
      continue;
    }

    nextContours = result.contours;
    selectedPoint = result.selectedPoint;
    didDelete = true;
  }

  return {
    contours: nextContours,
    didDelete,
    selectedPoint,
  };
};

export const setVectorPointType = (editor, nodeId, point, pointType) => {
  const node = editor.getNode(nodeId);

  if (!(node && point)) {
    return false;
  }

  if (node.type === "path") {
    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "path") {
          return currentNode;
        }

        return {
          ...currentNode,
          segments: setVectorPointTypeOnContours(
            [
              {
                closed: currentNode.closed,
                segments: currentNode.segments,
              },
            ],
            {
              contourIndex: 0,
              pointType,
              segmentIndex: point.segmentIndex,
            }
          )[0].segments,
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

export const setVectorPointTypes = (editor, nodeId, points, pointType) => {
  const node = editor.getNode(nodeId);

  if (!(node && points?.length > 0)) {
    return false;
  }

  if (node.type === "path") {
    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "path") {
          return currentNode;
        }

        const contours = points.reduce((nextContours, point) => {
          return setVectorPointTypeOnContours(nextContours, {
            contourIndex: 0,
            pointType,
            segmentIndex: point.segmentIndex,
          });
        }, [
          {
            closed: currentNode.closed,
            segments: currentNode.segments,
          },
        ]);

        return {
          ...currentNode,
          closed: contours[0].closed,
          segments: contours[0].segments,
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

      const contours = points.reduce((nextContours, point) => {
        return setVectorPointTypeOnContours(nextContours, {
          contourIndex: point.contourIndex,
          pointType,
          segmentIndex: point.segmentIndex,
        });
      }, currentNode.contours);

      return {
        ...currentNode,
        contours,
      };
    });
  });

  return true;
};

export const insertVectorPoint = (editor, nodeId, target) => {
  const node = editor.getNode(nodeId);

  if (!(node && target)) {
    return false;
  }

  if (node.type === "path") {
    editor.run(() => {
      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "path") {
          return currentNode;
        }

        const baseContours = [
          {
            closed: currentNode.closed,
            segments: currentNode.segments,
          },
        ];
        const inheritedCornerRadius = getUniformVectorCornerRadius(baseContours);
        const insertedContours = insertVectorPointOnContours(baseContours, {
          ...target,
          contourIndex: 0,
          segments: target.segments,
        });
        const roundedContours =
          typeof inheritedCornerRadius === "number" &&
          target.segments[target.segmentIndex]?.pointType === "corner"
            ? setVectorPointCornerRadius(
                insertedContours,
                {
                  contourIndex: 0,
                  segmentIndex: target.segmentIndex,
                },
                inheritedCornerRadius
              ) || insertedContours
            : insertedContours;

        return {
          ...currentNode,
          closed: roundedContours[0].closed,
          segments: roundedContours[0].segments,
        };
      });
      editor.getState().setPathEditingPoint({
        contourIndex: 0,
        segmentIndex: target.segmentIndex,
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

      const inheritedCornerRadius = getUniformVectorCornerRadius(
        currentNode.contours
      );
      const insertedContours = insertVectorPointOnContours(
        currentNode.contours,
        {
          ...target,
          segments: target.segments,
        }
      );
      const roundedContours =
        typeof inheritedCornerRadius === "number" &&
        target.segments[target.segmentIndex]?.pointType === "corner"
          ? setVectorPointCornerRadius(
              insertedContours,
              {
                contourIndex: target.contourIndex,
                segmentIndex: target.segmentIndex,
              },
              inheritedCornerRadius
            ) || insertedContours
          : insertedContours;

      return {
        ...currentNode,
        contours: roundedContours,
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
      editor
        .getState()
        .updateNodeById(
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

  if (!(node && point)) {
    return false;
  }

  if (node.type === "path") {
    const result = deleteVectorPointOnContours(
      [
        {
          closed: node.closed,
          segments: node.segments,
        },
      ],
      {
        contourIndex: 0,
        segmentIndex: point.segmentIndex,
      }
    );

    editor.run(() => {
      if (result.contours.length === 0) {
        editor.getState().deleteNodeById(nodeId);
        return;
      }

      editor.getState().updateNodeById(nodeId, (currentNode) => {
        if (currentNode.type !== "path") {
          return currentNode;
        }

        return {
          ...currentNode,
          closed: result.contours[0].closed,
          segments: result.contours[0].segments,
        };
      });
      editor.getState().setPathEditingPoint(result.selectedPoint);
    });

    return true;
  }

  if (node.type !== "vector") {
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
    const shapeEditResult = getShapePathEditResult(
      node,
      result.contours,
      "delete"
    );

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
      editor.getState().setPathEditingPoint(result.selectedPoint);
    });

    return true;
  }

  return deleteVectorPoint(editor, nodeId, point);
};

export const deletePathPoints = (editor, nodeId, points) => {
  const session = editor.getEditablePathSession(nodeId);

  if (!(session && points?.length > 0)) {
    return false;
  }

  if (session.nodeType === "shape") {
    const node = editor.getNode(nodeId);

    if (node?.type !== "shape") {
      return false;
    }

    const result = deleteSelectedPointsFromContours(session.contours, points);
    const shapeEditResult = result.didDelete
      ? getShapePathEditResult(node, result.contours, "delete")
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
      editor.getState().setPathEditingPoint(result.selectedPoint);
    });

    return true;
  }

  const node = editor.getNode(nodeId);

  if (node?.type !== "vector") {
    return false;
  }

  const result = deleteSelectedPointsFromContours(session.contours, points);

  if (!result.didDelete) {
    return false;
  }

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

  return setVectorPointType(editor, nodeId, point, pointType);
};

export const setPathPointTypes = (editor, nodeId, points, pointType) => {
  const session = editor.getEditablePathSession(nodeId);

  if (!(session?.contours && points?.length > 0)) {
    return false;
  }

  if (session.nodeType === "shape") {
    const node = editor.getNode(nodeId);

    if (node?.type !== "shape") {
      return false;
    }

    const nextContours = points.reduce((currentContours, point) => {
      return setVectorPointTypeOnContours(currentContours, {
        contourIndex: point.contourIndex,
        pointType,
        segmentIndex: point.segmentIndex,
      });
    }, session.contours);
    const shapeEditResult = getShapePathEditResult(
      node,
      nextContours,
      "point-type"
    );

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

  return setVectorPointTypes(editor, nodeId, points, pointType);
};
