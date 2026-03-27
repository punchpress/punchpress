export const getEditorDebugDump = (editor) => {
  const state = editor.getState();
  const serializedDocument = editor.serializeDocument();
  const document = JSON.parse(serializedDocument);

  return {
    bootstrap: {
      defaultFont: { ...editor.getDefaultFont() },
      error: editor.fontCatalogError,
      fontCatalogState: editor.fontCatalogState,
      state: editor.bootstrapState,
    },
    document: {
      isDirty: editor.isDirty,
      nodeCount: editor.nodes.length,
      serialized: serializedDocument,
      version: document.version,
    },
    editing: {
      focusedGroupId: state.focusedGroupId,
      nodeId: state.editingNodeId,
      originalText: state.editingOriginalText,
      pathNodeId: state.pathEditingNodeId,
      pathPoint: state.pathEditingPoint,
      text: state.editingText,
    },
    hoveredNodeId: editor.hoveredNodeId,
    nodes: editor.nodes.map((node) => {
      const geometry = editor.getNodeGeometry(node.id);
      const renderFrame = editor.getNodeRenderFrame(node.id);
      const frame = editor.getNodeFrame(node.id);
      const element = editor.getNodeElement(node.id);
      const nodeDetails = (() => {
        if (node.type === "text") {
          return {
            fill: node.fill,
            font: { ...node.font },
            fontSize: node.fontSize,
            stroke: node.stroke,
            strokeWidth: node.strokeWidth,
            text: node.text,
            tracking: node.tracking,
            warp: { ...node.warp },
          };
        }

        if (node.type === "shape") {
          return {
            fill: node.fill,
            font: null,
            fontSize: null,
            height: node.height,
            shape: node.shape,
            stroke: node.stroke,
            strokeWidth: node.strokeWidth,
            text: "",
            tracking: null,
            warp: null,
            width: node.width,
          };
        }

        if (node.type === "vector") {
          return {
            contours: node.contours.map((contour) => ({
              closed: contour.closed,
              segments: contour.segments.length,
            })),
            fill: node.fill,
            fillRule: node.fillRule,
            font: null,
            fontSize: null,
            stroke: node.stroke,
            strokeWidth: node.strokeWidth,
            text: "",
            tracking: null,
            warp: null,
          };
        }

        return {
          fill: null,
          font: null,
          fontSize: null,
          stroke: null,
          strokeWidth: null,
          text: "",
          tracking: null,
          warp: null,
        };
      })();

      return {
        elementRect: toRect(element?.getBoundingClientRect?.()),
        frame: toFrame(frame),
        renderFrame: toFrame(renderFrame),
        geometry: {
          bbox: toBounds(geometry?.bbox),
          pathCount: geometry?.paths?.length || 0,
          ready: Boolean(geometry?.ready),
        },
        id: node.id,
        parentId: node.parentId,
        rotation: node.transform.rotation,
        transform: { ...node.transform },
        type: node.type,
        visible: node.visible,
        ...nodeDetails,
      };
    }),
    selection: {
      bounds: toBounds(editor.getSelectionBounds(state.selectedNodeIds)),
      frameKey: editor.getSelectionFrameKey(state.selectedNodeIds),
      handleRects: getSelectionHandleRects(editor),
      ids: [...state.selectedNodeIds],
      previewDelta: editor.selectionDragPreview?.delta || null,
      primaryId: editor.selectedNodeId,
    },
    nextShapeKind: state.nextShapeKind,
    tool: state.activeTool,
    viewport: {
      zoom: state.viewport.zoom,
    },
  };
};

const toBounds = (bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    height: bounds.height,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    minX: bounds.minX,
    minY: bounds.minY,
    width: bounds.width,
  };
};

const toFrame = (frame) => {
  if (!frame) {
    return null;
  }

  return {
    bounds: toBounds(frame.bounds),
    transform: frame.transform,
  };
};

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

const getSelectionHandleRects = (editor) => {
  const host = editor.hostRef;

  return {
    ne: toRect(
      host
        ?.querySelector(".canvas-moveable .moveable-control.moveable-ne")
        ?.getBoundingClientRect?.()
    ),
    nw: toRect(
      host
        ?.querySelector(".canvas-moveable .moveable-control.moveable-nw")
        ?.getBoundingClientRect?.()
    ),
    se: toRect(
      host
        ?.querySelector(".canvas-moveable .moveable-control.moveable-se")
        ?.getBoundingClientRect?.()
    ),
    sw: toRect(
      host
        ?.querySelector(".canvas-moveable .moveable-control.moveable-sw")
        ?.getBoundingClientRect?.()
    ),
  };
};
