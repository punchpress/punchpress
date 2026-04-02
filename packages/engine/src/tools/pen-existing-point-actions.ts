import { VECTOR_ANCHOR_INTERACTION_RADIUS_PX } from "../nodes/vector/interaction-constants";
import {
  findVectorPathInsertTarget,
  splitVectorContourAtParameter,
} from "../nodes/vector/point-insert";
import { getNodeLocalPoint, getNodeWorldPoint } from "../primitives/rotation";
import { SEGMENT_INSERT_INTERACTION_TOLERANCE_PX } from "./pen-tool-types";

export const getSelectedEndpointContinuationTarget = (editor) => {
  const nodeId = editor.pathEditingNodeId;
  const point = editor.pathEditingPoint;

  if (!(nodeId && point)) {
    return null;
  }

  const node = editor.getNode(nodeId);

  if (
    !(
      node?.type === "vector" &&
      editor.selectedNodeId === nodeId &&
      editor.isSelected(nodeId)
    )
  ) {
    return null;
  }

  const contour = node.contours[point.contourIndex];

  if (!(contour && !contour.closed && contour.segments.length > 0)) {
    return null;
  }

  if (point.segmentIndex === 0) {
    return {
      node,
      target: {
        contourIndex: point.contourIndex,
        endpoint: "start" as const,
        segmentIndex: 0,
      },
    };
  }

  if (point.segmentIndex === contour.segments.length - 1) {
    return {
      node,
      target: {
        contourIndex: point.contourIndex,
        endpoint: "end" as const,
        segmentIndex: point.segmentIndex,
      },
    };
  }

  return null;
};

export const getExistingPointActionNode = (editor, nodeId) => {
  if (!nodeId) {
    return null;
  }

  const node = editor.getNode(nodeId);

  if (!(node?.type === "vector" && editor.isSelected(node.id))) {
    return null;
  }

  return node;
};

export const resolveContinuationTarget = (editor, node, point) => {
  if (!(node?.type === "vector" && editor.isSelected(node.id))) {
    return null;
  }

  const bbox = editor.getNodeGeometry(node.id)?.bbox;

  if (!bbox) {
    return null;
  }

  const closeDistance =
    VECTOR_ANCHOR_INTERACTION_RADIUS_PX / Math.max(editor.zoom || 1, 1);
  let closestTarget = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const [contourIndex, contour] of node.contours.entries()) {
    if (contour.closed || contour.segments.length === 0) {
      continue;
    }

    const startWorldPoint = getNodeWorldPoint(
      node,
      bbox,
      contour.segments[0].point
    );
    const endSegmentIndex = contour.segments.length - 1;
    const endWorldPoint = getNodeWorldPoint(
      node,
      bbox,
      contour.segments[endSegmentIndex].point
    );

    for (const candidate of [
      {
        distance: Math.hypot(
          point.x - startWorldPoint.x,
          point.y - startWorldPoint.y
        ),
        endpoint: "start" as const,
        segmentIndex: 0,
      },
      {
        distance: Math.hypot(
          point.x - endWorldPoint.x,
          point.y - endWorldPoint.y
        ),
        endpoint: "end" as const,
        segmentIndex: endSegmentIndex,
      },
    ]) {
      if (
        candidate.distance > closeDistance ||
        candidate.distance >= closestDistance
      ) {
        continue;
      }

      closestDistance = candidate.distance;
      closestTarget = {
        contourIndex,
        endpoint: candidate.endpoint,
        segmentIndex: candidate.segmentIndex,
      };
    }
  }

  return closestTarget;
};

export const resolveDeletePointTarget = (editor, node, point) => {
  if (
    !(
      node?.type === "vector" &&
      editor.isSelected(node.id) &&
      editor.pathEditingNodeId === node.id
    )
  ) {
    return null;
  }

  const bbox = editor.getNodeGeometry(node.id)?.bbox;

  if (!bbox) {
    return null;
  }

  const closeDistance =
    VECTOR_ANCHOR_INTERACTION_RADIUS_PX / Math.max(editor.zoom || 1, 1);
  let closestTarget = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const [contourIndex, contour] of node.contours.entries()) {
    for (const [segmentIndex, segment] of contour.segments.entries()) {
      const isEndpoint =
        !contour.closed &&
        (segmentIndex === 0 || segmentIndex === contour.segments.length - 1);

      if (isEndpoint) {
        continue;
      }

      const worldPoint = getNodeWorldPoint(node, bbox, segment.point);
      const distance = Math.hypot(point.x - worldPoint.x, point.y - worldPoint.y);

      if (distance > closeDistance || distance >= closestDistance) {
        continue;
      }

      closestDistance = distance;
      closestTarget = {
        contourIndex,
        segmentIndex,
      };
    }
  }

  return closestTarget;
};

export const resolveInsertPointTarget = (editor, node, point) => {
  if (
    !(
      node?.type === "vector" &&
      editor.isSelected(node.id) &&
      editor.pathEditingNodeId === node.id
    )
  ) {
    return null;
  }

  const bbox = editor.getNodeGeometry(node.id)?.bbox;

  if (!bbox) {
    return null;
  }

  const interactionScale = Math.max(
    Math.abs(node.transform.scaleX || 1),
    Math.abs(node.transform.scaleY || 1),
    0.001
  );
  const localPoint = getNodeLocalPoint(node, bbox, point);
  const target = findVectorPathInsertTarget(
    node.contours,
    localPoint,
    SEGMENT_INSERT_INTERACTION_TOLERANCE_PX /
      (Math.max(editor.zoom || 1, 1) * interactionScale)
  );

  if (!target) {
    return null;
  }

  return splitVectorContourAtParameter(
    node.contours[target.contourIndex],
    target
  );
};
