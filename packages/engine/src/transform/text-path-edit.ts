import { buildNodeCapabilityGeometry } from "../nodes/node-capabilities";
import {
  ARCH_BEND_LIMIT,
  WAVE_CYCLES_MAX,
  WAVE_CYCLES_MIN,
} from "../nodes/text/model";
import {
  getArchGuide,
  getCircleGuide,
  getCirclePointAngleDeg,
  getSlantGuide,
  getWaveGuide,
  normalizeLoop,
} from "../nodes/text/text-path";
import { estimateBounds } from "../nodes/text/warp-layout";
import { clamp, round } from "../primitives/math";
import {
  getLocalBoundsCenter,
  getLocalPointFromTransformFrame,
  getNodeTransformForPinnedWorldPoint,
  getNodeTransformFrame,
  getWorldPointFromTransformFrame,
} from "../primitives/rotation";

const SLANT_DRAG_GAIN = 1.35;

const getEditableGuideState = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (node?.type !== "text") {
    return null;
  }

  const geometry = editor.getNodeGeometry(nodeId);
  const bbox = geometry?.bbox || estimateBounds(node);
  const guide = geometry?.guide || getFallbackEditableGuide(node, bbox);

  if (!guide) {
    return null;
  }

  return {
    bbox,
    guide,
    node,
    transformFrame: getNodeTransformFrame(node, bbox),
  };
};

const getFallbackEditableGuide = (node, bbox) => {
  if (node.warp.kind === "arch") {
    return getArchGuide(bbox, node.warp.bend, bbox);
  }

  if (node.warp.kind === "circle") {
    return getCircleGuide(node.warp);
  }

  if (node.warp.kind === "wave") {
    return getWaveGuide(bbox, node.warp.amplitude, node.warp.cycles, bbox);
  }

  if (node.warp.kind === "slant") {
    return getSlantGuide(bbox, node.warp.rise, bbox);
  }

  return null;
};

const getPinnedRenderCenterTransform = (
  editor,
  session,
  guideState,
  nextNode
) => {
  if (!session.pinnedRenderCenterWorld) {
    return null;
  }

  const font = editor.fonts.getLoadedFont(nextNode.font);
  const nextGeometry =
    font && nextNode.type === "text"
      ? buildNodeCapabilityGeometry(nextNode, font)
      : {
          bbox: guideState.bbox,
          guide: guideState.guide,
        };

  if (!nextGeometry.bbox) {
    return null;
  }

  return getNodeTransformForPinnedWorldPoint(
    nextNode,
    nextGeometry.bbox,
    getLocalBoundsCenter(nextGeometry.bbox),
    session.pinnedRenderCenterWorld
  );
};

const getSessionLocalPoint = (guideState, pointerCanvas) => {
  return pointerCanvas
    ? getLocalPointFromTransformFrame(guideState.transformFrame, pointerCanvas)
    : null;
};

const getCirclePointerAngle = (editor, nodeId, pointerCanvas) => {
  const circleState = getEditableGuideState(editor, nodeId);

  if (!(circleState?.guide.kind === "circle" && pointerCanvas)) {
    return null;
  }

  const localPoint = getLocalPointFromTransformFrame(
    circleState.transformFrame,
    pointerCanvas
  );

  return getCirclePointAngleDeg(circleState.guide, localPoint);
};

const beginCirclePositionEdit = (editor, guideState, nodeId, pointerCanvas) => {
  if (guideState.guide.kind !== "circle") {
    return null;
  }

  const pointerAngleDeg = getCirclePointerAngle(editor, nodeId, pointerCanvas);

  if (!Number.isFinite(pointerAngleDeg)) {
    return null;
  }

  return {
    angleOffsetDeg: guideState.guide.centerAngleDeg - pointerAngleDeg,
    guideCenterWorld: getWorldPointFromTransformFrame(
      guideState.transformFrame,
      guideState.guide.center
    ),
    mode: "position",
    nodeId,
    transformFrame: guideState.transformFrame,
  };
};

