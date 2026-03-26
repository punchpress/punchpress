const TOOL_SHORTCUTS = {
  h: "hand",
  t: "text",
  v: "pointer",
};

const SHAPE_SHORTCUTS = {
  o: "ellipse",
  r: "rectangle",
  s: "star",
};

export const selectToolFromShortcut = (editor, key, event) => {
  if (event?.metaKey || event?.ctrlKey || event?.altKey) {
    return false;
  }

  const nextShapeKind = SHAPE_SHORTCUTS[key];
  if (nextShapeKind) {
    editor.setNextShapeKind(nextShapeKind);
    editor.setActiveTool("shape");
    return true;
  }

  const nextTool = TOOL_SHORTCUTS[key];
  if (!nextTool) {
    return false;
  }

  editor.setActiveTool(nextTool);
  return true;
};

export class Tool {
  constructor(editor) {
    this.editor = editor;
  }

  onCanvasPointerDown() {
    return null;
  }

  onNodePointerDown({ node, ...info }) {
    return this.onCanvasPointerDown({
      ...info,
      node,
      target: {
        node,
        nodeId: node.id,
        type: "node",
      },
    });
  }

  onKeyDown() {
    return false;
  }
}
