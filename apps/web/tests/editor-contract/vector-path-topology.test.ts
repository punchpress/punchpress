import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import type { VectorContourDocument } from "@punchpress/punch-schema";

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

const createOpenLineContour = (): VectorContourDocument => {
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
    contours: [contour],
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

  test("split cuts an open contour into two contours on the same path", () => {
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
    expect(editor.pathEditingNodeId).toBe(node.id);
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 1,
        segmentIndex: 0,
      },
    ]);
  });

  test("join bridges distinct endpoints without removing the last anchor", () => {
    const bentContour = createOpenLineContour();
    bentContour.segments[0].handleIn = { x: -25, y: 10 };
    bentContour.segments[0].handleOut = { x: 35, y: -15 };
    bentContour.segments[1].point = { x: 120, y: 80 };
    bentContour.segments[2].handleIn = { x: -30, y: -20 };
    const { editor, node } = loadVectorEditor([bentContour], true);

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
    expect(nextNode.segments).toEqual(bentContour.segments);
    expect(editor.pathEditingPoints).toEqual([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
    ]);

    expect(editor.undo()).toBe(true);
    const restoredNode = editor.getNode(node.id);
    expect(restoredNode?.type).toBe("path");
    expect(restoredNode?.contours[0]).toEqual(bentContour);
  });

  test("join merges coincident endpoints with outgoing and incoming handles", () => {
    const contour = createOpenLineContour();
    contour.segments[2].point = { x: 0, y: 0 };
    contour.segments[0].handleOut = { x: 40, y: 10 };
    contour.segments[2].handleIn = { x: -20, y: 30 };
    const { editor, node } = loadVectorEditor([contour], true);

    expect(
      editor.joinPathEndpoints(node.id, [
        { contourIndex: 0, segmentIndex: 0 },
        { contourIndex: 0, segmentIndex: 2 },
      ])
    ).toBe(true);

    const nextNode = editor.getNode(node.id);
    if (nextNode?.type !== "path") {
      throw new Error("Expected path node after endpoint merge.");
    }

    expect(nextNode.closed).toBe(true);
    expect(nextNode.segments).toHaveLength(2);
    expect(nextNode.segments[0]).toMatchObject({
      point: { x: 0, y: 0 },
      handleIn: { x: -20, y: 30 },
      handleOut: { x: 40, y: 10 },
      pointType: "corner",
    });
  });

  test("join bridges distinct endpoints of two contours and keeps both anchors", () => {
    const first = createOpenLineContour();
    const second = createOpenLineContour();
    first.segments[2].handleIn = { x: -15, y: 25 };
    second.segments[0].point = { x: 300, y: 40 };
    second.segments[0].handleOut = { x: 20, y: -25 };
    const editor = new Editor();
    const node = { ...createPathNode(first), contours: [first, second] };
    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    expect(
      editor.joinPathEndpoints(node.id, [
        { contourIndex: 0, segmentIndex: 2 },
        { contourIndex: 1, segmentIndex: 0 },
      ])
    ).toBe(true);

    const nextNode = editor.getNode(node.id);
    if (nextNode?.type !== "path") {
      throw new Error("Expected path node after contour join.");
    }

    expect(nextNode.contours).toHaveLength(1);
    expect(nextNode.contours[0]?.segments).toEqual([
      ...first.segments,
      ...second.segments,
    ]);
    expect(editor.undo()).toBe(true);
    expect(editor.getNode(node.id)?.contours).toEqual([first, second]);
  });

  test("join merges coincident cross-contour endpoints without changing their curve handles", () => {
    const first = createOpenLineContour();
    const second = createOpenLineContour();
    first.segments[2].handleIn = { x: -30, y: 15 };
    second.segments[0].point = { x: 240, y: 0 };
    second.segments[0].handleOut = { x: 20, y: 30 };
    const editor = new Editor();
    const node = { ...createPathNode(first), contours: [first, second] };
    editor.getState().loadNodes([node]);

    expect(
      editor.joinPathEndpoints(node.id, [
        { contourIndex: 0, segmentIndex: 2 },
        { contourIndex: 1, segmentIndex: 0 },
      ])
    ).toBe(true);

    const nextNode = editor.getNode(node.id);
    if (nextNode?.type !== "path") {
      throw new Error("Expected path node after contour join.");
    }

    expect(nextNode.contours[0]?.segments).toHaveLength(5);
    expect(nextNode.contours[0]?.segments[2]).toMatchObject({
      point: { x: 240, y: 0 },
      handleIn: { x: -30, y: 15 },
      handleOut: { x: 20, y: 30 },
      pointType: "corner",
    });
  });

  test("join keeps a continuous cross-contour tangent smooth", () => {
    const first = createOpenLineContour();
    const second = createOpenLineContour();
    first.segments[2].handleIn = { x: -30, y: 0 };
    first.segments[2].pointType = "smooth";
    second.segments[0].point = { x: 240, y: 0 };
    second.segments[0].handleOut = { x: 20, y: 0 };
    second.segments[0].pointType = "smooth";
    const editor = new Editor();
    const node = { ...createPathNode(first), contours: [first, second] };
    editor.getState().loadNodes([node]);

    expect(
      editor.joinPathEndpoints(node.id, [
        { contourIndex: 0, segmentIndex: 2 },
        { contourIndex: 1, segmentIndex: 0 },
      ])
    ).toBe(true);
    expect(editor.getNode(node.id)?.contours[0]?.segments[2]).toMatchObject({
      handleIn: { x: -30, y: 0 },
      handleOut: { x: 20, y: 0 },
      pointType: "smooth",
    });
  });
});
