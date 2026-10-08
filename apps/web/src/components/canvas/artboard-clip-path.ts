const offsetBounds = (bounds, delta) => {
  if (!(bounds && delta)) {
    return bounds;
  }

  return {
    ...bounds,
    maxX: bounds.maxX + (delta.x || 0),
    maxY: bounds.maxY + (delta.y || 0),
    minX: bounds.minX + (delta.x || 0),
    minY: bounds.minY + (delta.y || 0),
  };
};

const hasActiveEffects = (node) => {
  return Boolean(
    node?.effects?.some((effect) => effect.enabled && effect.opacity > 0)
  );
};

// The artboard a shell clips to itself, or null. Shells inside a shadowed
// group skip their own clip: clipping before the group's filter would drop
// shadows cast back into the artboard, so the artboard's render layer clips
// the composited result instead.
const getAncestorArtboardId = (editor, nodeId) => {
  let currentNode = nodeId ? editor.getNode(nodeId) : null;

  // A dense group surface that owns a shadow is itself the filtered content.
  if (currentNode?.type === "group" && hasActiveEffects(currentNode)) {
    return null;
  }

  while (currentNode?.parentId && currentNode.parentId !== "root") {
    const parentNode = editor.getNode(currentNode.parentId);

    if (parentNode?.type === "group" && hasActiveEffects(parentNode)) {
      return null;
    }

    if (parentNode?.type === "artboard") {
      return parentNode.id;
    }

    currentNode = parentNode;
  }

  return null;
};

export const getArtboardClipPath = (editor, nodeId, bounds, preview = null) => {
  const artboardId = getAncestorArtboardId(editor, nodeId);

  if (!(bounds && artboardId)) {
    return "";
  }

  const artboardFrame = editor.getNodeRenderFrame(artboardId);
  const artboardBounds = preview?.nodeIds?.includes(artboardId)
    ? offsetBounds(artboardFrame?.bounds, preview.delta)
    : artboardFrame?.bounds;

  if (!artboardBounds) {
    return "";
  }

  // Insets may go negative: `bounds` is the node's unrotated shell box, and
  // rotated content legitimately paints outside it (rotation is applied by an
  // inner element). Clamping at 0 shrank the clip region to the unrotated box
  // and sheared rotated children along their own frame edges. A negative
  // inset extends the region so the clip stays exactly the artboard rect.
  const top = artboardBounds.minY - bounds.minY;
  const right = bounds.maxX - artboardBounds.maxX;
  const bottom = bounds.maxY - artboardBounds.maxY;
  const left = artboardBounds.minX - bounds.minX;

  return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
};
