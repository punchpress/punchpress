import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createRectPath = (id, parentId, halfWidth, halfHeight) => {
  return {
    closed: true,
    fill: "#3366FF",
    fillRule: "nonzero",
    id,
    parentId,
    segments: [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
    ].map((point) => ({
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point,
      pointType: "corner",
    })),
    stroke: null,
    strokeWidth: 0,
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 260, y: 260 },
    type: "path",
    visible: true,
  };
};

const createVector = (id, name) => {
  return {
    id,
    name,
    parentId: "root",
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
    type: "vector",
    visible: true,
  };
};

const loadNodes = (editor: Editor, nodes) => {
  editor.loadDocument(JSON.stringify({ nodes, version: "1.8" }));
};

const getChildLabels = (editor: Editor, parentId: string) => {
  return editor
    .getChildNodeIds(parentId)
    .map((nodeId) => editor.getLayerRow(nodeId)?.label);
};

describe("boolean operand labels", () => {
  test("subtracting sibling paths keeps their generated labels", () => {
    const editor = new Editor();

    loadNodes(editor, [
      createVector("vector", "Vector"),
      createRectPath("path-back", "vector", 120, 90),
      createRectPath("path-front", "vector", 80, 40),
    ]);
    expect(getChildLabels(editor, "vector")).toEqual(["Path 1", "Path 2"]);

    expect(editor.subtractSelection(["path-back", "path-front"])).toBe(true);

    const resultIds = editor.getChildNodeIds("vector");

    expect(resultIds).not.toContain("path-back");
    expect(getChildLabels(editor, "vector")).toEqual(["Path 1", "Path 2"]);

    expect(editor.undo()).toBe(true);
    expect(getChildLabels(editor, "vector")).toEqual(["Path 1", "Path 2"]);
    expect(editor.redo()).toBe(true);
    expect(getChildLabels(editor, "vector")).toEqual(["Path 1", "Path 2"]);
  });

  test("a top-level boolean result keeps the bottom operand's layer name", () => {
    const editor = new Editor();

    loadNodes(editor, [
      createVector("vector-back", "Back Vector"),
      createRectPath("vector-back:path", "vector-back", 120, 90),
      createVector("vector-front", "Front Vector"),
      createRectPath("vector-front:path", "vector-front", 80, 40),
    ]);

    expect(editor.uniteSelection(["vector-back", "vector-front"])).toBe(true);

    const [resultId] = editor.getChildNodeIds("root");

    expect(editor.getLayerRow(resultId)?.label).toBe("Back Vector");
  });
});