const beginArchBendEdit = (guideState, nodeId, pointerCanvas) => {
  if (guideState.node.warp.kind !== "arch") {
    return null;
  }

  const localPoint = getSessionLocalPoint(guideState, pointerCanvas);

  if (!localPoint) {
    return null;
  }

  return {
    bendScale:
      guideState.guide.kind === "arch"
        ? guideState.guide.bendScale
        : Math.max(estimateBounds(guideState.node).height / 2, 1),
    mode: "bend",
    nodeId,
    pinnedRenderCenterWorld: guideState.transformFrame.worldCenter,
    startBend: guideState.node.warp.bend,
    startLocalY: localPoint.y,
    transformFrame: guideState.transformFrame,
  };
};

const beginWaveAmplitudeEdit = (guideState, nodeId, pointerCanvas) => {
  if (guideState.node.warp.kind !== "wave") {
    return null;
  }

  const localPoint = getSessionLocalPoint(guideState, pointerCanvas);

  if (!localPoint) {
    return null;
  }

  return {
    mode: "amplitude",
    nodeId,
    pinnedRenderCenterWorld: guideState.transformFrame.worldCenter,
    startAmplitude: guideState.node.warp.amplitude,
    startLocalY: localPoint.y,
    transformFrame: guideState.transformFrame,
  };
};

const beginWaveCyclesEdit = (guideState, nodeId, pointerCanvas) => {
  if (guideState.node.warp.kind !== "wave") {
    return null;
  }

  const localPoint = getSessionLocalPoint(guideState, pointerCanvas);

  if (!localPoint) {
    return null;
  }

  return {
    cycleScale:
      guideState.guide.kind === "wave"
        ? guideState.guide.cycleScale
        : Math.max(estimateBounds(guideState.node).width / 2, 1),
    mode: "cycles",
    nodeId,
    pinnedRenderCenterWorld: guideState.transformFrame.worldCenter,
    startCycles: guideState.node.warp.cycles,
    startLocalX: localPoint.x,
    transformFrame: guideState.transformFrame,
  };
};

const beginSlantEdit = (guideState, nodeId, pointerCanvas) => {
  if (guideState.node.warp.kind !== "slant") {
    return null;
  }

  const localPoint = getSessionLocalPoint(guideState, pointerCanvas);

  if (!localPoint) {
    return null;
  }

  return {
    mode: "slant",
    nodeId,
    pinnedRenderCenterWorld: guideState.transformFrame.worldCenter,
    startLocalY: localPoint.y,
    startRise: guideState.node.warp.rise,
    transformFrame: guideState.transformFrame,
  };
};

export const beginTextPathEdit = (
  editor,
  { mode, nodeId, pointerCanvas } = {}
) => {
  const guideState = getEditableGuideState(editor, nodeId);

  if (!guideState) {
    return null;
  }

  if (mode === "position") {
    return beginCirclePositionEdit(editor, guideState, nodeId, pointerCanvas);
  }

  if (mode === "bend") {
    return beginArchBendEdit(guideState, nodeId, pointerCanvas);
  }

  if (mode === "amplitude") {
    return beginWaveAmplitudeEdit(guideState, nodeId, pointerCanvas);
  }

  if (mode === "cycles") {
    return beginWaveCyclesEdit(guideState, nodeId, pointerCanvas);
  }

  if (mode === "slant") {
    return beginSlantEdit(guideState, nodeId, pointerCanvas);
  }

  return null;
};

