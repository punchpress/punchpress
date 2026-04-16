import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createShapeNode = (
  id: string,
  x: number,
  fill: string,
  parentId = "root"
) => {
  return {
    cornerRadius: 0,
    fill,
    height: 120,
    id,
    parentId,
    shape: "polygon",
    stroke: "#111111",
    strokeWidth: 6,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x,
      y: 220,
    },
    type: "shape" as const,
    visible: true,
    width: 120,
  };
};

const createOpenPathNode = (id: string) => {
  return {
    closed: false,
    fill: null,
    fillRule: "nonzero" as const,
    id,
    parentId: "root",
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -60, y: 0 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 60, y: 0 },
        pointType: "corner" as const,
      },
    ],
    stroke: "#111111",
    strokeLineCap: "round" as const,
    strokeLineJoin: "round" as const,
    strokeMiterLimit: 4,
    strokeWidth: 3,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 220,
      y: 220,
    },
    type: "path" as const,
    visible: true,
  };
};

const createVectorNode = (id: string, parentId = "root") => {
  return {
    id,
    name: "Vector",
    parentId,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    },
    type: "vector" as const,
    visible: true,
  };
};

const createClosedPathNode = (
  id: string,
  parentId: string,
  x: number,
  fill: string
) => {
  return {
    closed: true,
    fill,
    fillRule: "nonzero" as const,
    id,
    parentId,
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -60, y: -60 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 60, y: -60 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 60, y: 60 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -60, y: 60 },
        pointType: "corner" as const,
      },
    ],
    stroke: "#111111",
    strokeLineCap: "round" as const,
    strokeLineJoin: "round" as const,
    strokeMiterLimit: 4,
    strokeWidth: 6,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x,
      y: 220,
    },
    type: "path" as const,
    visible: true,
  };
};

const createRectangleVectorNodes = (
  vectorId: string,
  pathId: string,
  x: number,
  fill: string
) => {
  return [
    createVectorNode(vectorId),
    createClosedPathNode(pathId, vectorId, x, fill),
  ];
};

const getSingleResultVector = (editor: Editor) => {
  const vectorNodes = editor.nodes.filter((node) => node.type === "vector");

  if (vectorNodes.length !== 1) {
    throw new Error(
      `Expected exactly 1 result vector, received ${vectorNodes.length}.`
    );
  }

  return vectorNodes[0];
};

const getResultPathNodes = (editor: Editor, vectorId: string) => {
  return editor
    .getChildNodeIds(vectorId)
    .map((nodeId) => editor.getNode(nodeId))
    .filter((node) => node?.type === "path");
};

