import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasStage } from "./components/canvas-stage";
import { CanvasTextEditor } from "./components/canvas-text-editor";
import { EditorToolbar } from "./components/editor-toolbar";
import { PropertiesPanel } from "./components/properties-panel";
import { FALLBACK_FONTS } from "./editor/constants";
import { isInputElement } from "./editor/dom-utils";
import { getEditableFontFamily, getLoadedFont } from "./editor/font-cache";
import { clamp, round } from "./editor/math-utils";
import { createDefaultNode } from "./editor/model";
import { measureStraightText } from "./editor/straight-text-metrics";
import { buildSvgExport } from "./editor/warp-engine";
import { useEditorBootstrap } from "./hooks/use-editor-bootstrap";
import { useEditorCanvas } from "./hooks/use-editor-canvas";
import { useFontPreload } from "./hooks/use-font-preload";
import { useNodeGeometries } from "./hooks/use-node-geometries";

const toCommittedText = (value) => {
  return value.trim().length > 0 ? value : " ";
};

const TOOL_POINTER = "pointer";
const TOOL_HAND = "hand";
const TOOL_TEXT = "text";

export const App = () => {
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [fontRevision, setFontRevision] = useState(0);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [activeTool, setActiveTool] = useState(TOOL_POINTER);

  const fontCacheRef = useRef(new Map());
  const lastPointerDownRef = useRef({ nodeId: null, time: 0 });
  const resizeInteractionRef = useRef(null);

  const { accent, bootstrapError, bootstrapState, fonts } =
    useEditorBootstrap();

  const {
    applyToolbarZoom,
    handleCanvasBackgroundPointerDown,
    handleNodePointerDown,
    handleWheel,
    handleWorkspacePointerDown,
    pan,
    spacePressed,
    workspaceRef,
    zoom,
  } = useEditorCanvas(setNodes, setSelectedNodeId, activeTool === TOOL_HAND);

  useFontPreload(fontCacheRef, fonts, nodes, setFontRevision);

  const geometryById = useNodeGeometries(fontCacheRef, fontRevision, nodes);

  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const hoveredNode = useMemo(() => {
    return nodes.find((node) => node.id === hoveredNodeId) || null;
  }, [hoveredNodeId, nodes]);

  const editingNode = useMemo(() => {
    return nodes.find((node) => node.id === editingNodeId) || null;
  }, [editingNodeId, nodes]);

  const editingFont = useMemo(() => {
    if (!editingNode) {
      return null;
    }

    return getLoadedFont(editingNode.fontUrl, fontCacheRef, fontRevision);
  }, [editingNode, fontRevision]);

  const editingMetrics = useMemo(() => {
    if (!(editingNode && editingFont)) {
      return null;
    }

    return measureStraightText(editingNode, editingFont);
  }, [editingFont, editingNode]);

  const editingFontFamily = useMemo(() => {
    if (!editingNode) {
      return "DM Sans, sans-serif";
    }

    return getEditableFontFamily(editingNode.fontUrl, fontCacheRef);
  }, [editingNode]);

  const selectedGeometry =
    selectedNode && geometryById.has(selectedNode.id)
      ? geometryById.get(selectedNode.id)
      : null;

  const hoveredGeometry =
    hoveredNode && geometryById.has(hoveredNode.id)
      ? geometryById.get(hoveredNode.id)
      : null;

  const updateSelectedNode = useCallback(
    (updater) => {
      if (!selectedNodeId) {
        return;
      }

      setNodes((currentNodes) => {
        return currentNodes.map((node) => {
          if (node.id !== selectedNodeId) {
            return node;
          }

          return typeof updater === "function"
            ? updater(node)
            : { ...node, ...updater };
        });
      });
    },
    [selectedNodeId]
  );

  const addTextNode = useCallback(
    (point) => {
      const defaultFontUrl = fonts[0]?.url || FALLBACK_FONTS[0].url;
      const node = createDefaultNode(defaultFontUrl);
      if (point) {
        node.x = round(point.x, 2);
        node.y = round(point.y, 2);
      }

      setNodes((currentNodes) => [...currentNodes, node]);
      setSelectedNodeId(node.id);
      setEditingNodeId(node.id);
      setEditingText(node.text);
    },
    [fonts]
  );

  const commitEditing = useCallback(() => {
    if (!editingNodeId) {
      return;
    }

    const nextText = toCommittedText(editingText);
    setNodes((currentNodes) => {
      return currentNodes.map((node) => {
        if (node.id !== editingNodeId) {
          return node;
        }

        if (node.text === nextText) {
          return node;
        }

        return {
          ...node,
          text: nextText,
        };
      });
    });

    setEditingNodeId(null);
    if (activeTool === TOOL_TEXT) {
      setActiveTool(TOOL_POINTER);
    }
  }, [activeTool, editingNodeId, editingText]);

  const cancelEditing = useCallback(() => {
    setEditingNodeId(null);
  }, []);

  const startEditing = useCallback((node) => {
    setSelectedNodeId(node.id);
    setEditingNodeId(node.id);
    setEditingText(node.text);
  }, []);

  useEffect(() => {
    const keyToTool = {
      v: TOOL_POINTER,
      h: TOOL_HAND,
      t: TOOL_TEXT,
    };

    const onKeyDown = (event) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isInputElement(event.target)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const nextTool = keyToTool[key];
      if (!nextTool) {
        return;
      }

      event.preventDefault();
      if (editingNodeId && nextTool !== TOOL_TEXT) {
        commitEditing();
      }

      setActiveTool(nextTool);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [commitEditing, editingNodeId]);

  useEffect(() => {
    if (!editingNodeId) {
      return;
    }

    const stillExists = nodes.some((node) => node.id === editingNodeId);
    if (!stillExists) {
      setEditingNodeId(null);
    }
  }, [editingNodeId, nodes]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) {
      return;
    }

    if (editingNodeId === selectedNodeId) {
      setEditingNodeId(null);
    }

    setNodes((currentNodes) => {
      return currentNodes.filter((node) => node.id !== selectedNodeId);
    });
    setSelectedNodeId(null);
  }, [editingNodeId, selectedNodeId]);

  const exportSvg = useCallback(() => {
    const svg = buildSvgExport(nodes, geometryById);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "warped-text-export.svg";
    link.click();

    URL.revokeObjectURL(url);
  }, [geometryById, nodes]);

  const handleNodePointerDownWithEditing = useCallback(
    (event, node) => {
      const now = Date.now();
      const isDoubleClick =
        lastPointerDownRef.current.nodeId === node.id &&
        now - lastPointerDownRef.current.time < 320;

      lastPointerDownRef.current = { nodeId: node.id, time: now };

      if (isDoubleClick) {
        event.preventDefault();
        event.stopPropagation();

        if (editingNodeId && editingNodeId !== node.id) {
          commitEditing();
        }

        startEditing(node);
        return;
      }

      if (editingNodeId) {
        if (editingNodeId === node.id) {
          return;
        }
        commitEditing();
      }

      handleNodePointerDown(event, node);
    },
    [commitEditing, editingNodeId, handleNodePointerDown, startEditing]
  );

  const handleCanvasBackgroundPointerDownWithEditing = useCallback(
    (event) => {
      if (editingNodeId) {
        commitEditing();
      }

      handleCanvasBackgroundPointerDown(event);
    },
    [commitEditing, editingNodeId, handleCanvasBackgroundPointerDown]
  );

  const handleTextToolCanvasPointerDown = useCallback(
    (event, canvasPoint) => {
      if (event.button !== 0 || !canvasPoint) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (editingNodeId) {
        commitEditing();
        return;
      }

      addTextNode(canvasPoint);
    },
    [addTextNode, commitEditing, editingNodeId]
  );

  const handleTextToolNodePointerDown = useCallback(
    (event, node) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (editingNodeId && editingNodeId !== node.id) {
        commitEditing();
      }

      startEditing(node);
    },
    [commitEditing, editingNodeId, startEditing]
  );

  const inlineEditor =
    editingNode && editingNodeId ? (
      <CanvasTextEditor
        editingText={editingText}
        fontFamily={editingFontFamily}
        metrics={editingMetrics}
        node={editingNode}
        onCancel={cancelEditing}
        onChange={setEditingText}
        onCommit={commitEditing}
      />
    ) : null;

  const getCanvasPointFromClient = useCallback(
    (clientX, clientY) => {
      const workspaceElement = workspaceRef.current;
      if (!workspaceElement) {
        return null;
      }

      const rect = workspaceElement.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, workspaceRef, zoom]
  );

  const handleResizeHandlePointerDown = useCallback(
    (event, node, geometry, handleId, canvasPoint) => {
      if (!(canvasPoint && geometry)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (editingNodeId) {
        commitEditing();
      }

      setSelectedNodeId(node.id);

      const centerX = node.x + (geometry.bbox.minX + geometry.bbox.maxX) / 2;
      const centerY = node.y + (geometry.bbox.minY + geometry.bbox.maxY) / 2;
      const startDistance = Math.hypot(
        canvasPoint.x - centerX,
        canvasPoint.y - centerY
      );

      resizeInteractionRef.current = {
        nodeId: node.id,
        handleId,
        centerX,
        centerY,
        startDistance: Math.max(startDistance, 1),
        startFontSize: node.fontSize,
        startTracking: node.tracking,
        startStrokeWidth: node.strokeWidth,
      };
    },
    [commitEditing, editingNodeId]
  );

  useEffect(() => {
    const onPointerMove = (event) => {
      const interaction = resizeInteractionRef.current;
      if (!interaction) {
        return;
      }

      const canvasPoint = getCanvasPointFromClient(
        event.clientX,
        event.clientY
      );
      if (!canvasPoint) {
        return;
      }

      const distance = Math.hypot(
        canvasPoint.x - interaction.centerX,
        canvasPoint.y - interaction.centerY
      );

      const scale = clamp(distance / interaction.startDistance, 0.08, 20);

      setNodes((currentNodes) => {
        return currentNodes.map((node) => {
          if (node.id !== interaction.nodeId) {
            return node;
          }

          return {
            ...node,
            fontSize: round(Math.max(8, interaction.startFontSize * scale), 2),
            tracking: round(interaction.startTracking * scale, 2),
            strokeWidth: round(
              Math.max(0, interaction.startStrokeWidth * scale),
              2
            ),
          };
        });
      });
    };

    const onPointerUp = () => {
      resizeInteractionRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [getCanvasPointFromClient]);

  return (
    <div className="editor-shell" style={{ "--accent": accent }}>
      <EditorToolbar
        activeTool={activeTool}
        onExportSvg={exportSvg}
        onSelectTool={(toolId) => {
          if (editingNodeId && toolId !== TOOL_TEXT) {
            commitEditing();
          }

          setActiveTool(toolId);
        }}
        onZoomIn={() => applyToolbarZoom(1.12)}
        onZoomOut={() => applyToolbarZoom(0.88)}
        zoom={zoom}
      />

      <main className="workspace-layout">
        <CanvasStage
          activeTool={activeTool}
          editingNodeId={editingNodeId}
          geometryById={geometryById}
          handleCanvasBackgroundPointerDown={
            handleCanvasBackgroundPointerDownWithEditing
          }
          handleNodePointerDown={handleNodePointerDownWithEditing}
          hoveredGeometry={hoveredGeometry}
          hoveredNode={hoveredNode}
          hoveredNodeId={hoveredNodeId}
          inlineEditor={inlineEditor}
          nodes={nodes}
          onResizeHandlePointerDown={handleResizeHandlePointerDown}
          onTextToolCanvasPointerDown={handleTextToolCanvasPointerDown}
          onTextToolNodePointerDown={handleTextToolNodePointerDown}
          onWheel={handleWheel}
          onWorkspacePointerDown={handleWorkspacePointerDown}
          pan={pan}
          selectedGeometry={selectedGeometry}
          selectedNode={selectedNode}
          selectedNodeId={selectedNodeId}
          setHoveredNodeId={setHoveredNodeId}
          spacePressed={spacePressed}
          workspaceRef={workspaceRef}
          zoom={zoom}
        />

        <PropertiesPanel
          bootstrapError={bootstrapError}
          bootstrapState={bootstrapState}
          deleteSelected={deleteSelectedNode}
          fonts={fonts}
          selectedNode={selectedNode}
          updateSelectedNode={updateSelectedNode}
        />
      </main>

      <footer className="status-bar">
        <div>
          Status: {nodes.length} element{nodes.length === 1 ? "" : "s"} | Zoom{" "}
          {Math.round(zoom * 100)}%
        </div>
        <div>
          {bootstrapState === "loading"
            ? "Bootstrapping tRPC..."
            : "Archetype PoC"}
        </div>
      </footer>
    </div>
  );
};
