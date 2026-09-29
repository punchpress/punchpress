import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultPathNode,
  createDefaultShapeNode,
  createDefaultVectorContainerNode,
  Editor,
} from "@punchpress/engine";

describe("layer labels", () => {
  test("keeps a path label stable when an unrelated sibling is added", () => {
    const editor = new Editor();
    const path = {
      ...createDefaultPathNode("root"),
      id: "path-node",
    };

    editor.insertNodes([path]);

    expect(editor.getLayerRow(path.id)?.label).toBe("Path 1");

    const ellipse = {
      ...createDefaultShapeNode("ellipse"),
      id: "ellipse-node",
    };

    editor.insertNodes([ellipse]);

    expect(editor.getLayerRow(path.id)?.label).toBe("Path 1");
    expect(editor.getLayerRow(ellipse.id)?.label).toBe("Ellipse 1");

    const secondPath = {
      ...createDefaultPathNode("root"),
      id: "second-path-node",
    };

    editor.insertNodes([secondPath]);

    expect(editor.getLayerRow(path.id)?.label).toBe("Path 1");
    expect(editor.getLayerRow(secondPath.id)?.label).toBe("Path 2");

    editor.setNodeOrder([secondPath.id, ellipse.id, path.id]);

    expect(editor.getLayerRow(path.id)?.label).toBe("Path 1");
    expect(editor.getLayerRow(secondPath.id)?.label).toBe("Path 2");

    editor.deleteNode(path.id);

    expect(editor.getLayerRow(secondPath.id)?.label).toBe("Path 2");

    editor.deleteNode(secondPath.id);

    expect(editor.getLayerRow(secondPath.id)).toBeNull();
    expect(editor.undo()).toBe(true);
    expect(editor.getLayerRow(secondPath.id)?.label).toBe("Path 2");
    expect(editor.undo()).toBe(true);
    expect(editor.getLayerRow(path.id)?.label).toBe("Path 1");
    expect(editor.getLayerRow(secondPath.id)?.label).toBe("Path 2");
  });

  test("keeps a selected generated label stable when brought to front", () => {
    const editor = new Editor();
    const firstEllipse = {
      ...createDefaultShapeNode("ellipse"),
      id: "first-ellipse-node",
    };
    const secondEllipse = {
      ...createDefaultShapeNode("ellipse"),
      id: "second-ellipse-node",
    };

    editor.insertNodes([firstEllipse, secondEllipse]);
    expect(editor.getLayerRow(firstEllipse.id)?.label).toBe("Ellipse 1");
    expect(editor.getLayerRow(secondEllipse.id)?.label).toBe("Ellipse 2");

    editor.select(firstEllipse.id);
    editor.bringToFront();

    expect(editor.selectedNodeId).toBe(firstEllipse.id);
    expect(editor.getLayerRow(firstEllipse.id)?.label).toBe("Ellipse 1");
    expect(editor.getLayerRow(secondEllipse.id)?.label).toBe("Ellipse 2");
  });

  test("resets generated label allocation when a document is loaded", () => {
    const editor = new Editor();
    const firstPath = {
      ...createDefaultPathNode("root"),
      id: "first-path-node",
    };
    const secondPath = {
      ...createDefaultPathNode("root"),
      id: "second-path-node",
    };

    editor.insertNodes([firstPath, secondPath]);
    expect(editor.getLayerRow(secondPath.id)?.label).toBe("Path 2");

    const replacementEditor = new Editor();
    const loadedPath = {
      ...createDefaultPathNode("root"),
      id: "loaded-path-node",
    };
    replacementEditor.insertNodes([loadedPath]);

    editor.loadDocument(replacementEditor.serializeDocument());

    expect(editor.getLayerRow(loadedPath.id)?.label).toBe("Path 1");
  });

  test("keeps unnamed container fallback labels stable", () => {
    const editor = new Editor();
    const group = {
      ...createDefaultGroupNode(""),
      id: "group-node",
    };
    const artboard = {
      ...createDefaultArtboardNode(""),
      id: "artboard-node",
    };
    const vector = {
      ...createDefaultVectorContainerNode(),
      id: "vector-node",
      name: "",
    };

    editor.insertNodes([group, artboard, vector]);

    expect(editor.getLayerRow(group.id)?.label).toBe("Group 1");
    expect(editor.getLayerRow(artboard.id)?.label).toBe("Artboard 1");
    expect(editor.getLayerRow(vector.id)?.label).toBe("Vector 1");

    const secondGroup = {
      ...createDefaultGroupNode(""),
      id: "second-group-node",
    };
    const secondArtboard = {
      ...createDefaultArtboardNode(""),
      id: "second-artboard-node",
    };
    const secondVector = {
      ...createDefaultVectorContainerNode(),
      id: "second-vector-node",
      name: "",
    };

    editor.insertNodes([secondGroup, secondArtboard, secondVector]);

    expect(editor.getLayerRow(group.id)?.label).toBe("Group 1");
    expect(editor.getLayerRow(artboard.id)?.label).toBe("Artboard 1");
    expect(editor.getLayerRow(vector.id)?.label).toBe("Vector 1");
    expect(editor.getLayerRow(secondGroup.id)?.label).toBe("Group 2");
    expect(editor.getLayerRow(secondArtboard.id)?.label).toBe("Artboard 2");
    expect(editor.getLayerRow(secondVector.id)?.label).toBe("Vector 2");

    editor.setNodeOrder([
      secondGroup.id,
      secondArtboard.id,
      secondVector.id,
      vector.id,
      artboard.id,
      group.id,
    ]);

    expect(editor.getLayerRow(group.id)?.label).toBe("Group 1");
    expect(editor.getLayerRow(artboard.id)?.label).toBe("Artboard 1");
    expect(editor.getLayerRow(vector.id)?.label).toBe("Vector 1");
    expect(editor.getLayerRow(secondGroup.id)?.label).toBe("Group 2");
    expect(editor.getLayerRow(secondArtboard.id)?.label).toBe("Artboard 2");
    expect(editor.getLayerRow(secondVector.id)?.label).toBe("Vector 2");

    const namedGroup = {
      ...createDefaultGroupNode("Named Group"),
      id: "named-group-node",
    };
    editor.insertNodes([namedGroup]);
    expect(editor.getLayerRow(namedGroup.id)?.label).toBe("Named Group");
  });
});
