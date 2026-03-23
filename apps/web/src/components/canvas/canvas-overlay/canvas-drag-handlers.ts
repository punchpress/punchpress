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
        delta: event.datas.duplicate
          ? {
              x: event.beforeDelta[0] || 0,
              y: event.beforeDelta[1] || 0,
            }
          : undefined,
        left: event.left,
        top: event.top,
      });
    },
    onDragEnd: (event) => {
      if (event.datas.skipDrag) {
        return;
      }

      editor.endSelectionDrag(
        event.datas.dragSession,
        event.lastEvent
          ? {
              left: event.lastEvent.left,
              top: event.lastEvent.top,
            }
          : undefined
      );
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
        delta: event.datas.duplicate
          ? {
              x: event.beforeDelta[0] || 0,
              y: event.beforeDelta[1] || 0,
            }
          : undefined,
        dragEvents: event.events,
      });
    },
    onDragGroupEnd: (event) => {
      if (event.datas.skipDrag) {
        return;
      }

      const dragSession =
        event.datas.dragSession || event.events[0]?.datas?.dragSession;
      const lastEvents = event.events
        .map((groupEvent) => groupEvent.lastEvent)
        .filter(Boolean);

      editor.endSelectionDrag(
        dragSession,
        lastEvents.length > 0 ? { dragEvents: lastEvents } : undefined
      );
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
