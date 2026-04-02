import { getVectorBezierHandleAppearance } from "./handle-appearance";

interface VectorPoint {
  x: number;
  y: number;
}

interface VectorSegment {
  handleIn: VectorPoint;
  handleOut: VectorPoint;
  point: VectorPoint;
}

interface VectorContour {
  closed: boolean;
  segments: VectorSegment[];
}

export interface PenPreviewTarget {
  segmentIndex: number;
  type: "start-anchor";
}

export interface PenPreviewState {
  contourIndex: number;
  handleIn?: VectorPoint;
  kind: "segment";
  nodeId: string;
  pointer: VectorPoint;
  target: PenPreviewTarget | null;
}

export const getPenPreviewHandleAppearance = () => {
  return getVectorBezierHandleAppearance();
};

export const getPenPreviewEndpoint = (
  contour: VectorContour,
  preview: PenPreviewState
) => {
  if (preview.target?.type !== "start-anchor") {
    return preview.pointer;
  }

  return contour.segments[preview.target.segmentIndex]?.point || null;
};

export const getPenPreviewHandleIn = (
  contour: VectorContour,
  preview: PenPreviewState
) => {
  if (preview.handleIn) {
    return preview.handleIn;
  }

  if (preview.target?.type === "start-anchor") {
    return contour.segments[preview.target.segmentIndex]?.handleIn || null;
  }

  return null;
};

export const getPenPreviewHandleOut = (preview: PenPreviewState) => {
  if (!preview.handleIn) {
    return null;
  }

  return {
    x: -preview.handleIn.x,
    y: -preview.handleIn.y,
  };
};

export const shouldShowPenPreviewHandles = (preview: PenPreviewState) => {
  return Boolean(preview.handleIn) && preview.target?.type !== "start-anchor";
};

export const shouldShowPenPreviewGhostAnchor = (preview: PenPreviewState) => {
  return shouldShowPenPreviewHandles(preview);
};
