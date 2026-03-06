import { useEffect, useMemo, useRef } from "react";
import { useEditorBootstrap } from "../../hooks/use-editor-bootstrap";
import { useFontPreload } from "../../hooks/use-font-preload";
import { useNodeGeometries } from "../../hooks/use-node-geometries";
import { getEditableFontFamily, getLoadedFont } from "../font-cache";
import { measureStraightText } from "../straight-text-metrics";
import { useEditorStore } from "./editor-store";

export const useEditorSession = () => {
  const activeTool = useEditorStore((state) => state.activeTool);
  const editingNodeId = useEditorStore((state) => state.editingNodeId);
  const editingText = useEditorStore((state) => state.editingText);
  const fontRevision = useEditorStore((state) => state.fontRevision);
  const nodes = useEditorStore((state) => state.nodes);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);

  const addTextNodeBase = useEditorStore((state) => state.addTextNode);
  const cancelEditing = useEditorStore((state) => state.cancelEditing);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const commitEditing = useEditorStore((state) => state.commitEditing);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const selectNode = useEditorStore((state) => state.selectNode);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const setEditingText = useEditorStore((state) => state.setEditingText);
  const setFontRevision = useEditorStore((state) => state.setFontRevision);
  const startEditing = useEditorStore((state) => state.startEditing);
  const updateNodeById = useEditorStore((state) => state.updateNodeById);
  const updateSelectedNode = useEditorStore(
    (state) => state.updateSelectedNode
  );

  const fontCacheRef = useRef(new Map());

  const { accent, bootstrapError, bootstrapState, fonts } =
    useEditorBootstrap();

  useFontPreload(fontCacheRef, fonts, nodes, setFontRevision);

  const geometryById = useNodeGeometries(fontCacheRef, fontRevision, nodes);

  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

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
    if (!(editingFont && editingNode)) {
      return null;
    }

    return measureStraightText(editingNode, editingFont);
  }, [editingFont, editingNode]);

  const editingGeometry =
    editingNode && geometryById.has(editingNode.id)
      ? geometryById.get(editingNode.id)
      : null;

  const editingFontFamily = useMemo(() => {
    if (!editingNode) {
      return "DM Sans, sans-serif";
    }

    return getEditableFontFamily(editingNode.fontUrl, fontCacheRef);
  }, [editingNode]);

  const addTextNode = (point) => {
    addTextNodeBase(fonts, point);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      event.preventDefault();
      deleteSelected();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected]);

  return {
    accent,
    activeTool,
    addTextNode,
    bootstrapError,
    bootstrapState,
    cancelEditing,
    clearSelection,
    commitEditing,
    deleteSelected,
    editingFontFamily,
    editingGeometry,
    editingMetrics,
    editingNode,
    editingNodeId,
    editingText,
    fonts,
    geometryById,
    nodes,
    selectNode,
    selectedNode,
    selectedNodeId,
    setActiveTool,
    setEditingText,
    startEditing,
    updateNodeById,
    updateSelectedNode,
  };
};
