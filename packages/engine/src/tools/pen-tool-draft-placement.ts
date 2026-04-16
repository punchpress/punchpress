import {
  appendVectorContourSegment,
  closeVectorContour,
  replaceVectorContourSegment,
} from "../nodes/vector/vector-contour-operations";
import { round } from "../primitives/math";
import { getNodeLocalPoint } from "../primitives/rotation";
import type { PenTool } from "./pen-tool";
import {
  finishAuthoringSession,
  getActiveAuthoringSession,
} from "./pen-tool-authoring-session";
import { resolveCloseTarget } from "./pen-tool-close-target";
import {
  getPenDragHandle,
  getNodeContour,
  getNodeContours,
  getZeroHandle,
  isPenEditableNode,
  type PenAuthoringSession,
  roundHandle,
} from "./pen-tool-types";

export const beginDraftPlacement = (
  tool: PenTool,
  session: PenAuthoringSession,
  point
) => {
  const node = tool.editor.getNode(session.nodeId);
  const bbox = tool.editor.getNodeGeometry(session.nodeId)?.bbox;
  const contour = getNodeContour(node, session.contourIndex);

  if (!(isPenEditableNode(node) && bbox && contour)) {
    return;
  }

  const isFirstPoint = !session.hasPlacedInitialPoint;
  const anchorLocalPoint = isFirstPoint
    ? contour.segments[0]?.point || { x: 0, y: 0 }
    : getNodeLocalPoint(node, bbox, point);

  session.draft = {
    anchorCanvasPoint: {
      x: round(point.x, 2),
      y: round(point.y, 2),
    },
    anchorLocalPoint: {
      x: round(anchorLocalPoint.x, 2),
      y: round(anchorLocalPoint.y, 2),
    },
    currentCanvasPoint: {
      x: round(point.x, 2),
      y: round(point.y, 2),
    },
    dragHandle: null,
    kind: isFirstPoint ? "first-point" : "next-point",
    target: resolveCloseTarget(tool, node, bbox, point, contour),
  };
  session.hoverPoint = null;
  session.hoverTarget = null;
  tool.editor.notifyInteractionPreviewChanged();
};

export const cancelDraftPlacement = (tool: PenTool) => {
  const session = getActiveAuthoringSession(tool);

  if (!session?.draft) {
    return false;
  }

  const draft = session.draft;
  session.draft = null;
  session.hoverPoint = null;
  session.hoverTarget = null;

  if (draft.kind === "first-point") {
    return finishAuthoringSession(tool, { commit: false });
  }

  tool.editor.notifyInteractionPreviewChanged();
  return true;
};

export const completeDraftPlacement = (tool: PenTool, point, options = {}) => {
  const session = getActiveAuthoringSession(tool);

  if (!(session?.draft && point)) {
    return false;
  }

  const node = tool.editor.getNode(session.nodeId);
  const bbox = tool.editor.getNodeGeometry(session.nodeId)?.bbox;
  const contour = getNodeContour(node, session.contourIndex);

  if (!(isPenEditableNode(node) && bbox && contour)) {
    return false;
  }

  updateDraftPlacement(tool, point, options);

  const draft = session.draft;
  session.draft = null;

  if (draft.kind === "first-point") {
    session.hasPlacedInitialPoint = true;
    tool.editor.notifyInteractionPreviewChanged();
    return true;
  }

  if (draft.target?.type === "start-anchor") {
    session.hasAuthoredChange = true;
    const nextContours = draft.dragHandle
      ? replaceVectorContourSegment(getNodeContours(node), {
          contourIndex: session.contourIndex,
          handleIn: roundHandle({
            x: -draft.dragHandle.x,
            y: -draft.dragHandle.y,
          }),
          pointType: "smooth",
          segmentIndex: draft.target.segmentIndex,
        })
      : getNodeContours(node);

    tool.editor.updateVectorContours(
      node.id,
      closeVectorContour(nextContours, session.contourIndex)
    );
    return finishClosedContour(tool, session, {
      contourIndex: session.contourIndex,
      segmentIndex: draft.target.segmentIndex,
    });
  }

  const nextPointType = draft.dragHandle ? "smooth" : "corner";

  session.hasAuthoredChange = true;
  tool.editor.updateVectorContours(
    node.id,
    appendVectorContourSegment(getNodeContours(node), {
      contourIndex: session.contourIndex,
      handleIn: draft.dragHandle
        ? roundHandle({
            x: -draft.dragHandle.x,
            y: -draft.dragHandle.y,
          })
        : getZeroHandle(),
      handleOut: draft.dragHandle
        ? roundHandle(draft.dragHandle)
        : getZeroHandle(),
      point: draft.anchorLocalPoint,
      pointType: nextPointType,
    }),
    {
      pinnedLocalPoint: draft.anchorLocalPoint,
      pinnedWorldPoint: draft.anchorCanvasPoint,
    }
  );
  tool.editor.setPathEditingPoint({
    contourIndex: session.contourIndex,
    segmentIndex: contour.segments.length,
  });
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};

