import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createRectangleContour = () => {
  return {
    closed: true,
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -120, y: -90 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 120, y: -90 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 120, y: 90 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -120, y: 90 },
        pointType: "corner" as const,
      },
    ],
  };
};

const createVectorNode = () => {
  return {
    contours: [createRectangleContour()],
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "vector-node",
    parentId: "root",
    stroke: "#000000",
    strokeWidth: 8,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "vector" as const,
    visible: true,
  };
};

const pressDelete = (editor: Editor) => {
  let prevented = false;

  const handled = editor.handleCanvasShortcutKeyDown(
    {
      altKey: false,
      code: "Delete",
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => {
        prevented = true;
      },
      shiftKey: false,
      target: null,
    },
    "delete"
  );

  return { handled, prevented };
};

describe("vector rounded-corner delete shortcut", () => {
  test("delete does not remove a detected live rounded corner selection", () => {
    const editor = new Editor();
    const node = createVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint);

    const beforeDelete = JSON.stringify(editor.getNode(node.id));
    const result = pressDelete(editor);

    expect(result).toEqual({
      handled: true,
      prevented: true,
    });
    expect(JSON.stringify(editor.getNode(node.id))).toBe(beforeDelete);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });
  });
});
