import {
  getVectorChildPathNodes,
  getVectorPathComposition,
} from "../nodes/vector/vector-path-composition";
import {
  isComposedVectorPaintedAt,
  isNodePaintedAt,
} from "./painted-hit-test";

// Figma-style presses inside an existing selection's bounds. The bounds of an
// already-selected object are its hit area: pressing anywhere inside drags the
// selection, and a press released without moving resolves like a click on the
// visible artwork under the pointer. Unselected objects keep visible-artwork
// hit testing.

type SelectionPressIntent = "drag" | "exit-path-editing";

export const getSelectionPressIntent = (
  editor,
  point
): SelectionPressIntent => {
  // Path editing is a direct-edit mode: only the edited artwork drags, and a
  // press on empty space leaves the mode.
  if (editor.pathEditingNodeId && !isSelectionInkHit(editor, point)) {
    return "exit-path-editing";
  }

  return "drag";
};

export const clickInsideSelection = (
  editor,
  point,
  { shiftKey = false } = {}
) => {
  if (editor.pathEditingNodeId) {
    return false;
  }

  const targetNodeId = getSelectableNodeIdAtPoint(editor, point);

  if (!targetNodeId) {
    return false;
  }

  if (shiftKey) {
    editor.toggleSelection(targetNodeId);
    return true;
  }

  if (
    editor.selectedNodeIds.length === 1 &&
    editor.selectedNodeIds[0] === targetNodeId
  ) {
    return false;
  }

  editor.select(targetNodeId);
  return true;
};

// Topmost visible artwork under the point, resolved to the object a pointer
// click selects (the outer group unless a group is focused).
const getSelectableNodeIdAtPoint = (editor, point) => {
  const hitNodeId = findPaintedNodeIdAtPoint(editor, point);

  return hitNodeId
    ? editor.getSelectionTargetNodeId(hitNodeId) || hitNodeId
    : null;
};

// Group contiguity makes the flat document order the canvas paint order, so
// walk it topmost-first. Containers paint nothing themselves (their effects
// never hit); frames clip their content; a vector paints its children as one
// composed result unless the user has drilled in.
const findPaintedNodeIdAtPoint = (editor, point) => {
  const nodes = editor.nodes;

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];

    if (
      node.type === "group" ||
      node.type === "artboard" ||
      editor.getNode(node.parentId)?.type === "vector" ||
      !editor.isNodeEffectivelyVisible(node.id) ||
      isComposedTransparent(editor, node) ||
      isClippedByFrame(editor, node, point)
    ) {
      continue;
    }

    if (node.type !== "vector") {
      if (isNodePaintedAt(editor, node.id, point)) {
        return node.id;
      }

      continue;
    }

    if (!isDrilledVector(editor, node)) {
      if (isUndrilledVectorHit(editor, node, point)) {
        return node.id;
      }

      continue;
    }

    const childHitNodeId = getVectorChildPathNodes(editor, node.id)
      .reverse()
      .find((pathNode) => isVisibleChildPaintedAt(editor, pathNode, point))?.id;

    if (childHitNodeId) {
      return childHitNodeId;
    }
  }

  return null;
};

// Node opacity composes through every ancestor layer (isolated groups and
// artboards), so a fully transparent ancestor hides its whole subtree.
const isComposedTransparent = (editor, node) => {
  let current = node;

  while (current) {
    if (typeof current.opacity === "number" && current.opacity <= 0) {
      return true;
    }

    current = editor.getNode(current.parentId);
  }

  return false;
};

// Frames (artboards) clip their content to their bounds.
const isClippedByFrame = (editor, node, point) => {
  let parentNode = editor.getNode(node.parentId);

  while (parentNode) {
    if (
      parentNode.type === "artboard" &&
      !isInsideFrame(editor, parentNode.id, point)
    ) {
      return true;
    }

    parentNode = editor.getNode(parentNode.parentId);
  }

  return false;
};

// Composed vectors (boolean results, compound fills) hit-test their rendered
// result so clicks pass through cutouts and fill-rule holes. Independent
// vectors are the union of their child paths.
const isUndrilledVectorHit = (editor, vectorNode, point) => {
  if (getVectorPathComposition(vectorNode) === "independent") {
    return getVectorChildPathNodes(editor, vectorNode.id).some((pathNode) =>
      isVisibleChildPaintedAt(editor, pathNode, point)
    );
  }

  return isComposedVectorPaintedAt(editor, vectorNode.id, point);
};

const isVisibleChildPaintedAt = (editor, pathNode, point) => {
  return (
    editor.isNodeEffectivelyVisible(pathNode.id) &&
    !(typeof pathNode.opacity === "number" && pathNode.opacity <= 0) &&
    isNodePaintedAt(editor, pathNode.id, point)
  );
};

// Inside the drilled-in group (or a drilled vector), pointer targeting resolves
// vector children directly, then maps them through the focused-group target.
const isDrilledVector = (editor, node) => {
  const focusedGroupId = editor.focusedGroupId;

  return (
    node.type === "vector" &&
    Boolean(focusedGroupId) &&
    (focusedGroupId === node.id ||
      editor.isDescendantOf(node.id, focusedGroupId) ||
      editor.isDescendantOf(focusedGroupId, node.id))
  );
};

const isInsideFrame = (editor, frameNodeId, point) => {
  const bounds = editor.getNodeRenderFrame(frameNodeId)?.bounds;

  return (
    !bounds ||
    (point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY)
  );
};

const isSelectionInkHit = (editor, point) => {
  return editor.selectedNodeIds.some((nodeId) => {
    if (isNodePaintedAt(editor, nodeId, point)) {
      return true;
    }

    return editor.getDescendantLeafNodeIds(nodeId).some((leafNodeId) => {
      return (
        editor.isNodeEffectivelyVisible(leafNodeId) &&
        isNodePaintedAt(editor, leafNodeId, point)
      );
    });
  });
};