const finishClosedContour = (
  tool: PenTool,
  session: PenAuthoringSession,
  selectedPoint
) => {
  tool.authoringSession = null;
  tool.idleHoverTarget = null;
  tool.editor.setPathEditingPoint(selectedPoint || null);
  tool.editor.notifyInteractionPreviewChanged();

  if (session.historyMark) {
    return tool.editor.commitHistoryStep(session.historyMark);
  }

  return true;
};

export const updateDraftPlacement = (
  tool: PenTool,
  point,
  { spaceKey = false } = {}
) => {
  const session = getActiveAuthoringSession(tool);

  if (!(session?.draft && point)) {
    return false;
  }

  const node = tool.editor.getNode(session.nodeId);
  const bbox = tool.editor.getNodeGeometry(session.nodeId)?.bbox;
  const contour = getNodeContour(node, session.contourIndex);

  if (!(isPenEditableNode(node) && bbox && contour)) {
    return false;
  }

  const draft = session.draft;
  const nextCanvasPoint = {
    x: round(point.x, 2),
    y: round(point.y, 2),
  };

  if (spaceKey) {
    const nextAnchorCanvasPoint = {
      x: round(
        draft.anchorCanvasPoint.x +
          (nextCanvasPoint.x - draft.currentCanvasPoint.x),
        2
      ),
      y: round(
        draft.anchorCanvasPoint.y +
          (nextCanvasPoint.y - draft.currentCanvasPoint.y),
        2
      ),
    };

    draft.anchorCanvasPoint = nextAnchorCanvasPoint;
    draft.anchorLocalPoint = {
      x: round(getNodeLocalPoint(node, bbox, nextAnchorCanvasPoint).x, 2),
      y: round(getNodeLocalPoint(node, bbox, nextAnchorCanvasPoint).y, 2),
    };
    draft.currentCanvasPoint = nextCanvasPoint;

    if (draft.kind === "first-point") {
      tool.editor.updateVectorContours(
        node.id,
        replaceVectorContourSegment(getNodeContours(node), {
          contourIndex: session.contourIndex,
          point: draft.anchorLocalPoint,
          segmentIndex: 0,
        }),
        {
          pinnedLocalPoint: draft.anchorLocalPoint,
          pinnedWorldPoint: draft.anchorCanvasPoint,
        }
      );
    }

    draft.target = resolveCloseTarget(
      tool,
      node,
      bbox,
      draft.anchorCanvasPoint,
      contour
    );

    tool.editor.notifyInteractionPreviewChanged();
    return true;
  }

  const localPoint = getNodeLocalPoint(node, bbox, point);

  if (draft.kind === "first-point") {
    const nextHandle = getPenDragHandle({
      anchorCanvasPoint: draft.anchorCanvasPoint,
      anchorLocalPoint: draft.anchorLocalPoint,
      currentCanvasPoint: point,
      currentLocalPoint: localPoint,
    });

    draft.dragHandle = nextHandle;

    tool.editor.updateVectorContours(
      node.id,
      replaceVectorContourSegment(getNodeContours(node), {
        contourIndex: session.contourIndex,
        handleIn: nextHandle
          ? {
              x: -nextHandle.x,
              y: -nextHandle.y,
            }
          : getZeroHandle(),
        handleOut: nextHandle || getZeroHandle(),
        pointType: nextHandle ? "smooth" : "corner",
        segmentIndex: 0,
      })
    );
    draft.currentCanvasPoint = nextCanvasPoint;
    tool.editor.notifyInteractionPreviewChanged();
    return true;
  }

  draft.dragHandle = getPenDragHandle({
    anchorCanvasPoint: draft.anchorCanvasPoint,
    anchorLocalPoint: draft.anchorLocalPoint,
    currentCanvasPoint: point,
    currentLocalPoint: localPoint,
  });
  draft.target = resolveCloseTarget(
    tool,
    node,
    bbox,
    draft.anchorCanvasPoint,
    contour
  );
  draft.currentCanvasPoint = nextCanvasPoint;
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};
