import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { finishEditingIfNeeded } from "../../editing/editing-actions";
import {
  getPathNodeContours,
  withPathNodeContours,
} from "../../nodes/path/path-contours";
import { createId } from "../../nodes/text/model";
import {
  getLocalPointFromTransformFrame,
  getNodeTransformFrame,
  getWorldPointFromTransformFrame,
  rotateVector,
} from "../../primitives/rotation";
import { getPathContourJoinResult } from "./path-topology-actions";

const cloneHandle = (handle) => ({ x: handle.x, y: handle.y });

const cloneSegment = (segment) => ({
  ...segment,
  handleIn: cloneHandle(segment.handleIn),
  handleOut: cloneHandle(segment.handleOut),
  point: cloneHandle(segment.point),
});

const cloneContour = (contour) => ({
  ...contour,
  segments: contour.segments.map(cloneSegment),
});

const getSelectedPathNodes = (editor, nodeIds) => {
  return nodeIds
    .map((nodeId) => editor.getNode(nodeId))
    .filter((node) => node?.type === "path");
};

const hasSameParent = (nodes) => {
  const parentId = nodes[0]?.parentId;

  return Boolean(parentId && nodes.every((node) => node.parentId === parentId));
};

const getPathTransformFrame = (editor, node) => {
  const bbox = editor.getNodeGeometry(node.id)?.bbox;

  return bbox ? getNodeTransformFrame(node, bbox) : null;
};

const transformVectorBetweenFrames = (vector, sourceFrame, targetFrame) => {
  const rotated = rotateVector(
    {
      x: vector.x * sourceFrame.scaleX,
      y: vector.y * sourceFrame.scaleY,
    },
    sourceFrame.rotation
  );
  const unrotated = rotateVector(rotated, -targetFrame.rotation);

  return {
    x: unrotated.x / (targetFrame.scaleX || 1),
    y: unrotated.y / (targetFrame.scaleY || 1),
  };
};

const transformSegmentBetweenNodes = (
  segment,
  sourceFrame,
  targetFrame
) => {
  const worldPoint = getWorldPointFromTransformFrame(
    sourceFrame,
    segment.point
  );
  const point = getLocalPointFromTransformFrame(targetFrame, worldPoint);

  return {
    ...segment,
    handleIn: transformVectorBetweenFrames(
      segment.handleIn,
      sourceFrame,
      targetFrame
    ),
    handleOut: transformVectorBetweenFrames(
      segment.handleOut,
      sourceFrame,
      targetFrame
    ),
    point,
  };
};

const transformContourBetweenNodes = (contour, sourceFrame, targetFrame) => {
  return {
    ...cloneContour(contour),
    segments: contour.segments.map((segment) => {
      return transformSegmentBetweenNodes(segment, sourceFrame, targetFrame);
    }),
  };
};

const getContoursInTargetNodeSpace = (editor, targetNode, pathNodes) => {
  const targetFrame = getPathTransformFrame(editor, targetNode);

  if (!targetFrame) {
    return null;
  }

  const contours: ReturnType<typeof cloneContour>[] = [];

  for (const pathNode of pathNodes) {
    const sourceFrame = getPathTransformFrame(editor, pathNode);

    if (!sourceFrame) {
      return null;
    }

    for (const contour of getPathNodeContours(pathNode)) {
      contours.push(
        pathNode.id === targetNode.id
          ? cloneContour(contour)
          : transformContourBetweenNodes(contour, sourceFrame, targetFrame)
      );
    }
  }

  return contours;
};

const getMergeablePathSelection = (editor, nodeIds) => {
  const pathNodes = getSelectedPathNodes(editor, nodeIds);

  return pathNodes.length >= 2 &&
    pathNodes.length === nodeIds.length &&
    hasSameParent(pathNodes)
    ? pathNodes
    : null;
};

const getSeparatablePathSelection = (editor, nodeIds) => {
  if (nodeIds.length !== 1) {
    return null;
  }

  const pathNode = editor.getNode(nodeIds[0]);

  return pathNode?.type === "path" && getPathNodeContours(pathNode).length > 1
    ? pathNode
    : null;
};

