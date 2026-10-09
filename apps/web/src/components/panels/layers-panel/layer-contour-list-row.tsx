import { getPathNodeContours } from "@punchpress/engine";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { LayerTreeRowParts } from "./layer-tree-row-parts";

export const getLayerEditableContours = (node) => {
  if (node?.type === "path") {
    return getPathNodeContours(node);
  }

  if (node?.type === "vector") {
    return node.contours || [];
  }

  return [];
};

// Reads its own contour and path-editing state so the panel's row list only
// changes when rows are added, removed, or reordered.
export const LayerContourListRow = ({ contourIndex, depth, nodeId }) => {
  const editor = useEditor();
  const { hasSegments, isClosed, isSelected } = useEditorValue(
    (editor, state) => {
      const contour = getLayerEditableContours(editor.getNode(nodeId))[
        contourIndex
      ];

      return {
        hasSegments: contour?.segments.length > 0,
        isClosed: Boolean(contour?.closed),
        isSelected:
          state.pathEditingNodeId === nodeId &&
          state.pathEditingPoint?.contourIndex === contourIndex,
      };
    }
  );

  const handleSelect = () => {
    editor.select(nodeId);
    if (editor.startPathEditing(nodeId)) {
      editor.setActiveTool("node");
    }

    if (hasSegments) {
      editor.setPathEditingPoint({
        contourIndex,
        segmentIndex: 0,
      });
    }
  };

  // Contours sit in the icon column of their depth so labels line up with
  // sibling layer names; the trailing pad keeps the action column clear.
  return (
    <LayerTreeRowParts.Root
      className={isSelected ? undefined : "hover:bg-(--pane-hover)"}
      depth={depth}
      state={isSelected ? "selected" : "idle"}
    >
      <LayerTreeRowParts.Spacer />
      <button
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-inherit outline-none"
        onClick={handleSelect}
        type="button"
      >
        <LayerTreeRowParts.Icon />
        <LayerTreeRowParts.Label className="flex-1 text-foreground/72 group-data-selected/layer-row:text-inherit">
          {`Contour ${contourIndex + 1}`}
        </LayerTreeRowParts.Label>
        <span className="text-(length:--section-title-text) shrink-0 font-semibold text-(--section-title-color) uppercase tracking-(--section-title-tracking) group-data-selected/layer-row:text-white/80">
          {isClosed ? "closed" : "open"}
        </span>
      </button>
      <span aria-hidden="true" className="w-(--field-icon-button) shrink-0" />
    </LayerTreeRowParts.Root>
  );
};
