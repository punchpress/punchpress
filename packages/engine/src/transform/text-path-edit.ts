import { round } from "../primitives/math";
import { getNodeLocalPoint } from "../primitives/rotation";
import {
  getCircleGuide,
  getCirclePointAngleDeg,
  normalizeLoop,
} from "../shapes/warp-text/text-path";
import { estimateBounds } from "../shapes/warp-text/warp-layout";

const getEditableCircleState = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "text" && node.warp.kind === "circle")) {
    return null;
  }

  const bbox = editor.getNodeGeometry(nodeId)?.bbox || estimateBounds(node);
  const guide = getCircleGuide(node.warp);

  return {
    bbox,
    guide,
    node,
  };
};

const getCirclePointerAngle = (editor, nodeId, pointerCanvas) => {
  const circleState = getEditableCircleState(editor, nodeId);

  if (!(circleState && pointerCanvas)) {
    return null;
  }

  const localPoint = getNodeLocalPoint(
    circleState.node,
    circleState.bbox,
    pointerCanvas
  );

  return getCirclePointAngleDeg(circleState.guide, localPoint);
};

export const beginTextPathEdit = (
  editor,
  { mode, nodeId, pointerCanvas } = {}
) => {
  const circleState = getEditableCircleState(editor, nodeId);

  if (!circleState) {
    return null;
  }

  if (mode === "position") {
    const pointerAngleDeg = getCirclePointerAngle(
      editor,
      nodeId,
      pointerCanvas
    );

    if (!Number.isFinite(pointerAngleDeg)) {
      return null;
    }

    return {
      angleOffsetDeg: circleState.guide.centerAngleDeg - pointerAngleDeg,
      mode,
      nodeId,
    };
  }

  return null;
};

export const updateTextPathEdit = (editor, session, { pointerCanvas } = {}) => {
  if (!(session && pointerCanvas)) {
    return null;
  }

  const circleState = getEditableCircleState(editor, session.nodeId);

  if (!circleState) {
    return null;
  }

  const localPoint = getNodeLocalPoint(
    circleState.node,
    circleState.bbox,
    pointerCanvas
  );

  if (session.mode === "position") {
    const pointerAngleDeg = getCirclePointAngleDeg(
      circleState.guide,
      localPoint
    );
    const pathPosition = round(
      normalizeLoop((pointerAngleDeg + session.angleOffsetDeg) / 360),
      4
    );

    editor.updateNode(session.nodeId, (node) => {
      if (!(node.type === "text" && node.warp.kind === "circle")) {
        return node;
      }

      return {
        warp: {
          ...node.warp,
          pathPosition,
        },
      };
    });
  }

  return session.nodeId;
};
