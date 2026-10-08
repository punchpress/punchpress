import { getPathNodeContours } from "@punchpress/engine";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { LayerContourRow } from "./layer-tree-row";

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

  return (
    <LayerContourRow
      depth={depth}
      isSelected={isSelected}
      label={`Contour ${contourIndex + 1}`}
      onSelect={() => {
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
      }}
      tone={isClosed ? "closed" : "open"}
    />
  );
};
