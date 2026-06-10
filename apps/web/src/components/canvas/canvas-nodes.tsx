import { isArtboardNode, isEmptyNode, isGroupNode } from "@punchpress/engine";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { CanvasNode } from "./canvas-node";
import { useCanvasNodePlacement } from "./use-canvas-node-placement";

const DENSE_GROUP_RENDER_THRESHOLD = 300;
const LARGE_GROUP_RENDER_AREA_THRESHOLD = 3_000_000;
const LARGE_GROUP_RENDER_LEAF_THRESHOLD = 24;

const collectDescendantNodeIds = (editor, nodeId) => {
  const descendantNodeIds: string[] = [];

  const visit = (parentId) => {
    for (const childNodeId of editor.getChildNodeIds(parentId)) {
      descendantNodeIds.push(childNodeId);
      visit(childNodeId);
    }
  };

  visit(nodeId);

  return descendantNodeIds;
};

const shouldRenderGroupSurface = (editor, node) => {
  if (!isGroupNode(node) || editor.focusedGroupId === node.id) {
    return false;
  }

  const leafCount = editor.getDescendantLeafNodeIds(node.id).length;

  if (leafCount > DENSE_GROUP_RENDER_THRESHOLD) {
    return true;
  }

  if (leafCount <= LARGE_GROUP_RENDER_LEAF_THRESHOLD) {
    return false;
  }

  const bounds = editor.getNodeRenderFrame(node.id)?.bounds;
  const area = (bounds?.width || 0) * (bounds?.height || 0);

  return area > LARGE_GROUP_RENDER_AREA_THRESHOLD;
};

const shouldRenderNode = (editor, node) => {
  if (isArtboardNode(node)) {
    return false;
  }

  if (isEmptyNode(node)) {
    return false;
  }

  if (isGroupNode(node)) {
    return shouldRenderGroupSurface(editor, node);
  }

  if (node.type !== "path") {
    return true;
  }

  return editor.getNode(node.parentId)?.type !== "vector";
};

const selectNodeIds = (editor, state) => {
  const hiddenNodeIds = new Set();
  const nodeIds: string[] = [];

  for (const node of state.nodes) {
    if (
      hiddenNodeIds.has(node.id) ||
      !editor.isNodeEffectivelyVisible(node.id)
    ) {
      continue;
    }

    if (shouldRenderGroupSurface(editor, node)) {
      nodeIds.push(node.id);

      for (const descendantNodeId of collectDescendantNodeIds(
        editor,
        node.id
      )) {
        hiddenNodeIds.add(descendantNodeId);
      }
      continue;
    }

    if (shouldRenderNode(editor, node)) {
      nodeIds.push(node.id);
    }
  }

  return nodeIds;
};

export const CanvasNodes = () => {
  const nodeIds = useEditorValue(selectNodeIds);

  useCanvasNodePlacement(nodeIds);

  return (
    <div className="canvas-node-layer absolute inset-0">
      {nodeIds.map((nodeId) => {
        return <CanvasNode key={nodeId} nodeId={nodeId} />;
      })}
    </div>
  );
};
