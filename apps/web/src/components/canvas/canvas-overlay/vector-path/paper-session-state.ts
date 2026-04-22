import type { Editor } from "@punchpress/engine";
import type { VectorContourDocument } from "@punchpress/punch-schema";
import type paper from "paper";
import type { VectorEndpointDragTarget } from "./endpoint-close";
import {
  getSceneStyles,
  type VectorSegmentChrome,
} from "./paper-session-render";
import type { PenPreviewState } from "./pen-preview";
import type {
  VectorCornerDragSession,
  VectorPathPoint,
} from "./vector-corner-drag-session";

export type HoveredPoint =
  | (VectorPathPoint & {
      role: "anchor" | "handle-in" | "handle-out";
    })
  | null;

export type PenHoverTarget = {
  contourIndex: number;
  intent: "add" | "close" | "continue" | "delete";
  point: { x: number; y: number };
  role: "anchor" | "segment";
  segmentIndex: number;
} | null;

export type PendingPress =
  | {
      additive: boolean;
      origin: paper.Point;
      type: "empty";
    }
  | {
      origin: paper.Point;
      contourIndex: number;
      role: "anchor" | "handle-in" | "handle-out";
      segmentIndex: number;
      type: "point";
    }
  | {
      contourIndex: number;
      curveIndex: number;
      offset: number;
      type: "insert";
    }
  | {
      type: "body";
    };

export type ActivePointDrag = Extract<PendingPress, { type: "point" }>;

export interface VectorPaperSessionInteractionPolicy {
  canInsertPoint: boolean;
}

export interface VectorPaperSessionSyncOptions {
  pinnedLocalPoint?: { x: number; y: number } | null;
  pinnedWorldPoint?: { x: number; y: number } | null;
}

export interface VectorPaperSessionScene {
  activeDragSession?: VectorCornerDragSession | null;
  contours: VectorContourDocument[];
  hoveredCornerHandlePoint?: VectorPathPoint | null;
  interactionPolicy?: VectorPaperSessionInteractionPolicy | null;
  isPanning?: boolean;
  matrix: {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
  };
  metrics: {
    height: number;
    width: number;
  };
  nodeStrokeWidth?: number;
  penHover?: PenHoverTarget;
  penPreview?: PenPreviewState | null;
  selectedPoint?: VectorPathPoint | null;
  selectedPoints?: VectorPathPoint[];
}

export interface VectorPaperSessionOptions {
  canvas: HTMLCanvasElement;
  editor: Editor;
  nodeId: string;
  onChange: (
    contours: VectorContourDocument[],
    options?: VectorPaperSessionSyncOptions
  ) => void;
  onExitPathEditing: () => void;
  onHistoryCommit: (historyMark: unknown) => void;
  onHistoryStart: () => unknown;
}

export const createVectorPaperSessionState = (scope: paper.PaperScope) => {
  return {
    activeDrag: null as ActivePointDrag | null,
    activeDragSession: null as VectorCornerDragSession | null,
    chrome: [] as VectorSegmentChrome[][],
    contours: [] as VectorContourDocument[],
    dragCanvasPoint: null as { x: number; y: number } | null,
    endpointDragTarget: null as VectorEndpointDragTarget | null,
    historyMark: null as unknown,
    hoveredCornerHandlePoint: null as VectorPathPoint | null,
    hoveredCurvePath: null as paper.Path | null,
    hoveredPoint: null as HoveredPoint,
    interactionPolicy: {
      canInsertPoint: true,
    } satisfies VectorPaperSessionInteractionPolicy,
    inverseMatrix: null as paper.Matrix | null,
    isGeometryDragging: false,
    isPanning: false,
    localPaths: [] as paper.Path[],
    matrix: null as VectorPaperSessionScene["matrix"] | null,
    maxedCurvePaths: [] as paper.Path[],
    nodeDragSession: null as ReturnType<Editor["beginSelectionDrag"]> | null,
    nodeStrokeWidth: 0,
    paths: [] as paper.Path[],
    pendingPress: null as PendingPress | null,
    pendingScene: null as VectorPaperSessionScene | null,
    penHover: null as PenHoverTarget,
    previewAnchor: null as paper.Path.Circle | null,
    previewHandleIn: null as paper.Path.Circle | null,
    previewHandleInLine: null as paper.Path | null,
    previewHandleOut: null as paper.Path.Circle | null,
    previewHandleOutLine: null as paper.Path | null,
    previewPath: null as paper.Path | null,
    selectedPoint: null as VectorPathPoint | null,
    selectedPoints: [] as VectorPathPoint[],
    selectionMarquee: null as {
      additive: boolean;
      current: paper.Point;
      origin: paper.Point;
    } | null,
    selectionMarqueePath: null as paper.Path.Rectangle | null,
    styles: getSceneStyles(scope),
  };
};

export type VectorPaperSessionState = ReturnType<
  typeof createVectorPaperSessionState
>;
