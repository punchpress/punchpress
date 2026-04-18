import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createPathNode = () => {
  return {
    closed: true,
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "path-node",
    parentId: "root",
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
    stroke: "#000000",
    strokeLineCap: "round" as const,
    strokeLineJoin: "round" as const,
    strokeMiterLimit: 4,
    strokeWidth: 12,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "path" as const,
    visible: true,
  };
};

const pressEscape = (editor: Editor) => {
  let prevented = false;

  const handled = editor.handleCanvasShortcutKeyDown(
    {
      altKey: false,
      code: "Escape",
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => {
        prevented = true;
      },
      shiftKey: false,
      target: null,
    },
    "escape"
  );

  return { handled, prevented };
};

describe("vector path edit escape", () => {
  test("escape clears a selected rounded corner before exiting path editing", () => {
    const editor = new Editor();
    const node = createPathNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint);

    expect(pressEscape(editor)).toEqual({
      handled: true,
      prevented: true,
    });
    expect(editor.pathEditingNodeId).toBe(node.id);
    expect(editor.pathEditingPoint).toBeNull();
    expect(editor.pathEditingPoints).toEqual([]);
    expect(editor.selectedNodeIds).toEqual([node.id]);

    expect(pressEscape(editor)).toEqual({
      handled: true,
      prevented: true,
    });
    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.selectedNodeIds).toEqual([node.id]);
  });
});