const getOpenPathEndpointPoints = (contours) => {
  return contours.flatMap((contour, contourIndex) => {
    if (contour.closed || contour.segments.length < 2) {
      return [];
    }

    return [
      { contourIndex, segmentIndex: 0 },
      {
        contourIndex,
        segmentIndex: contour.segments.length - 1,
      },
    ];
  });
};

const getPointDistance = (left, right) => {
  return Math.hypot(left.x - right.x, left.y - right.y);
};

const getNearestEndpointPair = (contours) => {
  const endpoints = getOpenPathEndpointPoints(contours);
  let nearestPair = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const firstPoint of endpoints) {
    for (const secondPoint of endpoints) {
      if (firstPoint.contourIndex === secondPoint.contourIndex) {
        continue;
      }

      const firstSegment =
        contours[firstPoint.contourIndex]?.segments[firstPoint.segmentIndex];
      const secondSegment =
        contours[secondPoint.contourIndex]?.segments[secondPoint.segmentIndex];

      if (!(firstSegment && secondSegment)) {
        continue;
      }

      const distance = getPointDistance(firstSegment.point, secondSegment.point);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPair = [firstPoint, secondPoint];
      }
    }
  }

  return nearestPair;
};

const getJoinablePathSelection = (editor, nodeIds) => {
  const pathNodes = getMergeablePathSelection(editor, nodeIds);

  if (pathNodes?.length !== 2) {
    return null;
  }

  const targetNode = pathNodes[0];
  const contours = getContoursInTargetNodeSpace(editor, targetNode, pathNodes);
  const points = contours ? getNearestEndpointPair(contours) : null;
  const result = points ? getPathContourJoinResult(contours, points) : null;

  return result ? { pathNodes, result, targetNode } : null;
};

export const canMergeCurves = (editor, nodeIds = editor.selectedNodeIds) => {
  return Boolean(getMergeablePathSelection(editor, nodeIds));
};

export const mergeCurves = (editor, nodeIds = editor.selectedNodeIds) => {
  const pathNodes = getMergeablePathSelection(editor, nodeIds);

  if (!pathNodes) {
    return false;
  }

  const targetNode = pathNodes[0];
  const contours = getContoursInTargetNodeSpace(editor, targetNode, pathNodes);

  if (!contours) {
    return false;
  }

  finishEditingIfNeeded(editor);
  editor.run(() => {
    editor.getState().replaceNodeBlocks(
      pathNodes.map((pathNode) => pathNode.id),
      [
        withPathNodeContours(targetNode, contours),
      ]
    );
    editor.setSelectedNodes([targetNode.id]);
  });

  return true;
};

export const canSeparateCurves = (editor, nodeIds = editor.selectedNodeIds) => {
  return Boolean(getSeparatablePathSelection(editor, nodeIds));
};

export const separateCurves = (editor, nodeIds = editor.selectedNodeIds) => {
  const pathNode = getSeparatablePathSelection(editor, nodeIds);

  if (!pathNode) {
    return false;
  }

  const contours = getPathNodeContours(pathNode);

  finishEditingIfNeeded(editor);
  editor.run(() => {
    const separatedPathNodes = contours.map((contour, index) => {
      return {
        ...withPathNodeContours(pathNode, [cloneContour(contour)]),
        id: index === 0 ? pathNode.id : createId(),
        parentId: pathNode.parentId || ROOT_PARENT_ID,
      };
    });

    editor.getState().replaceNodeBlocks([pathNode.id], separatedPathNodes);
    editor.setSelectedNodes(separatedPathNodes.map((node) => node.id));
  });

  return true;
};

export const canJoinCurves = (editor, nodeIds = editor.selectedNodeIds) => {
  return Boolean(getJoinablePathSelection(editor, nodeIds));
};

export const joinCurves = (editor, nodeIds = editor.selectedNodeIds) => {
  const selection = getJoinablePathSelection(editor, nodeIds);

  if (!selection) {
    return false;
  }

  finishEditingIfNeeded(editor);
  editor.run(() => {
    editor.getState().replaceNodeBlocks(
      selection.pathNodes.map((pathNode) => pathNode.id),
      [
        withPathNodeContours(selection.targetNode, selection.result.contours),
      ]
    );
    editor.setSelectedNodes([selection.targetNode.id]);
  });

  return true;
};
