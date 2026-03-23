import { round } from "../primitives/math";
import {
  getLocalPointFromTransformFrame,
  getNodeTransformForPinnedWorldPoint,
  getNodeTransformFrame,
  getWorldPointFromTransformFrame,
} from "../primitives/rotation";
import {
  getCircleGuide,
  getCirclePointAngleDeg,
  normalizeLoop,
} from "../shapes/warp-text/text-path";
import { buildNodeGeometry } from "../shapes/warp-text/warp-engine";
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
    transformFrame: getNodeTransformFrame(node, bbox),
  };
};

const getCirclePointerAngle = (editor, nodeId, pointerCanvas) => {
  const circleState = getEditableCircleState(editor, nodeId);

  if (!(circleState && pointerCanvas)) {
    return null;
  }

  const localPoint = getLocalPointFromTransformFrame(
    circleState.transformFrame,
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
      guideCenterWorld: getWorldPointFromTransformFrame(
        circleState.transformFrame,
        circleState.guide.center
      ),
      mode,
      nodeId,
      transformFrame: circleState.transformFrame,
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

  const localPoint = getLocalPointFromTransformFrame(
    session.transformFrame || circleState.transformFrame,
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

      const nextNode = {
        ...node,
        warp: {
          ...node.warp,
          pathPosition,
        },
      };
      const font = editor.fonts.getLoadedFont(node.font);
      const nextGeometry =
        font && nextNode.type === "text"
          ? buildNodeGeometry(nextNode, font)
          : {
              bbox: circleState.bbox,
              guide: circleState.guide,
            };
      const nextTransform = session.guideCenterWorld
        ? getNodeTransformForPinnedWorldPoint(
            nextNode,
            nextGeometry.bbox || circleState.bbox,
            nextGeometry.guide?.center || circleState.guide.center,
            session.guideCenterWorld
          )
        : null;

      return {
        transform: nextTransform
          ? {
              ...node.transform,
              ...nextTransform,
            }
          : undefined,
        warp: {
          ...node.warp,
          pathPosition,
        },
      };
    });
  }

  return session.nodeId;
};
