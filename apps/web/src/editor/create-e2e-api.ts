import {
  getResizeAnchorFromBounds,
  getScaledGroupNodeUpdate,
} from "./primitives/group-resize";
import { round } from "./primitives/math";

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
    strokeWidth: node.strokeWidth,
    text: node.text,
    tracking: node.tracking,
    x: node.x,
    y: node.y,
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
        selectedNodeIds: editor.selectedNodeIds,
        selectedNodeId: editor.selectedNodeId,
        zoom: editor.zoom,
      };
    },
    getStateSnapshot: () => {
      const state = editor.getState();

      return {
        activeTool: state.activeTool,
        editingNodeId: state.editingNodeId,
        nodes: state.nodes.map((node) => ({
          fill: node.fill,
          fontSize: node.fontSize,
          fontUrl: node.fontUrl,
          id: node.id,
          kind: node.kind,
          stroke: node.stroke,
          strokeWidth: node.strokeWidth,
          text: node.text,
          tracking: node.tracking,
          visible: node.visible,
          warp: { ...node.warp },
          x: node.x,
          y: node.y,
        })),
        selectedNodeIds: state.selectedNodeIds,
        selectedNodeId: editor.selectedNodeId,
        zoom: state.viewport.zoom,
      };
    },
    moveSelectedNodeBy: ({ x = 0, y = 0 } = {}) => {
      if (editor.selectedNodeIds.length === 0) {
        return null;
      }

      editor.updateNodes(editor.selectedNodeIds, (node) => ({
        x: round(node.x + x, 2),
        y: round(node.y + y, 2),
      }));
      queueOverlayRefresh(editor);

      return editor.selectedNodeId;
    },
    scaleSelectedNodeBy: ({ scale = 1 } = {}) => {
      const selectedNode = editor.selectedNode;
      const geometry = editor.getNodeGeometry(selectedNode?.id);
      const bbox = geometry?.bbox;

      if (!(selectedNode && bbox)) {
        return null;
      }

      editor.updateNode(selectedNode.id, {
        fontSize: round(Math.max(1, selectedNode.fontSize * scale), 2),
        strokeWidth: round(Math.max(0, selectedNode.strokeWidth * scale), 2),
        tracking: round(selectedNode.tracking * scale, 2),
        x: round(selectedNode.x + bbox.minX - bbox.minX * scale, 2),
        y: round(selectedNode.y + bbox.minY - bbox.minY * scale, 2),
      });
      queueOverlayRefresh(editor);

      return selectedNode.id;
    },
    scaleSelectedGroupBy: ({ corner = "sw", scale = 1 } = {}) => {
      if (editor.selectedNodeIds.length === 0) {
        return [];
      }

      const selectionBounds = editor.getSelectionBounds(editor.selectedNodeIds);
      const directionByCorner = {
        ne: [1, -1],
        nw: [-1, -1],
        se: [1, 1],
        sw: [-1, 1],
      };
      const direction = directionByCorner[corner];

      if (!(selectionBounds && direction)) {
        return [];
      }

      const anchor = getResizeAnchorFromBounds(selectionBounds, direction);
      const baseNodes = new Map(
        editor.selectedNodes.map((node) => [node.id, { ...node }])
      );

      editor.updateNodes(editor.selectedNodeIds, (node) => {
        const baseNode = baseNodes.get(node.id);

        if (!baseNode) {
          return node;
        }

        return getScaledGroupNodeUpdate(baseNode, anchor, scale);
      });
      queueOverlayRefresh(editor);

      return editor.selectedNodeIds;
    },
  };
};
