import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createPolygonShapeNode = (points?: Array<{ x: number; y: number }>) => {
  return {
    fill: "#000000",
    height: 120,
    id: "shape-node",
    parentId: "root",
    points,
    shape: "polygon",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "shape",
    visible: true,
    width: 200,
  } as const;
};

const createStarShapeNode = () => {
  return {
    fill: "#000000",
    height: 200,
    id: "star-node",
    parentId: "root",
    shape: "star",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "shape",
    visible: true,
    width: 200,
  } as const;
};

const createEllipseShapeNode = () => {
  return {
    fill: "#000000",
    height: 180,
    id: "ellipse-node",
    parentId: "root",
    shape: "ellipse",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "shape",
    visible: true,
    width: 240,
  } as const;
};

describe("shape point topology", () => {
  test("inserting a polygon shape point preserves the shape and selects the inserted point", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const didInsert = editor.insertPathPoint(
      {
        contourIndex: 0,
        segmentIndex: 1,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -100, y: -60 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: -60 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: -60 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 60 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -100, y: 60 },
            pointType: "corner",
          },
        ],
      },
      node.id
    );

    expect(didInsert).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({
      height: 120,
      points: [
        { x: -100, y: -60 },
        { x: 0, y: -60 },
        { x: 100, y: -60 },
        { x: 100, y: 60 },
        { x: -100, y: 60 },
      ],
      shape: "polygon",
      type: "shape",
      width: 200,
    });
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("deleting a polygon shape point preserves the shape while at least three points remain", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode([
      { x: -100, y: -60 },
      { x: 0, y: -60 },
      { x: 100, y: -60 },
      { x: 100, y: 60 },
      { x: -100, y: 60 },
    ]);

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    const didDelete = editor.deletePathPoint(node.id, {
      contourIndex: 0,
      segmentIndex: 1,
    });

    expect(didDelete).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({
      height: 120,
      points: [
        { x: -100, y: -60 },
        { x: 100, y: -60 },
        { x: 100, y: 60 },
        { x: -100, y: 60 },
      ],
      shape: "polygon",
      type: "shape",
      width: 200,
    });
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("deleting a triangle polygon point is rejected", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode([
      { x: -100, y: 60 },
      { x: 0, y: -60 },
      { x: 100, y: 60 },
    ]);

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    const didDelete = editor.deletePathPoint(node.id, {
      contourIndex: 0,
      segmentIndex: 1,
    });

    expect(didDelete).toBe(false);
    expect(editor.getNode(node.id)).toMatchObject({
      points: [
        { x: -100, y: 60 },
        { x: 0, y: -60 },
        { x: 100, y: 60 },
      ],
      shape: "polygon",
      type: "shape",
    });
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("inserting a star point converts it to a vector", () => {
    const editor = new Editor();
    const node = createStarShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const session = editor.getEditablePathSession(node.id);
    const contours =
      session && "contours" in session ? session.contours : null;

    if (!contours) {
      throw new Error("Expected editable star contours");
    }

    const first = contours[0].segments[0].point;
    const second = contours[0].segments[1].point;

    const didInsert = editor.insertPathPoint(
      {
        contourIndex: 0,
        segmentIndex: 1,
        segments: [
          contours[0].segments[0],
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: {
              x: (first.x + second.x) / 2,
              y: (first.y + second.y) / 2,
            },
            pointType: "corner",
          },
          ...contours[0].segments.slice(1),
        ],
      },
      node.id
    );

    expect(didInsert).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({
      contours: expect.any(Array),
      fillRule: "nonzero",
      type: "vector",
    });
  });

  test("deleting an ellipse point converts it to a vector", () => {
    const editor = new Editor();
    const node = createEllipseShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    const didDelete = editor.deletePathPoint(node.id, {
      contourIndex: 0,
      segmentIndex: 0,
    });

    expect(didDelete).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({
      contours: expect.any(Array),
      fillRule: "nonzero",
      type: "vector",
    });
  });

  test("converting a polygon point to smooth converts it to a vector", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    const didConvert = editor.setPathPointType("smooth", node.id, {
      contourIndex: 0,
      segmentIndex: 0,
    });

    expect(didConvert).toBe(true);
    const nextNode = editor.getNode(node.id);
    const nextSession = editor.getEditablePathSession(node.id);

    expect(nextNode).toMatchObject({
      contours: expect.any(Array),
      fillRule: "nonzero",
      type: "vector",
    });
    if (!(nextSession && nextSession.nodeType === "vector")) {
      throw new Error("Expected polygon shape to convert to vector");
    }
    expect(nextSession.contours[0]?.segments[0]?.pointType).toBe("smooth");
  });

  test("converting a star point to smooth converts it to a vector", () => {
    const editor = new Editor();
    const node = createStarShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    const didConvert = editor.setPathPointType("smooth", node.id, {
      contourIndex: 0,
      segmentIndex: 0,
    });

    expect(didConvert).toBe(true);
    const nextNode = editor.getNode(node.id);
    const nextSession = editor.getEditablePathSession(node.id);

    expect(nextNode).toMatchObject({
      contours: expect.any(Array),
      fillRule: "nonzero",
      type: "vector",
    });
    if (!(nextSession && nextSession.nodeType === "vector")) {
      throw new Error("Expected star shape to convert to vector");
    }
    expect(nextSession.contours[0]?.segments[0]?.pointType).toBe("smooth");
  });
});
