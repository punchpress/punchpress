import { describe, expect, test } from "bun:test";
import { Editor } from "./editor";

const createDocument = (id: string, text: string) => {
  return JSON.stringify({
    nodes: [
      {
        fill: "#000000",
        fontSize: 120,
        fontUrl: "/fonts/test.ttf",
        id,
        stroke: null,
        strokeWidth: 0,
        text,
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "none",
        },
      },
    ],
    version: "1.0",
  });
};

describe("Editor.loadDocument", () => {
  test("replaces the current document and clears transient selection state", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("first-node", "FIRST"));
    editor.getState().selectNode("first-node");
    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.nodes).toHaveLength(2);
    expect(editor.selectedNodeIds.length).toBeGreaterThan(0);

    editor.loadDocument(createDocument("second-node", "SECOND"));

    expect(
      editor.nodes.map((node) => ({
        id: node.id,
        text: node.text,
      }))
    ).toEqual([
      {
        id: "second-node",
        text: "SECOND",
      },
    ]);
    expect(editor.getNode("first-node")).toBeNull();
    expect(editor.selectedNodeIds).toEqual([]);
    expect(editor.selectedNodeId).toBeNull();
  });
});

describe("Editor.getSelectionFrameKey", () => {
  test("updates the selection frame key when selected text geometry changes", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("selected-node", "HEYHEYHEYHEY"));
    editor.getState().selectNode("selected-node");

    const beforeKey = editor.getSelectionFrameKey();

    editor.updateSelectedNode({ text: "HEY" });

    expect(editor.getSelectionFrameKey()).not.toBe(beforeKey);
  });
});
