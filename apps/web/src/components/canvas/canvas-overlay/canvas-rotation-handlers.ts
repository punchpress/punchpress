import {
  setGroupRotationPreviewActive,
  setMoveableMuted,
} from "./canvas-overlay-interactions";

export const getCanvasRotationHandlers = ({
  editor,
  hostElement,
  queueRefresh,
  restoreHover,
  selectedNode,
  setIsGroupRotationPreviewVisible,
  suppressHover,
  visibleSelectedNodeIds,
}) => {
  return {
    onRotate: (event) => {
      if (!event.datas.rotateSession) {
        return;
      }

      editor.updateRotateNode(event.datas.rotateSession, {
        deltaRotation: event.beforeDist,
      });
    },
    onRotateEnd: () => {
      restoreHover();
      setMoveableMuted(hostElement, false);
      editor.endHistoryTransaction();
      queueRefresh();
    },
    onRotateGroup: (event) => {
      const rotateSession =
        event.datas.rotateSession || event.events[0]?.datas?.rotateSession;

      if (!rotateSession) {
        return;
      }

      editor.updateRotateGroup(rotateSession, {
        deltaRotation: event.beforeDist,
      });
    },
    onRotateGroupEnd: () => {
      restoreHover();
      setMoveableMuted(hostElement, false);
      editor.endHistoryTransaction();
      queueRefresh();

      if (typeof window === "undefined") {
        setGroupRotationPreviewActive(hostElement, false);
        setIsGroupRotationPreviewVisible(false);
        return;
      }

      window.requestAnimationFrame(() => {
        setGroupRotationPreviewActive(hostElement, false);
        setIsGroupRotationPreviewVisible(false);
      });
    },
    onRotateGroupStart: (event) => {
      const rotateSession = editor.beginRotateGroup({
        nodeIds: visibleSelectedNodeIds,
      });

      if (!rotateSession) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      setMoveableMuted(hostElement, true);
      setGroupRotationPreviewActive(hostElement, true);
      setIsGroupRotationPreviewVisible(true);
      event.datas.rotateSession = rotateSession;

      for (const groupEvent of event.events) {
        groupEvent.datas.rotateSession = rotateSession;
      }
    },
    onRotateStart: (event) => {
      const rotateSession = selectedNode
        ? editor.beginRotateNode({ nodeId: selectedNode.id })
        : null;

      if (!rotateSession) {
        return;
      }

      editor.beginHistoryTransaction();
      suppressHover();
      setMoveableMuted(hostElement, true);
      event.datas.rotateSession = rotateSession;
    },
  };
};
