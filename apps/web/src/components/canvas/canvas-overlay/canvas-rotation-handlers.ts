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
  const shouldShowGroupRotationPreview = selectedNode?.type !== "group";

  return {
    onRotate: (event) => {
      if (!event.datas.rotateSession) {
        return;
      }

      editor.updateRotateSelection(event.datas.rotateSession, {
        deltaRotation: event.beforeDist,
      });
    },
    onRotateEnd: (event) => {
      restoreHover();
      setMoveableMuted(hostElement, false);
      if (event.datas.historyMark) {
        editor.commitHistoryStep(event.datas.historyMark);
      }
      queueRefresh();
    },
    onRotateGroup: (event) => {
      const rotateSession =
        event.datas.rotateSession || event.events[0]?.datas?.rotateSession;

      if (!rotateSession) {
        return;
      }

      editor.updateRotateSelection(rotateSession, {
        deltaRotation: event.beforeDist,
      });
    },
    onRotateGroupEnd: (event) => {
      restoreHover();
      setMoveableMuted(hostElement, false);
      if (event.datas.historyMark) {
        editor.commitHistoryStep(event.datas.historyMark);
      }
      queueRefresh();

      if (!shouldShowGroupRotationPreview) {
        return;
      }

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
      const rotateSession = editor.beginRotateSelection({
        nodeIds: visibleSelectedNodeIds,
      });

      if (!rotateSession) {
        return;
      }

      event.datas.historyMark = editor.markHistoryStep("rotate selection");
      suppressHover();
      setMoveableMuted(hostElement, true);

      if (shouldShowGroupRotationPreview) {
        setGroupRotationPreviewActive(hostElement, true);
        setIsGroupRotationPreviewVisible(true);
      }

      event.datas.rotateSession = rotateSession;

      for (const groupEvent of event.events) {
        groupEvent.datas.historyMark = event.datas.historyMark;
        groupEvent.datas.rotateSession = rotateSession;
      }
    },
    onRotateStart: (event) => {
      const rotateSession = selectedNode
        ? editor.beginRotateSelection({ nodeId: selectedNode.id })
        : null;

      if (!rotateSession) {
        return;
      }

      event.datas.historyMark = editor.markHistoryStep("rotate selection");
      suppressHover();
      setMoveableMuted(hostElement, true);
      event.datas.rotateSession = rotateSession;
    },
  };
};