describe("boolean selection", () => {
  test("exposes boolean ops for overlapping same-parent shape selections", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        createShapeNode("shape-back", 180, "#3366FF"),
        createShapeNode("shape-front", 240, "#FF3366"),
      ]);
    editor.setSelectedNodes(["shape-back", "shape-front"]);

    expect(editor.getSelectionBooleanOperations()).toEqual({
      exclude: true,
      hasAny: true,
      intersect: true,
      subtract: true,
      unite: true,
    });
  });

  test("hides boolean ops for open paths", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        createShapeNode("shape-back", 180, "#3366FF"),
        createOpenPathNode("open-path"),
      ]);
    editor.setSelectedNodes(["shape-back", "open-path"]);

    expect(editor.getSelectionBooleanOperations().hasAny).toBe(false);
    expect(editor.uniteSelection()).toBe(false);
  });

  test("unite replaces the selection with one vector result using the frontmost style", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        createShapeNode("shape-back", 180, "#3366FF"),
        createShapeNode("shape-front", 240, "#FF3366"),
      ]);
    editor.setSelectedNodes(["shape-back", "shape-front"]);

    expect(editor.uniteSelection()).toBe(true);

    const resultVector = getSingleResultVector(editor);
    const resultPaths = getResultPathNodes(editor, resultVector.id);

    expect(resultPaths).toHaveLength(1);
    expect(resultPaths[0]).toMatchObject({
      fill: "#FF3366",
      stroke: "#111111",
      type: "path",
    });
    expect(editor.selectedNodeIds).toEqual([resultVector.id]);
  });

  test("subtract removes the frontmost shape from the backmost shape", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        createShapeNode("shape-back", 180, "#3366FF"),
        createShapeNode("shape-front", 240, "#FF3366"),
      ]);
    editor.setSelectedNodes(["shape-back", "shape-front"]);

    expect(editor.subtractSelection()).toBe(true);

    const resultVector = getSingleResultVector(editor);
    const resultPaths = getResultPathNodes(editor, resultVector.id);

    expect(resultPaths).toHaveLength(1);
    expect(resultPaths[0]?.fill).toBe("#FF3366");
    expect(editor.selectedNodeIds).toEqual([resultVector.id]);
  });

  test("intersect keeps only the overlapping area", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        createShapeNode("shape-back", 180, "#3366FF"),
        createShapeNode("shape-front", 240, "#FF3366"),
      ]);
    editor.setSelectedNodes(["shape-back", "shape-front"]);

    expect(editor.intersectSelection()).toBe(true);

    const resultVector = getSingleResultVector(editor);
    const resultPaths = getResultPathNodes(editor, resultVector.id);

    expect(resultPaths).toHaveLength(1);
    expect(resultPaths[0]?.fill).toBe("#FF3366");
  });

  test("exclude creates multiple result paths for the xor areas", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        createShapeNode("shape-back", 180, "#3366FF"),
        createShapeNode("shape-front", 240, "#FF3366"),
      ]);
    editor.setSelectedNodes(["shape-back", "shape-front"]);

    expect(editor.excludeSelection()).toBe(true);

    const resultVector = getSingleResultVector(editor);
    const resultPaths = getResultPathNodes(editor, resultVector.id);

    expect(resultPaths).toHaveLength(2);
    expect(resultPaths.every((pathNode) => pathNode?.fill === "#FF3366")).toBe(
      true
    );
  });

  test("unite supports two top-level vectors and keeps a transform frame on the result selection", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        ...createRectangleVectorNodes(
          "vector-back",
          "path-back",
          180,
          "#3366FF"
        ),
        ...createRectangleVectorNodes(
          "vector-front",
          "path-front",
          240,
          "#FF3366"
        ),
      ]);
    editor.setSelectedNodes(["vector-back", "vector-front"]);

    expect(editor.uniteSelection()).toBe(true);

    const resultVector = getSingleResultVector(editor);
    const resultPaths = getResultPathNodes(editor, resultVector.id);
    const transformFrame = editor.getSelectionTransformFrame([resultVector.id]);

    expect(resultPaths).toHaveLength(1);
    expect(transformFrame).not.toBeNull();
    expect(transformFrame?.bounds.width).toBeGreaterThan(0);
    expect(transformFrame?.bounds.height).toBeGreaterThan(0);
    expect(editor.selectedNodeIds).toEqual([resultVector.id]);
  });

  test("subtract uses document front-to-back order rather than selection order", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        ...createRectangleVectorNodes(
          "vector-back",
          "path-back",
          180,
          "#3366FF"
        ),
        ...createRectangleVectorNodes(
          "vector-front",
          "path-front",
          240,
          "#FF3366"
        ),
      ]);
    editor.setSelectedNodes(["vector-front", "vector-back"]);

    expect(editor.subtractSelection()).toBe(true);

    const resultVector = getSingleResultVector(editor);
    const resultPaths = getResultPathNodes(editor, resultVector.id);

    expect(resultPaths).toHaveLength(1);
    expect(resultPaths[0]?.fill).toBe("#FF3366");
    expect(resultPaths[0]?.transform.x).toBeLessThan(200);
  });

  test("unite rewrites sibling paths inside an existing vector instead of nesting a new vector", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        createVectorNode("vector-node"),
        createClosedPathNode("path-back", "vector-node", 180, "#3366FF"),
        createClosedPathNode("path-front", "vector-node", 240, "#FF3366"),
      ]);

    expect(editor.uniteSelection(["path-back", "path-front"])).toBe(true);

    const vectorNodes = editor.nodes.filter((node) => node.type === "vector");
    const resultPaths = getResultPathNodes(editor, "vector-node");
    const transformFrame = editor.getSelectionTransformFrame(["vector-node"]);

    expect(vectorNodes).toHaveLength(1);
    expect(resultPaths).toHaveLength(1);
    expect(resultPaths[0]).toMatchObject({
      fill: "#FF3366",
      parentId: "vector-node",
      type: "path",
    });
    expect(transformFrame).not.toBeNull();
    expect(transformFrame?.bounds.width).toBeGreaterThan(0);
    expect(transformFrame?.bounds.height).toBeGreaterThan(0);
    expect(editor.selectedNodeIds).toEqual(["vector-node"]);
  });

  test("undo and redo restore boolean geometry changes for top-level vectors", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        ...createRectangleVectorNodes(
          "vector-back",
          "path-back",
          180,
          "#3366FF"
        ),
        ...createRectangleVectorNodes(
          "vector-front",
          "path-front",
          240,
          "#FF3366"
        ),
      ]);
    editor.setSelectedNodes(["vector-back", "vector-front"]);

    expect(editor.uniteSelection()).toBe(true);
    expect(editor.nodes.filter((node) => node.type === "vector")).toHaveLength(
      1
    );
    expect(editor.nodes.filter((node) => node.type === "path")).toHaveLength(1);

    expect(editor.undo()).toBe(true);
    expect(editor.nodes.filter((node) => node.type === "vector")).toHaveLength(
      2
    );
    expect(editor.nodes.filter((node) => node.type === "path")).toHaveLength(2);
    expect(editor.getNode("vector-back")?.type).toBe("vector");
    expect(editor.getNode("vector-front")?.type).toBe("vector");
    expect(editor.getNode("path-back")?.type).toBe("path");
    expect(editor.getNode("path-front")?.type).toBe("path");

    expect(editor.redo()).toBe(true);
    expect(editor.nodes.filter((node) => node.type === "vector")).toHaveLength(
      1
    );
    expect(editor.nodes.filter((node) => node.type === "path")).toHaveLength(1);
  });
});
