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

const createOpenLineContour = () => {
  return {
    closed: false,
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 0, y: 0 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 120, y: 0 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 240, y: 0 },
        pointType: "corner" as const,
      },
    ],
  };
};

const createVectorNode = (contours) => {
  return {
    contours,
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

describe("vector point delete", () => {
  test("delete removes the selected closed-path point instead of deleting the node", () => {
    const editor = new Editor();
    const node = createVectorNode([createRectangleContour()]);

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    const result = pressDelete(editor);

    expect(result).toEqual({
      handled: true,
      prevented: true,
    });

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected the vector node to remain after point delete.");
    }

    expect(nextNode.contours[0]?.closed).toBe(true);
    expect(nextNode.contours[0]?.segments).toHaveLength(3);
    expect(editor.selectedNodeId).toBe(node.id);
    expect(editor.pathEditingNodeId).toBe(node.id);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("delete removes the selected open-path endpoint and keeps the contour open", () => {
    const editor = new Editor();
    const node = createVectorNode([createOpenLineContour()]);

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 2,
    });

    pressDelete(editor);

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error(
        "Expected the vector node to remain after endpoint delete."
      );
    }

    expect(nextNode.contours[0]?.closed).toBe(false);
    expect(nextNode.contours[0]?.segments).toHaveLength(2);
    expect(nextNode.contours[0]?.segments[1]?.point).toEqual({ x: 120, y: 0 });
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("delete removes all selected vector path points", () => {
    const editor = new Editor();
    const node = createVectorNode([createRectangleContour()]);

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoints(
      [
        {
          contourIndex: 0,
          segmentIndex: 1,
        },
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
      ],
      {
        contourIndex: 0,
        segmentIndex: 2,
      }
    );

    const result = pressDelete(editor);

    expect(result).toEqual({
      handled: true,
      prevented: true,
    });

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error(
        "Expected the vector node to remain after multi-point delete."
      );
    }

    expect(nextNode.contours[0]?.segments).toHaveLength(2);
    expect(
      nextNode.contours[0]?.segments.map((segment) => segment.point)
    ).toEqual([
      { x: -120, y: -90 },
      { x: -120, y: 90 },
    ]);
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("delete removes the vector node when its last remaining point is deleted", () => {
    const editor = new Editor();
    const node = createVectorNode([
      {
        closed: false,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 0 },
            pointType: "corner" as const,
          },
        ],
      },
    ]);

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    pressDelete(editor);

    expect(editor.getNode(node.id)).toBeNull();
    expect(editor.selectedNodeId).toBeNull();
    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.pathEditingPoint).toBeNull();
  });
});