export const updateTextPathEdit = (editor, session, { pointerCanvas } = {}) => {
  if (!(session && pointerCanvas)) {
    return null;
  }

  const guideState = getEditableGuideState(editor, session.nodeId);

  if (!guideState) {
    return null;
  }

  const localPoint = getLocalPointFromTransformFrame(
    session.transformFrame || guideState.transformFrame,
    pointerCanvas
  );

  if (session.mode === "position" && guideState.guide.kind === "circle") {
    const pointerAngleDeg = getCirclePointAngleDeg(
      guideState.guide,
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
          ? buildNodeCapabilityGeometry(nextNode, font)
          : {
              bbox: guideState.bbox,
              guide: guideState.guide,
            };
      const nextTransform = session.guideCenterWorld
        ? getNodeTransformForPinnedWorldPoint(
            nextNode,
            nextGeometry.bbox || guideState.bbox,
            nextGeometry.guide?.center || guideState.guide.center,
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

  if (session.mode === "bend") {
    const bend = round(
      clamp(
        session.startBend +
          (localPoint.y - session.startLocalY) / (session.bendScale || 1),
        -ARCH_BEND_LIMIT,
        ARCH_BEND_LIMIT
      ),
      4
    );

    editor.updateNode(session.nodeId, (node) => {
      if (!(node.type === "text" && node.warp.kind === "arch")) {
        return node;
      }

      const nextNode = {
        ...node,
        warp: {
          ...node.warp,
          bend,
        },
      };
      const nextTransform = getPinnedRenderCenterTransform(
        editor,
        session,
        guideState,
        nextNode
      );

      return {
        transform: nextTransform
          ? {
              ...node.transform,
              ...nextTransform,
            }
          : undefined,
        warp: {
          ...node.warp,
          bend,
        },
      };
    });
  }

  if (session.mode === "amplitude") {
    const amplitude = round(
      session.startAmplitude + (localPoint.y - session.startLocalY),
      4
    );

    editor.updateNode(session.nodeId, (node) => {
      if (!(node.type === "text" && node.warp.kind === "wave")) {
        return node;
      }

      const nextNode = {
        ...node,
        warp: {
          ...node.warp,
          amplitude,
        },
      };
      const nextTransform = getPinnedRenderCenterTransform(
        editor,
        session,
        guideState,
        nextNode
      );

      return {
        transform: nextTransform
          ? {
              ...node.transform,
              ...nextTransform,
            }
          : undefined,
        warp: {
          ...node.warp,
          amplitude,
        },
      };
    });
  }

  if (session.mode === "cycles") {
    const cycles = round(
      clamp(
        session.startCycles -
          (localPoint.x - session.startLocalX) / (session.cycleScale || 1),
        WAVE_CYCLES_MIN,
        WAVE_CYCLES_MAX
      ),
      4
    );

    editor.updateNode(session.nodeId, (node) => {
      if (!(node.type === "text" && node.warp.kind === "wave")) {
        return node;
      }

      const nextNode = {
        ...node,
        warp: {
          ...node.warp,
          cycles,
        },
      };
      const nextTransform = getPinnedRenderCenterTransform(
        editor,
        session,
        guideState,
        nextNode
      );

      return {
        transform: nextTransform
          ? {
              ...node.transform,
              ...nextTransform,
            }
          : undefined,
        warp: {
          ...node.warp,
          cycles,
        },
      };
    });
  }

  if (session.mode === "slant") {
    const rise = round(
      session.startRise +
        (localPoint.y - session.startLocalY) * SLANT_DRAG_GAIN,
      4
    );

    editor.updateNode(session.nodeId, (node) => {
      if (!(node.type === "text" && node.warp.kind === "slant")) {
        return node;
      }

      const nextNode = {
        ...node,
        warp: {
          ...node.warp,
          rise,
        },
      };
      const nextTransform = getPinnedRenderCenterTransform(
        editor,
        session,
        guideState,
        nextNode
      );

      return {
        transform: nextTransform
          ? {
              ...node.transform,
              ...nextTransform,
            }
          : undefined,
        warp: {
          ...node.warp,
          rise,
        },
      };
    });
  }

  return session.nodeId;
};
