import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorPathEditingPreviewSurfaceValue } from "../../../../editor-react/use-editor-path-editing-preview-surface-value";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import {
  getTextPathGuideMatrix,
  getTextPathHostMetrics,
  getTextPathTransformTargetStyle,
} from "../text/path-geometry";
import { CanvasAnchorGhost } from "../visuals/anchor-ghost";
import { getNodeHostMatrix } from "../visuals/node-path-preview";
import { createVectorPathSession } from "./backend";
import type { VectorCornerDragSession } from "./vector-corner-drag-session";
import { VectorCornerRadiusHandles } from "./vector-corner-radius-handle";

const getVectorPathOverlayScene = ({
  activeDragSession,
  editablePathSession,
  hoveredCornerHandlePoint,
  isPanning,
  isPathEditing,
  matrix,
  metrics,
  node,
  penHover,
  penPreview,
}) => {
  if (!(editablePathSession && isPathEditing && node && matrix && metrics)) {
    return null;
  }

  return {
    activeDragSession,
    cornerCurveSegments: editablePathSession.cornerCurveSegments || [],
    contours: editablePathSession.contours,
    hoveredCornerHandlePoint: isPanning ? null : hoveredCornerHandlePoint,
    interactionPolicy: editablePathSession.interactionPolicy,
    isPanning,
    matrix,
    metrics,
    nodeStrokeWidth: editablePathSession.contours.reduce(
      (maxStrokeWidth, contour) => {
        return Math.max(maxStrokeWidth, contour.strokeWidth || 0);
      },
      0
    ),
    penHover,
    penPreview,
    selectedPoints: editablePathSession.selectedPoints,
    selectedPoint: editablePathSession.selectedPoint,
  };
};

const getVectorPathOverlayRenderState = ({
  activeDragSession,
  activeTool,
  editor,
  hoveredCornerHandlePoint,
  overlayState,
  penDirectSelectionModifierPressed,
  spacePressed,
}) => {
  const nodeId = overlayState?.node.id || null;
  const isPathEditing = overlayState?.isPathEditing;
  const isPanning = spacePressed || activeTool === "hand";
  const isPenToolActive = activeTool === "pen";
  const isPenDirectSelectionMode =
    isPenToolActive && penDirectSelectionModifierPressed;
  const editablePathSession = overlayState?.editablePathSession || null;
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
    activeDragSession,
    editablePathSession,
    hoveredCornerHandlePoint,
    isPanning,
    isPathEditing,
    matrix,
    metrics,
    node,
    penHover,
    penPreview,
  });

  return {
    isPathEditing,
    isPenDirectSelectionMode,
    isPanning,
    isPenToolActive,
    node,
    nodeId,
    scene,
    transformTargetStyle,
  };
};

