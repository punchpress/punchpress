import { getNodeLocalPoint } from "@punchpress/engine";

const getImageLocalBounds = (node) => ({
  height: node.height,
  maxX: node.width,
  maxY: node.height,
  minX: 0,
  minY: 0,
  width: node.width,
});

const getViewportWorldCorners = (editor, state) => {
  const host = editor.hostRef;

  if (!host) {
    return null;
  }

  const rect = host.getBoundingClientRect();
  const viewport = state.viewport || editor.viewport;
  const zoom = Math.max(0.0001, viewport?.zoom || editor.zoom || 1);
  const minX = viewport.x;
  const minY = viewport.y;
  const maxX = viewport.x + rect.width / zoom;
  const maxY = viewport.y + rect.height / zoom;

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
};

const getAncestorChain = (editor, node) => {
  const ancestors: (typeof node)[] = [];
  let currentNode = node;

  while (currentNode?.parentId && currentNode.parentId !== "root") {
    const parentNode = editor.getNode(currentNode.parentId);

    if (!parentNode) {
      break;
    }

    ancestors.unshift(parentNode);
    currentNode = parentNode;
  }

  return ancestors;
};

export const getNodeLocalViewportBounds = (editor, state, node, padding) => {
  const corners = getViewportWorldCorners(editor, state);

  if (!corners) {
    return null;
  }

  const ancestors = getAncestorChain(editor, node);
  const localPoints = corners.map((corner) => {
    let point = corner;

    for (const ancestor of ancestors) {
      const bounds = editor.getNodeTransformBounds(ancestor.id);

      if (!bounds) {
        return null;
      }

      point = getNodeLocalPoint(ancestor, bounds, point);
    }

    return getNodeLocalPoint(node, getImageLocalBounds(node), point);
  });

  if (localPoints.some((point) => !point)) {
    return null;
  }

  const xs = localPoints.map((point) => point.x);
  const ys = localPoints.map((point) => point.y);

  return {
    maxX: Math.max(...xs) + padding,
    maxY: Math.max(...ys) + padding,
    minX: Math.min(...xs) - padding,
    minY: Math.min(...ys) - padding,
  };
};
