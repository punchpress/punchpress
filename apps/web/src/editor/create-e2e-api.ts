import { createLocalFontDescriptor } from "./local-fonts";
import { getNodeRotation, getNodeX, getNodeY } from "./shapes/warp-text/model";

const toRect = (rect) => {
  if (!rect) {
    return null;
  }

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
    x: rect.x,
    y: rect.y,
  };
};

const toBBox = (bbox) => {
  if (!bbox) {
    return null;
  }

  return {
    height: bbox.height,
    maxX: bbox.maxX,
    maxY: bbox.maxY,
    minX: bbox.minX,
    minY: bbox.minY,
    width: bbox.width,
  };
};

const getResizeHandleSelector = (direction) => {
  return `.canvas-moveable .moveable-control.moveable-${direction}`;
};

const queueOverlayRefresh = (editor) => {
  if (typeof window === "undefined") {
    editor.onViewportChange?.();
    return;
  }

  window.requestAnimationFrame(() => {
    editor.onViewportChange?.();
  });
};

const getNodeSnapshot = (editor, nodeId) => {
  const node = editor.getNode(nodeId);
  if (!node) {
    return null;
  }

  const geometry = editor.getNodeGeometry(nodeId);
  const element = editor.getNodeElement(nodeId);

  return {
    bbox: toBBox(geometry?.bbox),
    elementRect: toRect(element?.getBoundingClientRect?.()),
    fontSize: node.fontSize,
    id: node.id,
    ready: Boolean(geometry?.ready),
    rotation: getNodeRotation(node) || 0,
    strokeWidth: node.strokeWidth,
    text: node.text,
    tracking: node.tracking,
    x: getNodeX(node),
    y: getNodeY(node),
  };
};

export const createEditorE2eApi = (editor) => {
  return {
    createTextNode: ({ text = "YOUR TEXT", x = 600, y = 450 } = {}) => {
      editor.addTextNode({ x, y });
      editor.setEditingText(text);
      editor.finalizeEditing();
      return editor.selectedNodeId;
    },
    exportDocument: () => {
      return editor.exportDocument();
    },
    requestLocalFonts: () => {
      return editor.requestLocalFonts();
    },
    getNodeSnapshot: (nodeId) => {
      return getNodeSnapshot(editor, nodeId);
    },
    getSelectionSnapshot: () => {
      const host = editor.hostRef;

      return {
        handles: {
          ne: toRect(
            host
              ?.querySelector(getResizeHandleSelector("ne"))
              ?.getBoundingClientRect?.()
          ),
          nw: toRect(
            host
              ?.querySelector(getResizeHandleSelector("nw"))
              ?.getBoundingClientRect?.()
          ),
          se: toRect(
            host
              ?.querySelector(getResizeHandleSelector("se"))
              ?.getBoundingClientRect?.()
          ),
          sw: toRect(
            host
              ?.querySelector(getResizeHandleSelector("sw"))
              ?.getBoundingClientRect?.()
          ),
        },
        isMoveableMuted: host?.classList.contains(
          "canvas-overlay-moveable-muted"
        ),
        selectedNodeIds: editor.selectedNodeIds,
        selectedNodeId: editor.selectedNodeId,
        zoom: editor.zoom,
      };
    },
    panViewportBy: ({ x = 0, y = 0 } = {}) => {
      const viewer = editor.viewerRef;

      if (!viewer) {
        return false;
      }

      viewer.scrollBy(x, y);
      queueOverlayRefresh(editor);

      return true;
    },
    getStateSnapshot: () => {
      const state = editor.getState();

      return {
        activeTool: state.activeTool,
        editingNodeId: state.editingNodeId,
        nodes: state.nodes.map((node) => ({
          fill: node.fill,
          fontSize: node.fontSize,
          font: { ...node.font },
          id: node.id,
          rotation: getNodeRotation(node) || 0,
          stroke: node.stroke,
          strokeWidth: node.strokeWidth,
          text: node.text,
          tracking: node.tracking,
          type: node.type,
          visible: node.visible,
          warp: { ...node.warp },
          x: getNodeX(node),
          y: getNodeY(node),
        })),
        selectedNodeIds: state.selectedNodeIds,
        selectedNodeId: editor.selectedNodeId,
        zoom: state.viewport.zoom,
      };
    },
    getDebugDump: () => {
      return editor.getDebugDump();
    },
    loadDocument: (contents) => {
      editor.loadDocument(contents);
      return editor.selectedNodeId;
    },
    moveSelectedNodeBy: ({ x = 0, y = 0 } = {}) => {
      const movedNodeIds = editor.moveSelectedNodesBy({
        queueRefresh: true,
        x,
        y,
      });

      if (movedNodeIds.length === 0) {
        return null;
      }

      return editor.selectedNodeId;
    },
    serializeDocument: () => {
      return editor.serializeDocument();
    },
    scaleSelectedNodeBy: ({ scale = 1 } = {}) => {
      return editor.scaleSelectedNodeFromCorner({ corner: "se", scale });
    },
    scaleSelectedGroupBy: ({ corner = "sw", scale = 1 } = {}) => {
      return editor.scaleSelectedGroupFromCorner({ corner, scale });
    },
    setSelectedText: (text) => {
      const selectedNode = editor.selectedNode;

      if (!selectedNode) {
        return null;
      }

      editor.updateSelectedNode({ text });
      queueOverlayRefresh(editor);

      return selectedNode.id;
    },
    setSelectedFont: (font) => {
      const selectedNode = editor.selectedNode;

      if (!selectedNode) {
        return null;
      }

      editor.updateSelectedNode({
        font: createLocalFontDescriptor(font),
      });
      queueOverlayRefresh(editor);

      return selectedNode.id;
    },
  };
};
