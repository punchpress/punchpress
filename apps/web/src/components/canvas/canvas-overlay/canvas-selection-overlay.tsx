import { useLayoutEffect, useRef } from "react";
import Selecto from "react-selecto";
import { isNodeVisible } from "../../../editor/shapes/warp-text/model";
import { useEditor } from "../../../editor/use-editor";
import { useEditorValue } from "../../../editor/use-editor-value";
import { getNodeIdsFromSelectionRect } from "./canvas-overlay-geometry";
import { shouldBlockSelectionStart } from "./canvas-overlay-interactions";

export const CanvasSelectionOverlay = () => {
  const editor = useEditor();
  const selectoRef = useRef(null);

  const activeTool = useEditorValue((_, state) => state.activeTool);
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const selectedTargets = useEditorValue((editor, state) => {
    return state.selectedNodeIds
      .filter((nodeId) => isNodeVisible(editor.getNode(nodeId)))
      .map((nodeId) => editor.getNodeElement(nodeId))
      .filter(Boolean);
  });

  const hostElement = editor.hostRef;
  const keyContainer = typeof window === "undefined" ? undefined : window;
  const suppressHover = () => {
    editor.setHoveringSuppressed(true);
  };
  const restoreHover = () => {
    editor.setHoveringSuppressed(false);
  };

  useLayoutEffect(() => {
    selectoRef.current?.setSelectedTargets?.(selectedTargets);
  }, [selectedTargets]);

  return (
    <Selecto
      boundContainer={hostElement}
      className="canvas-selecto"
      container={hostElement}
      dragContainer={keyContainer}
      hitRate={10}
      keyContainer={keyContainer}
      onDragStart={(event) => {
        if (
          spacePressed ||
          event.inputEvent.button !== 0 ||
          activeTool !== "pointer" ||
          shouldBlockSelectionStart(event.inputEvent.target) ||
          event.inputEvent.target?.closest?.(".canvas-moveable")
        ) {
          event.stop();
          restoreHover();
          return;
        }

        suppressHover();
      }}
      onSelectEnd={(event) => {
        if (activeTool !== "pointer") {
          restoreHover();
          return;
        }

        const nextSelectedNodeIds = getNodeIdsFromSelectionRect(
          editor,
          event.rect
        );

        restoreHover();

        if (event.inputEvent?.shiftKey) {
          editor.setSelectedNodes([
            ...editor.selectedNodeIds,
            ...nextSelectedNodeIds,
          ]);
          return;
        }

        editor.setSelectedNodes(nextSelectedNodeIds);
      }}
      preventClickEventOnDrag
      preventClickEventOnDragStart
      ref={selectoRef}
      rootContainer={hostElement}
      selectableTargets={[".canvas-node"]}
      selectByClick={false}
      selectFromInside={false}
      toggleContinueSelectWithoutDeselect={["shift"]}
    />
  );
};
