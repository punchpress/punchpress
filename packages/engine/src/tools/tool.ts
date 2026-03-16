const TOOL_SHORTCUTS = {
  h: "hand",
  t: "text",
  v: "pointer",
};

export const selectToolFromShortcut = (editor, key) => {
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
    // Base tool implementation intentionally does nothing.
  }

  onNodePointerDown({ node, ...info }) {
    this.onCanvasPointerDown({
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
