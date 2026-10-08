import { round } from "@punchpress/engine";
import { useCallback, useEffect, useRef } from "react";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { getCanvasClientPoint } from "./canvas-client-point";
import { resolveVectorPenHoverAction } from "./canvas-overlay/vector-path/pen-hover";

// Pen hover feedback for a resting pointer: re-dispatches the last hover point
// when the pen modifiers change or the settled camera moves under it.
export const useCanvasPenHover = ({
  activeTool,
  hostRef,
  penDirectSelectionMode,
  spacePressed,
}) => {
  const editor = useEditor();
  const penPointTypeToggleModifierPressed = useEditorValue(
    (_, state) => state.penPointTypeToggleModifierPressed
  );
  const settledViewport = useEditorValue((_, state) => state.viewport);
  const lastClientPointRef = useRef<{ x: number; y: number } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a settled camera move re-dispatches the resting hover point
  useEffect(() => {
    syncHostPenCursorMode(
      hostRef.current,
      activeTool,
      editor,
      penDirectSelectionMode
    );

    if (activeTool !== "pen") {
      lastClientPointRef.current = null;
      return;
    }

    if (penDirectSelectionMode || spacePressed) {
      editor.dispatchCanvasPointerLeave({});
      return;
    }

    const lastClientPoint = lastClientPointRef.current;

    if (!lastClientPoint) {
      return;
    }

    dispatchPenHover(editor, lastClientPoint, {
      altKey: penPointTypeToggleModifierPressed,
    });
    syncHostPenCursorMode(
      hostRef.current,
      activeTool,
      editor,
      penDirectSelectionMode
    );
  }, [
    activeTool,
    editor,
    hostRef,
    penDirectSelectionMode,
    penPointTypeToggleModifierPressed,
    settledViewport,
    spacePressed,
  ]);

  const handlePointerLeave = useCallback(() => {
    lastClientPointRef.current = null;

    if (activeTool !== "pen") {
      return;
    }

    editor.dispatchCanvasPointerLeave({});
    syncHostPenCursorMode(
      hostRef.current,
      activeTool,
      editor,
      penDirectSelectionMode
    );
  }, [activeTool, editor, hostRef, penDirectSelectionMode]);

  const handlePointerMove = useCallback(
    (event) => {
      if (spacePressed || activeTool !== "pen" || event.buttons !== 0) {
        return;
      }

      if (penDirectSelectionMode) {
        editor.dispatchCanvasPointerLeave({ event });
        syncHostPenCursorMode(
          hostRef.current,
          activeTool,
          editor,
          penDirectSelectionMode
        );
        return;
      }

      if (
        !(
          event.target instanceof Element &&
          event.target.closest(
            [".canvas-surface", ".canvas-node", ".canvas-vector-paper"].join(
              ","
            )
          )
        )
      ) {
        lastClientPointRef.current = null;
        editor.dispatchCanvasPointerLeave({ event });
        return;
      }

      lastClientPointRef.current = { x: event.clientX, y: event.clientY };
      dispatchPenHover(editor, lastClientPointRef.current, event);
      syncHostPenCursorMode(
        hostRef.current,
        activeTool,
        editor,
        penDirectSelectionMode
      );
    },
    [activeTool, editor, hostRef, penDirectSelectionMode, spacePressed]
  );

  return { handlePointerLeave, handlePointerMove };
};

export const syncHostPenCursorMode = (
  host,
  activeTool,
  editor,
  penDirectSelectionMode
) => {
  if (!(host instanceof HTMLElement)) {
    return;
  }

  if (activeTool !== "pen" || penDirectSelectionMode) {
    delete host.dataset.penCursorMode;
    return;
  }

  const nextCursorMode = resolveVectorPenHoverAction(
    editor.getPenHoverState()
  )?.cursorMode;

  if (nextCursorMode && nextCursorMode !== "default") {
    host.dataset.penCursorMode = nextCursorMode;
    return;
  }

  delete host.dataset.penCursorMode;
};

const dispatchPenHover = (editor, clientPoint, event) => {
  const point = getCanvasClientPoint(editor, clientPoint.x, clientPoint.y);

  editor.dispatchCanvasPointerMove({
    event,
    point: {
      x: round(point.x, 2),
      y: round(point.y, 2),
    },
  });
};
