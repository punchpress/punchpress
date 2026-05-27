import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const COMPOUND_VECTOR_NODES = [
  {
    id: "vector-1",
    name: "Vector",
    pathComposition: "compound-fill",
    parentId: "root",
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    },
    type: "vector",
    visible: true,
  },
  {
    closed: true,
    fill: "#ff0000",
    fillRule: "evenodd",
    id: "path-1",
    parentId: "vector-1",
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 0, y: 0 },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 100, y: 0 },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 100, y: 100 },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 0, y: 100 },
        pointType: "corner",
      },
    ],
    stroke: "#111111",
    strokeWidth: 3,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    strokeMiterLimit: 4,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 240,
      y: 180,
    },
    type: "path",
    visible: true,
  },
  {
    closed: true,
    fill: "#ff0000",
    fillRule: "evenodd",
    id: "path-2",
    parentId: "vector-1",
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 20, y: 20 },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 80, y: 20 },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 80, y: 80 },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 20, y: 80 },
        pointType: "corner",
      },
    ],
    stroke: "#111111",
    strokeWidth: 3,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    strokeMiterLimit: 4,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 240,
      y: 180,
    },
    type: "path",
    visible: true,
  },
];

describe("Editor.getHoveredNodePreview", () => {
  test("returns a bounds preview for a hovered unselected node outside path editing", () => {
    const editor = new Editor();

    editor.getState().loadNodes(COMPOUND_VECTOR_NODES);
    editor.setHoveredNode("vector-1");

    expect(editor.getHoveredNodePreview()).toMatchObject({
      bounds: expect.any(Object),
      kind: "bounds",
    });
  });

  test("uses an oriented bounds preview for a hovered rotated group", () => {
    const editor = new Editor();

    editor.insertNodes([
      {
        id: "group-1",
        name: "Imported SVG",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      createPathNode({
        id: "path-1",
        parentId: "group-1",
        transform: { rotation: 28, scaleX: 1, scaleY: 1, x: 240, y: 180 },
      }),
    ]);
    editor.setSelectedNodes([]);
    editor.setHoveredNode("group-1");

    expect(editor.getHoveredNodePreview()).toMatchObject({
      kind: "bounds",
      transform: "rotate(28deg)",
    });
  });

  test("does not preview the parent vector while editing one contour of a compound vector", () => {
    const editor = new Editor();

    editor.getState().loadNodes(COMPOUND_VECTOR_NODES);
    editor.startPathEditing("vector-1");
    editor.setHoveredNode("vector-1");

    expect(editor.getHoveredNodePreview()).toBeNull();
  });

  test("previews a sibling path while editing another contour in the same vector", () => {
    const editor = new Editor();

    editor.getState().loadNodes(COMPOUND_VECTOR_NODES);
    editor.startPathEditing("vector-1");
    editor.setHoveredNode("path-1");

    expect(editor.getHoveredNodePreview()).toMatchObject({
      kind: "path",
      paths: expect.any(Array),
    });
  });
});

const createPathNode = ({ id, parentId, transform }) => {
  const zeroHandle = { x: 0, y: 0 };
  const contour = {
    closed: true,
    segments: [
      {
        handleIn: zeroHandle,
        handleOut: zeroHandle,
        point: { x: 0, y: 0 },
        pointType: "corner",
      },
      {
        handleIn: zeroHandle,
        handleOut: zeroHandle,
        point: { x: 100, y: 0 },
        pointType: "corner",
      },
      {
        handleIn: zeroHandle,
        handleOut: zeroHandle,
        point: { x: 100, y: 100 },
        pointType: "corner",
      },
      {
        handleIn: zeroHandle,
        handleOut: zeroHandle,
        point: { x: 0, y: 100 },
        pointType: "corner",
      },
    ],
  };

  return {
    closed: true,
    contours: [contour],
    fill: "#3AAAFF",
    fillRule: "nonzero",
    id,
    parentId,
    segments: contour.segments,
    stroke: null,
    strokeLineCap: "butt",
    strokeLineJoin: "miter",
    strokeMiterLimit: 4,
    strokeWidth: 0,
    transform,
    type: "path",
    visible: true,
  };
};
