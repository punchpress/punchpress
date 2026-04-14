import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createVectorNode = () => {
  return {
    contours: [
      {
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
      },
    ],
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "vector-node",
    parentId: "root",
    stroke: "#000000",
    strokeWidth: 12,
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

const pressCanvasKey = (
  editor: Editor,
  key: string,
  {
    code = key,
    shiftKey = false,
  }: { code?: string; shiftKey?: boolean } = {}
) => {
  let prevented = false;

  const event = {
    altKey: false,
    code,
    ctrlKey: false,
    key,
    metaKey: false,
    preventDefault: () => {
      prevented = true;
    },
    shiftKey,
    target: null,
  };

  return {
    handled: editor.handleCanvasShortcutKeyDown(event, key.toLowerCase()),
    prevented,
  };
};

describe("path point move selection", () => {
  test("moveSelectedPathPointsBy moves all selected path anchors together", () => {
    const editor = new Editor();
    const node = createVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);

    expect(editor.moveSelectedPathPointsBy({ x: 24, y: 18 }, node.id)).toBe(
      true
    );

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected the vector node to remain after moving points.");
    }

    expect(nextNode.contours[0]?.segments[0]?.point).toEqual({
      x: -96,
      y: -72,
    });
    expect(nextNode.contours[0]?.segments[1]?.point).toEqual({
      x: 144,
      y: -72,
    });
    expect(nextNode.contours[0]?.segments[2]?.point).toEqual({
      x: 120,
      y: 90,
    });
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);
  });

  test("arrow keys nudge all selected path anchors by one unit", () => {
    const editor = new Editor();
    const node = createVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);

    const result = pressCanvasKey(editor, "ArrowRight", {
      code: "ArrowRight",
    });

    expect(result).toEqual({
      handled: true,
      prevented: true,
    });

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected the vector node to remain after nudging.");
    }

    expect(nextNode.contours[0]?.segments[0]?.point).toEqual({
      x: -119,
      y: -90,
    });
    expect(nextNode.contours[0]?.segments[1]?.point).toEqual({
      x: 121,
      y: -90,
    });
  });

  test("shift-arrow nudges all selected path anchors by ten units", () => {
    const editor = new Editor();
    const node = createVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 2,
      },
      {
        contourIndex: 0,
        segmentIndex: 3,
      },
    ]);

    const result = pressCanvasKey(editor, "ArrowUp", {
      code: "ArrowUp",
      shiftKey: true,
    });

    expect(result).toEqual({
      handled: true,
      prevented: true,
    });

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected the vector node to remain after nudging.");
    }

    expect(nextNode.contours[0]?.segments[2]?.point).toEqual({
      x: 120,
      y: 80,
    });
    expect(nextNode.contours[0]?.segments[3]?.point).toEqual({
      x: -120,
      y: 80,
    });
  });
});
