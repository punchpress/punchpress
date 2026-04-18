import { isNodeVisible } from "@punchpress/engine";
import { useEditorValue } from "../../../editor-react/use-editor-value";

const HOVER_OUTSET_PX = 1;
const PATH_PREVIEW_STROKE_WIDTH_PX = 1.75;

const getHoveredNodePreview = (
  editor,
  {
    activeTool,
    editingNodeId,
    pathEditingNodeId,
    selectedNodeIds,
    spacePressed,
    state,
  }
) => {
  if (
    spacePressed ||
    activeTool !== "pointer" ||
    editingNodeId ||
    state.isHoveringSuppressed ||
    !state.hoveredNodeId
  ) {
    return null;
  }

  const node = editor.getNode(state.hoveredNodeId);

  if (!(node && isNodeVisible(node))) {
    return null;
  }

  if (!pathEditingNodeId) {
    if (selectedNodeIds.includes(state.hoveredNodeId)) {
      return null;
    }

    const frame = editor.getNodeRenderFrame(node.id);

    if (!frame) {
      return null;
    }

    return {
      bounds: frame.bounds,
      kind: "bounds" as const,
      transform: frame.transform,
    };
  }

  if (state.hoveredNodeId === pathEditingNodeId) {
    return null;
  }

  const geometry = editor.getNodeRenderGeometry(node.id);
  const frame = editor.getNodeRenderFrame(node.id);

  if (!(geometry?.paths?.length && geometry.bbox && frame?.bounds)) {
    return null;
  }

  return {
    bbox: geometry.bbox,
    bounds: frame.bounds,
    kind: "path" as const,
    paths: geometry.paths,
    transform: frame.transform,
  };
};

const PathHoverPreview = ({ bbox, bounds, paths, transform }) => {
  return (
    <div
      className="canvas-hover-preview pointer-events-none absolute"
      data-preview-kind="path"
      style={{
        height: `${Math.max(1, bounds.height)}px`,
        transform: transform
          ? `translate3d(${bounds.minX}px, ${bounds.minY}px, 0) ${transform}`
          : `translate3d(${bounds.minX}px, ${bounds.minY}px, 0)`,
        transformOrigin: "center center",
        width: `${Math.max(1, bounds.width)}px`,
      }}
    >
      <svg
        aria-hidden="true"
        className="block overflow-visible"
        focusable="false"
        height={Math.max(1, bounds.height)}
        viewBox={`0 0 ${Math.max(1, bounds.width)} ${Math.max(1, bounds.height)}`}
        width={Math.max(1, bounds.width)}
      >
        <g transform={`translate(${-bbox.minX} ${-bbox.minY})`}>
          {paths.map((path) => {
            return (
              <path
                className="canvas-hover-preview-path"
                d={path.d}
                fill="none"
                key={path.key || path.d}
                stroke="var(--canvas-handle-accent)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={PATH_PREVIEW_STROKE_WIDTH_PX}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};

const BoundsHoverPreview = ({ bounds, transform }) => {
  return (
    <div
      className="canvas-hover-preview pointer-events-none absolute"
      data-preview-kind="bounds"
      style={{
        height: `${bounds.height + HOVER_OUTSET_PX * 2}px`,
        transform: transform
          ? `translate3d(${bounds.minX - HOVER_OUTSET_PX}px, ${bounds.minY - HOVER_OUTSET_PX}px, 0) ${transform}`
          : `translate3d(${bounds.minX - HOVER_OUTSET_PX}px, ${bounds.minY - HOVER_OUTSET_PX}px, 0)`,
        transformOrigin: "center center",
        width: `${bounds.width + HOVER_OUTSET_PX * 2}px`,
      }}
    />
  );
};

export const CanvasHoverPreview = () => {
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const pathEditingNodeId = useEditorValue(
    (_, state) => state.pathEditingNodeId
  );
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const selectedNodeIds = useEditorValue((_, state) => state.selectedNodeIds);
  const hoveredNodePreview = useEditorValue((editor, state) => {
    return getHoveredNodePreview(editor, {
      activeTool,
      editingNodeId,
      pathEditingNodeId,
      selectedNodeIds,
      spacePressed,
      state,
    });
  });

  if (!hoveredNodePreview) {
    return null;
  }

  if (hoveredNodePreview.kind === "path") {
    return <PathHoverPreview {...hoveredNodePreview} />;
  }

  return <BoundsHoverPreview {...hoveredNodePreview} />;
};
