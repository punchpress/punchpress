import type { Editor } from "@punchpress/engine";
import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { getCompoundVectorOperationTarget } from "@/lib/vector-compound-operation";

const getCanGroupSelection = (editor: Editor, nodeIds: string[]) => {
  return (
    nodeIds.length > 1 &&
    new Set(
      nodeIds
        .map((nodeId) => editor.getNode(nodeId)?.parentId || ROOT_PARENT_ID)
        .filter(Boolean)
    ).size === 1
  );
};

export const getNodeContextTargetNodeIds = ({
  isSelected,
  nodeId,
  selectedNodeIds,
}: {
  isSelected: boolean;
  nodeId: string;
  selectedNodeIds: string[];
}) => {
  return isSelected && selectedNodeIds.length > 0 ? selectedNodeIds : [nodeId];
};

export const getNodeContextMenuState = ({
  editor,
  isSelected,
  nodeId,
  selectedNodeIds,
}: {
  editor: Editor;
  isSelected: boolean;
  nodeId: string;
  selectedNodeIds: string[];
}) => {
  const targetNodeIds = getNodeContextTargetNodeIds({
    isSelected,
    nodeId,
    selectedNodeIds,
  });
  const singleTargetNodeId =
    targetNodeIds.length === 1 ? targetNodeIds[0] || null : null;
  const singleTargetLayer = singleTargetNodeId
    ? editor.getLayerRow(singleTargetNodeId)
    : null;
  const areAllTargetsVisible =
    targetNodeIds.length > 0 &&
    targetNodeIds.every((targetNodeId) =>
      editor.isNodeEffectivelyVisible(targetNodeId)
    );
  let visibilityLabel = singleTargetLayer?.visibilityLabel || "Hide layer";

  if (targetNodeIds.length > 1) {
    visibilityLabel = areAllTargetsVisible ? "Hide Selected" : "Show Selected";
  } else if (!areAllTargetsVisible) {
    visibilityLabel = "Show layer";
  }

  return {
    canGroupSelection: getCanGroupSelection(editor, targetNodeIds),
    canConvertShapeToPath: Boolean(
      singleTargetNodeId && editor.canConvertShapeToPath(singleTargetNodeId)
    ),
    canMakeCompoundPath: editor.canMakeCompoundPath(targetNodeIds),
    canReleaseCompoundPath: editor.canReleaseCompoundPath(targetNodeIds),
    canUngroup: Boolean(
      singleTargetNodeId && editor.isGroupNode(singleTargetNodeId)
    ),
    compoundOperationTarget:
      singleTargetNodeId === nodeId
        ? getCompoundVectorOperationTarget(editor, nodeId)
        : null,
    isMultiTarget: targetNodeIds.length > 1,
    nextVisibility: !areAllTargetsVisible,
    singleTargetLayer,
    singleTargetNodeId,
    targetNodeIds,
    visibilityLabel,
  };
};

export const applyNodeContextVisibility = (
  editor: Editor,
  nodeIds: string[],
  visible: boolean
) => {
  editor.updateNodes(nodeIds, (node) => {
    return {
      ...node,
      visible,
    };
  });
};
