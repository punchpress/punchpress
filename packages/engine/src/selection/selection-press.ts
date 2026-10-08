import {
  getVectorChildPathNodes,
  getVectorPathComposition,
} from "../nodes/vector/vector-path-composition";
import { createHeadlessPaperCompiler } from "../primitives/headless-paper-compiler";

const paperCompiler = createHeadlessPaperCompiler();

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

// Canvas artwork paints in flat document order, so walk it topmost-first.
// Containers paint nothing themselves; frames clip their content; a vector
// paints its children as one composed result unless the user has drilled in.
const findPaintedNodeIdAtPoint = (editor, point) => {
  const nodes = editor.nodes;

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];

    if (
      node.type === "group" ||
      node.type === "artboard" ||
      editor.getNode(node.parentId)?.type === "vector" ||
      !editor.isNodeEffectivelyVisible(node.id) ||
      isClippedByFrame(editor, node, point)
    ) {
      continue;
    }

    if (node.type !== "vector") {
      if (editor.hitTestNodePoint(node.id, point)) {
        return node.id;
      }

      continue;
    }

    if (!isDrilledVector(editor, node)) {
      if (isComposedVectorHit(editor, node, point)) {
        return node.id;
      }

      continue;
    }

    const childHitNodeId = getVectorChildPathNodes(editor, node.id)
      .reverse()
      .find((pathNode) => {
        return (
          editor.isNodeEffectivelyVisible(pathNode.id) &&
          editor.hitTestNodePoint(pathNode.id, point)
        );
      })?.id;

    if (childHitNodeId) {
      return childHitNodeId;
    }
  }

  return null;
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
const isComposedVectorHit = (editor, vectorNode, point) => {
  if (getVectorPathComposition(vectorNode) === "independent") {
    return getVectorChildPathNodes(editor, vectorNode.id).some((pathNode) => {
      return (
        editor.isNodeEffectivelyVisible(pathNode.id) &&
        editor.hitTestNodePoint(pathNode.id, point)
      );
    });
  }

  const entries = editor.getNodeRenderGeometry(vectorNode.id)?.paths || [];

  // An empty result (e.g. a disjoint intersection) paints nothing.
  if (!entries.some((entry) => entry.d)) {
    return false;
  }

  // Boolean results can arrive as several contour entries that together form
  // one compound shape (outer contour plus reversed holes), so test them as one.
  const [firstEntry] = entries;

  return paperCompiler.run((scope) => {
    const scopePoint = new scope.Point(point.x, point.y);
    const item = scope.PathItem.create(
      entries
        .map((entry) => entry.d)
        .filter(Boolean)
        .join(" ")
    );
    item.fillRule = firstEntry.fillRule === "evenodd" ? "evenodd" : "nonzero";

    if (isPaint(firstEntry.fill) && item.contains(scopePoint)) {
      return true;
    }

    const strokeWidth = isPaint(firstEntry.stroke)
      ? firstEntry.strokeWidth || 0
      : 0;

    if (strokeWidth <= 0) {
      return false;
    }

    // Paper only hit-tests strokes on styled items; the stroke width already
    // spans the painted band, so no extra tolerance.
    item.strokeColor = new scope.Color(0, 0, 0);
    item.strokeWidth = strokeWidth;
    item.strokeCap = firstEntry.strokeLineCap || "butt";
    item.strokeJoin = firstEntry.strokeLineJoin || "miter";

    return Boolean(
      item.hitTest(scopePoint, { fill: false, stroke: true, tolerance: 0 })
    );
  });
};

// Inside the drilled-in group (or a drilled vector), pointer targeting resolves
// vector children directly, then maps them through the focused-group target.
const isPaint = (paint) => Boolean(paint && paint !== "none");

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
    if (editor.hitTestNodePoint(nodeId, point)) {
      return true;
    }

    return editor.getDescendantLeafNodeIds(nodeId).some((leafNodeId) => {
      return (
        editor.isNodeEffectivelyVisible(leafNodeId) &&
        editor.hitTestNodePoint(leafNodeId, point)
      );
    });
  });
};
