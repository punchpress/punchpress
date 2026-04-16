import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("vector layer moves", () => {
  test("moving a path into a different vector deletes the emptied source vector", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "source-vector",
        name: "Source Vector",
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
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "source-path",
        parentId: "source-vector",
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
            point: { x: 120, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 120, y: 80 },
            pointType: "corner",
          },
        ],
        stroke: "#000000",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 3,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 180,
          y: 180,
        },
        type: "path",
        visible: true,
      },
      {
        id: "target-vector",
        name: "Target Vector",
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
    ]);

    editor.setFocusedGroup("source-vector");
    editor.select("source-path");
    editor.moveNodeToParent("source-path", "target-vector");

    expect(editor.getNode("source-path")?.parentId).toBe("target-vector");
    expect(editor.getNode("source-vector")).toBeNull();
    expect(editor.getChildNodeIds("target-vector")).toEqual(["source-path"]);
    expect(editor.selectedNodeIds).toEqual(["source-path"]);
  });
});
