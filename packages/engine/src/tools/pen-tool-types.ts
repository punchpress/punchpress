import { round } from "../primitives/math";
import {
  isPointerDistanceAtLeast,
  isPointerDistanceWithin,
} from "../primitives/pointer-distance";

export const DRAG_THRESHOLD_PX = 3;
export const PEN_HANDLE_LENGTH_THRESHOLD = 12;
export const POINT_EPSILON = 0.5;
export const SEGMENT_INSERT_INTERACTION_TOLERANCE_PX = 10;
export type PenHoverIntent =
  | "add"
  | "close"
  | "continue"
  | "convert-to-corner"
  | "convert-to-smooth"
  | "delete";

export interface PenDraftPlacement {
  anchorCanvasPoint: { x: number; y: number };
  anchorLocalPoint: { x: number; y: number };
  currentCanvasPoint: { x: number; y: number };
  dragHandle: { x: number; y: number } | null;
  kind: "first-point" | "next-point";
  target: null | {
    segmentIndex: number;
    type: "start-anchor";
  };
}

export interface PenAuthoringSession {
  contourIndex: number;
  draft: PenDraftPlacement | null;
  hasAuthoredChange: boolean;
  hasPlacedInitialPoint: boolean;
  historyMark: unknown;
  hoverPoint: { x: number; y: number } | null;
  hoverTarget: PenDraftPlacement["target"];
  nodeId: string;
}

export interface PenHoverState {
  contourIndex: number;
  intent: PenHoverIntent;
  nodeId: string;
  point: { x: number; y: number };
  role: "anchor" | "segment";
  segmentIndex: number;
}

export const isPenEditableNode = (node) => {
  return node?.type === "path";
};

export const isPenSelectionActive = (editor, node) => {
  if (!isPenEditableNode(node)) {
    return false;
  }

  return editor.selectedNodeIds.some((selectedNodeId) => {
    return (
      selectedNodeId === node.id || editor.isDescendantOf(node.id, selectedNodeId)
    );
  });
};

export const getNodeContours = (node) => {
  if (node?.type === "path") {
    return [
      {
        closed: node.closed,
        segments: node.segments,
      },
    ];
  }

  if (node?.type === "vector") {
    return node.contours;
  }

  return null;
};

export const getNodeContour = (node, contourIndex) => {
  return getNodeContours(node)?.[contourIndex] || null;
};

export const getContourSegmentCount = (node, contourIndex) => {
  return getNodeContour(node, contourIndex)?.segments.length || 0;
};

export const getZeroHandle = () => ({ x: 0, y: 0 });

export const isSamePoint = (a, b) => {
  return isPointerDistanceWithin(a, b, POINT_EPSILON);
};

export const roundHandle = (handle) => {
  return {
    x: round(handle.x, 2),
    y: round(handle.y, 2),
  };
};

export const getPenDragHandle = ({
  anchorCanvasPoint,
  anchorLocalPoint,
  currentCanvasPoint,
  currentLocalPoint,
}) => {
  if (
    !isPointerDistanceAtLeast(
      anchorCanvasPoint,
      currentCanvasPoint,
      PEN_HANDLE_LENGTH_THRESHOLD
    )
  ) {
    return null;
  }

  return roundHandle({
    x: currentLocalPoint.x - anchorLocalPoint.x,
    y: currentLocalPoint.y - anchorLocalPoint.y,
  });
};

export const createPlacementSession = (onCancel, onComplete, onUpdate) => {
  return {
    cancel: onCancel,
    complete: onComplete,
    update: onUpdate,
  };
};
