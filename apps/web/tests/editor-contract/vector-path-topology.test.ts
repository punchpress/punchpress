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

const loadVectorEditor = (contours) => {
  const editor = new Editor();
  const node = createVectorNode(contours);

  editor.getState().loadNodes([node]);
  editor.select(node.id);
  editor.startPathEditing(node.id);

  return { editor, node };
};

describe("vector path topology", () => {
  test("split opens a closed contour at the selected point", () => {
    const { editor, node } = loadVectorEditor([createRectangleContour()]);

    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    const didSplit = editor.splitPath(node.id, {
      contourIndex: 0,
      segmentIndex: 1,
    });

    expect(didSplit).toBe(true);

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected vector node after closed-path split.");
    }

    expect(nextNode.contours).toHaveLength(1);
    expect(nextNode.contours[0]?.closed).toBe(false);
    expect(nextNode.contours[0]?.segments).toHaveLength(5);
    expect(nextNode.contours[0]?.segments[0]?.point).toEqual({
      x: 120,
      y: -90,
    });
    expect(nextNode.contours[0]?.segments.at(-1)?.point).toEqual({
      x: 120,
      y: -90,
    });
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
    ]);
  });

  test("split cuts an open contour into two open contours at the selected interior point", () => {
    const { editor, node } = loadVectorEditor([createOpenLineContour()]);

    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    const didSplit = editor.splitPath(node.id, {
      contourIndex: 0,
      segmentIndex: 1,
    });

    expect(didSplit).toBe(true);

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected vector node after open-path split.");
    }

    expect(nextNode.contours).toHaveLength(2);
    expect(
      nextNode.contours[0]?.segments.map((segment) => segment.point)
    ).toEqual([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
    ]);
    expect(
      nextNode.contours[1]?.segments.map((segment) => segment.point)
    ).toEqual([
      { x: 120, y: 0 },
      { x: 240, y: 0 },
    ]);
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 1,
        segmentIndex: 0,
      },
    ]);
  });

  test("join endpoints closes an open contour when both endpoints are selected", () => {
    const { editor, node } = loadVectorEditor([createOpenLineContour()]);

    editor.setPathEditingPoints(
      [
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
      ],
      {
        contourIndex: 0,
        segmentIndex: 0,
      }
    );

    const didJoin = editor.joinPathEndpoints(node.id, editor.pathEditingPoints);

    expect(didJoin).toBe(true);

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected vector node after contour close.");
    }

    expect(nextNode.contours).toHaveLength(1);
    expect(nextNode.contours[0]?.closed).toBe(true);
    expect(nextNode.contours[0]?.segments).toHaveLength(2);
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
    ]);
  });

  test("join endpoints merges two open contours into one", () => {
    const { editor, node } = loadVectorEditor([
      createOpenLineContour(),
      {
        closed: false,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 360, y: 0 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 480, y: 0 },
            pointType: "corner" as const,
          },
        ],
      },
    ]);

    editor.setPathEditingPoints(
      [
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
        {
          contourIndex: 1,
          segmentIndex: 0,
        },
      ],
      {
        contourIndex: 0,
        segmentIndex: 2,
      }
    );

    const didJoin = editor.joinPathEndpoints(node.id, editor.pathEditingPoints);

    expect(didJoin).toBe(true);

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected vector node after contour join.");
    }

    expect(nextNode.contours).toHaveLength(1);
    expect(nextNode.contours[0]?.closed).toBe(false);
    expect(
      nextNode.contours[0]?.segments.map((segment) => segment.point)
    ).toEqual([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 240, y: 0 },
      { x: 360, y: 0 },
      { x: 480, y: 0 },
    ]);
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 0,
        segmentIndex: 2,
      },
    ]);
  });

  test("join endpoints collapses coincident snapped endpoints into one anchor", () => {
    const { editor, node } = loadVectorEditor([
      createOpenLineContour(),
      {
        closed: false,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 240, y: 0 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 360, y: 0 },
            pointType: "corner" as const,
          },
        ],
      },
    ]);

    editor.setPathEditingPoints(
      [
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
        {
          contourIndex: 1,
          segmentIndex: 0,
        },
      ],
      {
        contourIndex: 0,
        segmentIndex: 2,
      }
    );

    const didJoin = editor.joinPathEndpoints(node.id, editor.pathEditingPoints);

    expect(didJoin).toBe(true);

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected vector node after snapped contour join.");
    }

    expect(
      nextNode.contours[0]?.segments.map((segment) => segment.point)
    ).toEqual([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 240, y: 0 },
      { x: 360, y: 0 },
    ]);
    expect(nextNode.contours[0]?.segments).toHaveLength(4);
  });
});
