import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const loadCompoundVector = (editor: Editor) => {
  editor.getState().loadNodes([
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
      ],
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 200,
        y: 150,
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
      ],
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 200,
        y: 150,
      },
      type: "path",
      visible: true,
    },
  ]);
};

describe("path editing ownership", () => {
  test("uses a child path as the edit owner while keeping the vector as the visual owner", () => {
    const editor = new Editor();

    loadCompoundVector(editor);
    editor.startPathEditing("vector-1");

    expect(editor.pathEditingNodeId).toBe("path-2");
    expect(editor.getPathEditingVisualOwnerNodeId()).toBe("vector-1");
    expect(editor.sharesPathEditingVisualOwner("vector-1")).toBe(true);
    expect(editor.selectedNodeIds).toEqual(["path-2"]);
  });

  test("uses the path itself as both edit owner and visual owner for a standalone path", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        closed: true,
        fill: "#ff0000",
        fillRule: "nonzero",
        id: "path-1",
        parentId: "root",
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
        ],
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 40,
          y: 50,
        },
        type: "path",
        visible: true,
      },
    ]);

    editor.startPathEditing("path-1");

    expect(editor.pathEditingNodeId).toBe("path-1");
    expect(editor.getPathEditingVisualOwnerNodeId()).toBe("path-1");
    expect(editor.sharesPathEditingVisualOwner("path-1")).toBe(true);
  });
});
