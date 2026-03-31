import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import {
  getTextPathGuideMatrix,
  getTextPathHostMetrics,
  getTextPathTransformTargetStyle,
} from "./text-path-overlay-geometry";
import { createVectorPaperSession } from "./vector-paper-scene";

const getVectorPathOverlayScene = ({
  isPathEditing,
  matrix,
  metrics,
  node,
  pathEditingPoint,
  penHover,
  penPreview,
}) => {
  if (!(isPathEditing && node && matrix && metrics)) {
    return null;
  }

  return {
    contours: node.contours,
    matrix,
    metrics,
    penHover,
    penPreview,
    selectedPoint: pathEditingPoint,
  };
};

export const CanvasVectorPathOverlay = ({ viewportRevision }) => {
  const editor = useEditor();
  const paperSessionRef = useRef(null);
  const sceneRef = useRef(null);
  const [paperCanvasElement, setPaperCanvasElement] =
    useState<HTMLCanvasElement | null>(null);
  const [transformTargetElement, setTransformTargetElement] = useState(null);
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const pathEditingNodeId = useEditorValue(
    (_, state) => state.pathEditingNodeId
  );
  const pathEditingPoint = useEditorValue((_, state) => state.pathEditingPoint);
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const overlayState = useEditorSurfaceValue((editor, state) => {
    if (state.editingNodeId || !state.pathEditingNodeId) {
      return null;
    }

    const node = editor.getNode(state.pathEditingNodeId);

    if (node?.type !== "vector" || !editor.isNodeEffectivelyVisible(node.id)) {
      return null;
    }

    const geometry = editor.getNodeGeometry(node.id);

    if (!geometry?.bbox) {
      return null;
    }

    const penPreview = editor.getPenPreviewState();
    const penHover = editor.getPenHoverState();

    return {
      geometry,
      node,
      penHover: penHover?.nodeId === node.id ? penHover : null,
      penPreview:
        penPreview?.nodeId === node.id && penPreview.kind === "segment"
          ? penPreview
          : null,
      previewDelta: editor.getSelectionPreviewDelta([node.id]) || null,
    };
  });
  const nodeId = overlayState?.node.id || null;
  const isPathEditing = Boolean(nodeId && pathEditingNodeId === nodeId);
  const isPanning = spacePressed || activeTool === "hand";
  const isPenToolActive = activeTool === "pen";
  const geometry = overlayState?.geometry || null;
  const node = overlayState?.node || null;
  const penHover = overlayState?.penHover || null;
  const penPreview = overlayState?.penPreview || null;
  const previewDelta = overlayState?.previewDelta || null;
  const metrics = overlayState ? getTextPathHostMetrics(editor) : null;
  const transformTargetStyle =
    geometry && node && isPathEditing
      ? getTextPathTransformTargetStyle(
          editor,
          node,
          geometry,
          previewDelta,
          true
        )
      : null;
  const matrix =
    geometry && metrics && node
      ? getTextPathGuideMatrix(
          node,
          geometry,
          metrics,
          editor.zoom,
          previewDelta
        )
      : null;
  const scene = getVectorPathOverlayScene({
    isPathEditing,
    matrix,
    metrics,
    node,
    pathEditingPoint,
    penHover,
    penPreview,
  });

  sceneRef.current = scene;

  const forwardWheelToCanvasSurface = useCallback(
    (event) => {
      const surface = editor.hostRef?.querySelector(".canvas-surface");

      if (!surface) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      surface.dispatchEvent(
        new WheelEvent("wheel", {
          altKey: event.altKey,
          bubbles: true,
          cancelable: true,
          clientX: event.clientX,
          clientY: event.clientY,
          ctrlKey: event.ctrlKey,
          deltaMode: event.deltaMode,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaZ: event.deltaZ,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        })
      );
    },
    [editor]
  );

  useEffect(() => {
    if (!(nodeId && !isPathEditing && editor.getNodeTransformElement(nodeId))) {
      return;
    }

    editor.registerNodeTransformElement(nodeId, null);
    editor.onViewportChange?.();
  }, [editor, isPathEditing, nodeId]);

  useEffect(() => {
    if (!(nodeId && isPathEditing && transformTargetElement)) {
      return;
    }

    editor.registerNodeTransformElement(nodeId, transformTargetElement);
    editor.onViewportChange?.();

    return () => {
      if (editor.getNodeTransformElement(nodeId) === transformTargetElement) {
        editor.registerNodeTransformElement(nodeId, null);
        editor.onViewportChange?.();
      }
    };
  }, [editor, isPathEditing, nodeId, transformTargetElement]);

  useEffect(() => {
    if (!paperCanvasElement) {
      return;
    }

    const session = createVectorPaperSession({
      canvas: paperCanvasElement,
      editor,
      nodeId,
      onChange: (contours, options) => {
        if (!nodeId) {
          return;
        }

        editor.updateVectorContours(nodeId, contours, options);
      },
      onExitPathEditing: () => {
        editor.stopPathEditing();
      },
      onHistoryCommit: (historyMark) => {
        if (historyMark) {
          editor.commitHistoryStep(historyMark);
        }
      },
      onHistoryStart: () => editor.markHistoryStep("edit vector path"),
    });

    paperSessionRef.current = session;
    session.render(sceneRef.current);

    return () => {
      session.destroy();
      paperSessionRef.current = null;
    };
  }, [editor, nodeId, paperCanvasElement]);

  useEffect(() => {
    paperSessionRef.current?.render(scene);
  }, [scene]);

  if (!(overlayState && isPathEditing)) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 z-20 ${isPanning || isPenToolActive ? "pointer-events-none" : ""}`}
      data-viewport-revision={viewportRevision}
      onWheelCapture={isPanning ? undefined : forwardWheelToCanvasSurface}
    >
      {transformTargetStyle ? (
        <div
          className="canvas-vector-path-target pointer-events-none absolute"
          data-node-id={node.id}
          ref={setTransformTargetElement}
          style={transformTargetStyle}
        />
      ) : null}

      <canvas
        className="canvas-vector-paper absolute inset-0 h-full w-full"
        ref={setPaperCanvasElement}
      />
    </div>
  );
};
