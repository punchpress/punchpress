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

const createPathNode = (contour) => {
  return {
    closed: contour.closed,
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "vector-node",
    parentId: "root",
    segments: contour.segments,
    stroke: "#000000",
    strokeWidth: 8,
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

const loadVectorEditor = (contours, asPath = false) => {
  const editor = new Editor();
  const node = asPath
    ? createPathNode(contours[0])
    : createVectorNode(contours);

  editor.getState().loadNodes([node]);
  editor.select(node.id);
  editor.startPathEditing(node.id);

  return { editor, node };
};

describe("vector path topology", () => {
  test("split opens a closed contour at the selected point", () => {
    const { editor, node } = loadVectorEditor([createRectangleContour()], true);

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

    if (nextNode?.type !== "path") {
      throw new Error("Expected path node after closed-path split.");
    }

    expect(nextNode.closed).toBe(false);
    expect(nextNode.segments).toHaveLength(5);
    expect(nextNode.segments[0]?.point).toEqual({
      x: 120,
      y: -90,
    });
    expect(nextNode.segments.at(-1)?.point).toEqual({
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
    const { editor, node } = loadVectorEditor([createOpenLineContour()], true);

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

    if (nextNode?.type !== "path") {
      throw new Error("Expected path node after open-path split.");
    }

    expect(nextNode.closed).toBe(false);
    expect(nextNode.segments.map((segment) => segment.point)).toEqual([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
    ]);
    expect(editor.pathEditingNodeId).not.toBe(node.id);
    const nextEditingNode = editor.pathEditingNodeId
      ? editor.getNode(editor.pathEditingNodeId)
      : null;

    if (nextEditingNode?.type !== "path") {
      throw new Error(
        "Expected a new path node for the trailing split result."
      );
    }

    expect(nextEditingNode.segments.map((segment) => segment.point)).toEqual([
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
    const { editor, node } = loadVectorEditor([createOpenLineContour()], true);

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

    if (nextNode?.type !== "path") {
      throw new Error("Expected path node after contour close.");
    }

    expect(nextNode.closed).toBe(true);
    expect(nextNode.segments).toHaveLength(2);
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
    ]);
  });
});
