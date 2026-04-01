import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createPolygonShapeNode = () => {
  return {
    fill: "#000000",
    height: 160,
    id: "shape-node",
    parentId: "root",
    shape: "polygon",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 600,
      y: 450,
    },
    type: "shape",
    visible: true,
    width: 260,
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
      x: 600,
      y: 450,
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
      x: 600,
      y: 450,
    },
    type: "shape",
    visible: true,
    width: 240,
  } as const;
};

describe("Shape path editing", () => {
  test("polygon shapes expose an editable path session", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    expect(editor.canEditNodePath(node.id)).toBe(true);
    expect(editor.canStartPathEditing(node.id)).toBe(true);
    expect(editor.startPathEditing(node.id)).toBe(true);
    expect(editor.getEditablePathSession(node.id)).toEqual({
      backend: "vector-path",
      contours: [
        {
          closed: true,
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -130, y: -80 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 130, y: -80 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 130, y: 80 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -130, y: 80 },
              pointType: "corner",
            },
          ],
        },
      ],
      interactionPolicy: {
        canInsertPoint: true,
      },
      nodeId: node.id,
      nodeType: "shape",
      selectedPoint: null,
      selectedPoints: [],
    });
  });

  test("updating a polygon shape path keeps it as a shape", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode();
    const nextContours = [
      {
        closed: true,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -130, y: -80 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 180, y: -120 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 130, y: 80 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -130, y: 80 },
            pointType: "corner",
          },
        ],
      },
    ];

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    expect(editor.updateEditablePath(node.id, nextContours)).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({
      height: 200,
      points: [
        { x: -130, y: -80 },
        { x: 180, y: -120 },
        { x: 130, y: 80 },
        { x: -130, y: 80 },
      ],
      shape: "polygon",
      type: "shape",
      width: 310,
    });
  });

  test("updating a star shape path keeps it as a star shape", () => {
    const editor = new Editor();
    const node = createStarShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const session = editor.getEditablePathSession(node.id);
    const nextContours =
      session && "contours" in session
        ? session.contours.map((contour) => ({
            ...contour,
            segments: contour.segments.map((segment) => ({
              ...segment,
              handleIn: { ...segment.handleIn },
              handleOut: { ...segment.handleOut },
              point: { ...segment.point },
            })),
          }))
        : null;

    if (!nextContours) {
      throw new Error("Expected editable star contours");
    }

    nextContours[0].segments[0].point.x += 18;

    expect(editor.updateEditablePath(node.id, nextContours)).toBe(true);
    const nextNode = editor.getNode(node.id);
    const nextSession = editor.getEditablePathSession(node.id);

    expect(nextNode).toMatchObject({
      points: expect.any(Array),
      shape: "star",
      type: "shape",
    });
    if (!(nextSession && nextSession.nodeType === "shape")) {
      throw new Error("Expected star shape session after path update");
    }
    expect(nextSession.contours[0]?.segments[0]?.point).toMatchObject({
      x: nextContours[0].segments[0].point.x,
      y: nextContours[0].segments[0].point.y,
    });
  });

  test("updating an ellipse shape path converts it to a vector", () => {
    const editor = new Editor();
    const node = createEllipseShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const session = editor.getEditablePathSession(node.id);
    const nextContours =
      session && "contours" in session
        ? session.contours.map((contour) => ({
            ...contour,
            segments: contour.segments.map((segment) => ({
              ...segment,
              handleIn: { ...segment.handleIn },
              handleOut: { ...segment.handleOut },
              point: { ...segment.point },
            })),
          }))
        : null;

    if (!nextContours) {
      throw new Error("Expected editable ellipse contours");
    }

    nextContours[0].segments[0].point.y -= 20;

    expect(editor.updateEditablePath(node.id, nextContours)).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({
      contours: nextContours,
      fillRule: "nonzero",
      type: "vector",
    });
  });
});
