import { setMoveableMuted } from "./canvas-overlay-interactions";

const shouldLetNodeHandleAltDrag = (inputEvent) => {
  if (!inputEvent?.altKey) {
    return false;
  }

  return Boolean(inputEvent.target?.closest?.(".canvas-node"));
};

export const getCanvasDragHandlers = ({
  editor,
  hostElement,
  queueRefresh,
  restoreHover,
  selectedNode,
  visibleSelectedNodeIds,
}) => {
  const getDragDelta = (event) => {
    const zoom = editor.zoom || 1;

    return {
      x: (event.beforeDelta?.[0] || 0) / zoom,
      y: (event.beforeDelta?.[1] || 0) / zoom,
    };
  };

  return {
    onDrag: (event) => {
      if (event.datas.skipDrag) {
        return;
      }

      if (!event.datas.dragSession) {
        return;
      }

      setMoveableMuted(hostElement, true);
      editor.updateSelectionDrag(event.datas.dragSession, {
        delta: getDragDelta(event),
      });
    },
    onDragEnd: (event) => {
      if (event.datas.skipDrag) {
        return;
      }

      editor.endSelectionDrag(event.datas.dragSession);
      restoreHover();
      setMoveableMuted(hostElement, false);
      queueRefresh();
    },
    onDragGroup: (event) => {
      if (event.datas.skipDrag) {
        return;
      }

      const dragSession =
        event.datas.dragSession || event.events[0]?.datas?.dragSession;

      if (!dragSession) {
        return;
      }

      setMoveableMuted(hostElement, true);
      editor.updateSelectionDrag(dragSession, {
        delta: getDragDelta(event),
      });
    },
    onDragGroupEnd: (event) => {
      if (event.datas.skipDrag) {
        return;
      }

      const dragSession =
        event.datas.dragSession || event.events[0]?.datas?.dragSession;
      editor.endSelectionDrag(dragSession);
      restoreHover();
      setMoveableMuted(hostElement, false);
      queueRefresh();
    },
    onDragGroupStart: (event) => {
      if (shouldLetNodeHandleAltDrag(event.inputEvent)) {
        event.datas.skipDrag = true;
        return;
      }

      const dragSession = editor.beginSelectionDrag({
        duplicate: Boolean(event.inputEvent?.altKey),
        nodeIds: visibleSelectedNodeIds,
      });

      if (!dragSession) {
        return;
      }

      event.datas.dragSession = dragSession;
      event.datas.duplicate = Boolean(event.inputEvent?.altKey);

      for (const groupEvent of event.events) {
        groupEvent.datas.dragSession = dragSession;
        groupEvent.datas.duplicate = event.datas.duplicate;
      }
    },
    onDragStart: (event) => {
      if (shouldLetNodeHandleAltDrag(event.inputEvent)) {
        event.datas.skipDrag = true;
        return;
      }

      event.datas.dragSession = editor.beginSelectionDrag({
        duplicate: Boolean(event.inputEvent?.altKey),
        nodeId: selectedNode?.id,
      });
      event.datas.duplicate = Boolean(event.inputEvent?.altKey);
    },
  };
};
