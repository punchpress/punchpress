import { round } from "../primitives/math";

export const DRAG_THRESHOLD_PX = 3;
export const PEN_HANDLE_LENGTH_THRESHOLD = 12;
export const POINT_EPSILON = 0.5;
export const SEGMENT_INSERT_INTERACTION_TOLERANCE_PX = 10;

export interface PenDraftPlacement {
  anchorCanvasPoint: { x: number; y: number };
  anchorLocalPoint: { x: number; y: number };
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
  intent: "add" | "close" | "continue" | "delete";
  nodeId: string;
  role: "anchor" | "segment";
  segmentIndex: number;
}

export const getContourSegmentCount = (node, contourIndex) => {
  if (node?.type !== "vector") {
    return 0;
  }

  return node.contours[contourIndex]?.segments.length || 0;
};

export const getZeroHandle = () => ({ x: 0, y: 0 });

export const isSamePoint = (a, b) => {
  return Math.hypot(a.x - b.x, a.y - b.y) <= POINT_EPSILON;
};

export const roundHandle = (handle) => {
  return {
    x: round(handle.x, 2),
    y: round(handle.y, 2),
  };
};

export const createPlacementSession = (onCancel, onComplete, onUpdate) => {
  return {
    cancel: onCancel,
    complete: onComplete,
    update: onUpdate,
  };
};