export const CanvasVectorEditor = ({ viewportRevision }) => {
  const editor = useEditor();
  const paperSessionRef = useRef(null);
  const sceneRef = useRef(null);
  const [paperCanvasElement, setPaperCanvasElement] =
    useState<HTMLCanvasElement | null>(null);
  const [hoveredCornerHandlePoint, setHoveredCornerHandlePoint] =
    useState(null);
  const [activeDragSession, setActiveDragSession] =
    useState<VectorCornerDragSession | null>(null);
  const [transformTargetElement, setTransformTargetElement] = useState(null);
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const penDirectSelectionModifierPressed = useEditorValue(
    (_, state) => state.penDirectSelectionModifierPressed
  );
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const overlayState = useEditorPathEditingPreviewSurfaceValue((editor) => {
    return editor.getVectorPathOverlayState();
  });
  const {
    isPathEditing,
    isPenDirectSelectionMode,
    isPanning,
    isPenToolActive,
    node,
    nodeId,
    scene,
    transformTargetStyle,
  } = getVectorPathOverlayRenderState({
    activeDragSession,
    activeTool,
    editor,
    hoveredCornerHandlePoint,
    overlayState,
    penDirectSelectionModifierPressed,
    spacePressed,
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

    const session = createVectorPathSession({
      canvas: paperCanvasElement,
      editor,
      nodeId,
      onChange: (contours, options) => {
        if (!nodeId) {
          return;
        }

        if (options?.transient) {
          editor.setPathEditingPreview(
            nodeId,
            contours,
            getPersistentSyncOptions(options)
          );
          return;
        }

        editor.updateEditablePath(nodeId, contours, options);
        editor.clearPathEditingPreview(nodeId);
      },
      onExitPathEditing: () => {
        if (editor.activeTool === "node") {
          editor.setActiveTool("pointer");
          return;
        }

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
      className={`absolute inset-0 z-20 ${isPanning || (isPenToolActive && !isPenDirectSelectionMode) ? "pointer-events-none" : ""}`}
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

      <CanvasAnchorGhost
        matrix={scene?.matrix || null}
        penHover={
          isPenToolActive && !isPenDirectSelectionMode
            ? scene?.penHover || null
            : null
        }
      />

      {isPenToolActive ? null : (
        <VectorCornerRadiusHandles
          activeDragSession={activeDragSession}
          contours={scene?.contours || null}
          editor={editor}
          hoveredPoint={scene?.hoveredCornerHandlePoint || null}
          matrix={scene?.matrix || null}
          nodeId={node?.id || null}
          onDragStateChange={setActiveDragSession}
          onHoverChange={setHoveredCornerHandlePoint}
          selectedPoints={scene?.selectedPoints || []}
        />
      )}
    </div>
  );
};

const getCanvasPoint = (editor, clientX, clientY) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(host && viewer && editor.zoom > 0)) {
    return null;
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - rect.left) / editor.zoom,
    y: viewer.getScrollTop() + (clientY - rect.top) / editor.zoom,
  };
};

const isPointInBounds = (bounds, point) => {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
};

const getActiveMultiPathNodeId = (editor, overlayStates, clientPoint) => {
  const canvasPoint = clientPoint
    ? getCanvasPoint(editor, clientPoint.x, clientPoint.y)
    : null;

  if (!canvasPoint) {
    return null;
  }

  return (
    [...overlayStates].reverse().find((overlayState) => {
      return (
        editor.hitTestNodePoint(overlayState.node.id, canvasPoint) ||
        isPointInBounds(overlayState.bounds, canvasPoint)
      );
    })?.node.id || null
  );
};

const getPersistentSyncOptions = (options) => {
  if (!options?.transient) {
    return options;
  }

  const persistentOptions = { ...options };
  persistentOptions.transient = undefined;
  return persistentOptions;
};

const getNodeMultiPathScene = ({
  activeTool,
  editor,
  nodeId,
  spacePressed,
}) => {
  const editablePathSession = editor.getEditablePathSession(nodeId);

  if (editablePathSession?.backend !== "vector-path") {
    return null;
  }

  const node = editor.getNode(editablePathSession.nodeId);

  if (!(node && editor.isNodeEffectivelyVisible(node.id))) {
    return null;
  }

  const geometry = editor.getNodeGeometry(node.id);

  if (!geometry?.bbox) {
    return null;
  }

  const metrics = getTextPathHostMetrics(editor);
  const matrix = getNodeHostMatrix(editor, node, geometry.bbox);
  const scene = getVectorPathOverlayScene({
    activeDragSession: null,
    editablePathSession,
    hoveredCornerHandlePoint: null,
    isPanning: spacePressed || activeTool === "hand",
    isPathEditing: true,
    matrix,
    metrics,
    node,
    penHover: null,
    penPreview: null,
  });

  if (!scene) {
    return null;
  }

  return {
    bounds: editor.getNodeRenderFrame(node.id)?.bounds || geometry.bbox,
    node,
    scene,
  };
};

const MultiVectorPathCanvas = ({
  active,
  editor,
  node,
  scene,
  viewportRevision,
}) => {
  const paperSessionRef = useRef(null);
  const sceneRef = useRef(null);
  const [paperCanvasElement, setPaperCanvasElement] =
    useState<HTMLCanvasElement | null>(null);
  sceneRef.current = scene;

  useEffect(() => {
    if (!paperCanvasElement) {
      return;
    }

    const session = createVectorPathSession({
      canvas: paperCanvasElement,
      editor,
      nodeId: node.id,
      onChange: (contours, options) => {
        if (options?.transient) {
          editor.setPathEditingPreview(
            node.id,
            contours,
            getPersistentSyncOptions(options)
          );
          return;
        }

        editor.updateEditablePath(node.id, contours, options);
        editor.clearPathEditingPreview(node.id);
      },
      onExitPathEditing: () => {
        editor.clearSelection();
      },
      onHistoryCommit: (historyMark) => {
        if (historyMark) {
          editor.commitHistoryStep(historyMark);
        }
      },
      onHistoryStart: () => editor.markHistoryStep("edit vector path"),
      syncPathSelection: false,
    });

    paperSessionRef.current = session;
    session.render(sceneRef.current);

    return () => {
      session.destroy();
      paperSessionRef.current = null;
    };
  }, [editor, node.id, paperCanvasElement]);

  useEffect(() => {
    paperSessionRef.current?.render(scene);
  }, [scene]);

  return (
    <canvas
      className="canvas-vector-paper canvas-multi-vector-paper absolute inset-0 h-full w-full"
      data-active={active ? "true" : "false"}
      data-node-id={node.id}
      data-viewport-revision={viewportRevision}
      ref={setPaperCanvasElement}
      style={{ pointerEvents: active ? "auto" : "none" }}
    />
  );
};

export const CanvasMultiVectorEditor = ({ viewportRevision }) => {
  const editor = useEditor();
  const [activeNodeId, setActiveNodeId] = useState(null);
  const lastClientPointRef = useRef(null);
  const overlayStates = useEditorPathEditingPreviewSurfaceValue(
    (editor, state) => {
      if (
        state.activeTool !== "node" ||
        state.editingNodeId ||
        state.pathEditingNodeId ||
        state.isTextPathPositioning
      ) {
        return [];
      }

      return state.selectedNodeIds
        .map((nodeId) =>
          getNodeMultiPathScene({
            activeTool: state.activeTool,
            editor,
            nodeId,
            spacePressed: state.spacePressed,
          })
        )
        .filter(Boolean);
    }
  );

  useEffect(() => {
    if (
      activeNodeId &&
      !overlayStates.some(
        (overlayState) => overlayState.node.id === activeNodeId
      )
    ) {
      setActiveNodeId(null);
    }
  }, [activeNodeId, overlayStates]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const clientPoint = { x: event.clientX, y: event.clientY };
      lastClientPointRef.current = clientPoint;
      const nextActiveNodeId = getActiveMultiPathNodeId(
        editor,
        overlayStates,
        clientPoint
      );

      if (nextActiveNodeId !== activeNodeId) {
        setActiveNodeId(nextActiveNodeId);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [activeNodeId, editor, overlayStates]);

  useEffect(() => {
    const nextActiveNodeId = getActiveMultiPathNodeId(
      editor,
      overlayStates,
      lastClientPointRef.current
    );

    if (nextActiveNodeId !== activeNodeId) {
      setActiveNodeId(nextActiveNodeId);
    }
  }, [activeNodeId, editor, overlayStates]);

  if (overlayStates.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      data-viewport-revision={viewportRevision}
    >
      {overlayStates.map((overlayState) => {
        return (
          <MultiVectorPathCanvas
            active={activeNodeId === overlayState.node.id}
            editor={editor}
            key={overlayState.node.id}
            node={overlayState.node}
            scene={overlayState.scene}
            viewportRevision={viewportRevision}
          />
        );
      })}
    </div>
  );
};
