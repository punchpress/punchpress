import {
  getResizePointer,
  getResizeScale,
  getResizeSession,
} from "./canvas-overlay-resize";

export const getCanvasResizeHandlers = ({
  editor,
  hostElement,
  queueRefresh,
  restoreHover,
  selectedNode,
  suppressHover,
  visibleSelectedNodeIds,
}) => {
  return {
    onResize: (event) => {
      const resizeScale = getResizeScale(
        event,
        event.datas.anchorClient,
        event.datas.startDistance
      );

      if (!(event.datas.resizeSession && Number.isFinite(resizeScale))) {
        return;
      }

      editor.updateResizeSelection(event.datas.resizeSession, {
        scale: resizeScale,
      });
    },
    onResizeEnd: (event) => {
      restoreHover();
      if (event.datas.historyMark) {
        editor.commitHistoryStep(event.datas.historyMark);
      }
      queueRefresh();
    },
    onResizeGroup: (event) => {
      const resizeScale = getResizeScale(
        event,
        event.datas.anchorClient,
        event.datas.startDistance
      );

      if (!(event.datas.resizeSession && Number.isFinite(resizeScale))) {
        return;
      }

      editor.updateResizeSelection(event.datas.resizeSession, {
        scale: resizeScale,
      });
    },
    onResizeGroupEnd: (event) => {
      restoreHover();
      if (event.datas.historyMark) {
        editor.commitHistoryStep(event.datas.historyMark);
      }
      queueRefresh();
    },
    onResizeGroupStart: (event) => {
      const pointer = getResizePointer(event);
      const resizeSession = getResizeSession(
        editor,
        hostElement,
        event.direction,
        pointer
      );

      if (!resizeSession) {
        return;
      }

      const groupResizeSession = editor.beginResizeSelection({
        anchorCanvas: resizeSession.anchorCanvas,
        nodeIds: visibleSelectedNodeIds,
      });

      if (!groupResizeSession) {
        return;
      }

      event.datas.historyMark = editor.markHistoryStep("resize selection");
      suppressHover();
      event.datas.anchorClient = resizeSession.anchorClient;
      event.datas.resizeSession = groupResizeSession;
      event.datas.startDistance = resizeSession.startDistance;

      for (const groupEvent of event.events) {
        groupEvent.datas.historyMark = event.datas.historyMark;
      }
    },
    onResizeStart: (event) => {
      if (!selectedNode) {
        return;
      }

      const pointer = getResizePointer(event);
      const resizeSession = getResizeSession(
        editor,
        hostElement,
        event.direction,
        pointer
      );

      if (!resizeSession) {
        return;
      }

      const nodeResizeSession = editor.beginResizeSelection({
        anchorCanvas: resizeSession.anchorCanvas,
        direction: event.direction,
        nodeId: selectedNode.id,
      });

      if (!nodeResizeSession) {
        return;
      }

      event.datas.historyMark = editor.markHistoryStep("resize selection");
      suppressHover();
      event.datas.anchorClient = resizeSession.anchorClient;
      event.datas.resizeSession = nodeResizeSession;
      event.datas.startDistance = resizeSession.startDistance;
    },
  };
};
