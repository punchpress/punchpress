import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createPathNode = (id: string, parentId: string, x: number) => {
  return {
    closed: true,
    fill: "#ff0000",
    fillRule: "nonzero" as const,
    id,
    parentId,
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -40, y: -40 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 40, y: -40 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 40, y: 40 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -40, y: 40 },
        pointType: "corner" as const,
      },
    ],
    stroke: "#000000",
    strokeLineCap: "round" as const,
    strokeLineJoin: "round" as const,
    strokeMiterLimit: 4,
    strokeWidth: 3,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x,
      y: 200,
    },
    type: "path" as const,
    visible: true,
  };
};

const createPathNodes = () => {
  return [
    createPathNode("path-1", "root", 200),
    createPathNode("path-2", "root", 240),
  ];
};

describe("path compound actions", () => {
  test("wraps selected root paths in a compound container", () => {
    const editor = new Editor();

    editor.getState().loadNodes(createPathNodes() as never);
    editor.setSelectedNodes(["path-1", "path-2"]);

    expect(editor.canMakeCompoundPath()).toBe(true);
    expect(editor.canReleaseCompoundPath()).toBe(false);

    editor.makeCompoundPath();

    const vectorNode = editor.selectedNode;

    if (vectorNode?.type !== "vector") {
      throw new Error("Expected a compound vector container.");
    }

    const firstPath = editor.getNode("path-1");
    const secondPath = editor.getNode("path-2");
    const geometry = editor.getNodeRenderGeometry(vectorNode.id);

    expect(vectorNode?.type).toBe("vector");
    expect(vectorNode?.pathComposition).toBe("unite");
    expect(firstPath?.parentId).toBe(vectorNode.id);
    expect(secondPath?.parentId).toBe(vectorNode.id);
    expect(firstPath?.fillRule).toBe("nonzero");
    expect(secondPath?.fillRule).toBe("nonzero");
    expect(geometry?.paths).toHaveLength(1);
    expect(geometry?.paths[0]?.fillRule).toBe("nonzero");
    expect(geometry?.paths[0]?.d.match(/M/g)?.length).toBe(1);
    expect(editor.canMakeCompoundPath()).toBe(false);
    expect(editor.canReleaseCompoundPath()).toBe(true);
  });

  test("releases a compound path by unwrapping the container", () => {
    const editor = new Editor();
    editor.getState().loadNodes(createPathNodes() as never);
    editor.setSelectedNodes(["path-1", "path-2"]);
    editor.makeCompoundPath();

    expect(editor.canMakeCompoundPath()).toBe(false);
    expect(editor.canReleaseCompoundPath()).toBe(true);

    editor.releaseCompoundPath();

    expect(editor.getNode("path-1")?.parentId).toBe("root");
    expect(editor.getNode("path-2")?.parentId).toBe("root");
    expect(editor.nodes.some((node) => node.type === "vector")).toBe(false);
    expect(editor.canReleaseCompoundPath()).toBe(false);
    expect(editor.canMakeCompoundPath(["path-1", "path-2"])).toBe(true);
  });

  test("makes a compound path from a selected vector container", () => {
    const editor = new Editor();
    const nodes = [
      {
        id: "vector-1",
        name: "Compound",
        pathComposition: "independent" as const,
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "vector" as const,
        visible: true,
      },
      createPathNode("vector-1-path-1", "vector-1", 200),
      createPathNode("vector-1-path-2", "vector-1", 240),
    ];

    editor.getState().loadNodes(nodes as never);
    editor.select("vector-1");

    expect(editor.canMakeCompoundPath()).toBe(true);

    editor.makeCompoundPath();

    const firstPath = editor.getNode("vector-1-path-1");
    const secondPath = editor.getNode("vector-1-path-2");
    const geometry = editor.getNodeRenderGeometry("vector-1");

    expect(editor.getNode("vector-1")?.pathComposition).toBe("unite");
    expect(firstPath?.fillRule).toBe("nonzero");
    expect(secondPath?.fillRule).toBe("nonzero");
    expect(geometry?.paths).toHaveLength(1);
    expect(geometry?.paths[0]?.fillRule).toBe("nonzero");
    expect(geometry?.paths[0]?.d.match(/M/g)?.length).toBe(1);
  });

  test("does not allow partial child-path selection to make a compound on an existing vector", () => {
    const editor = new Editor();
    const nodes = [
      {
        id: "vector-1",
        name: "Vector",
        pathComposition: "independent" as const,
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "vector" as const,
        visible: true,
      },
      createPathNode("vector-1-path-1", "vector-1", 200),
      createPathNode("vector-1-path-2", "vector-1", 240),
    ];

    editor.getState().loadNodes(nodes as never);
    editor.setSelectedNodes(["vector-1-path-1"]);

    expect(editor.canMakeCompoundPath(["vector-1-path-1"])).toBe(false);
    expect(editor.makeCompoundPath(["vector-1-path-1"])).toBe(false);
    expect(editor.getNode("vector-1")?.pathComposition).toBe("independent");
  });

  test("releasing a boolean compound on an existing vector keeps the container", () => {
    const editor = new Editor();
    const nodes = [
      {
        id: "vector-1",
        name: "Vector",
        pathComposition: "independent" as const,
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "vector" as const,
        visible: true,
      },
      createPathNode("vector-1-path-1", "vector-1", 200),
      createPathNode("vector-1-path-2", "vector-1", 240),
    ];

    editor.getState().loadNodes(nodes as never);
    editor.select("vector-1");
    editor.makeCompoundPath();

    expect(editor.getNode("vector-1")?.pathComposition).toBe("unite");

    editor.releaseCompoundPath();

    expect(editor.getNode("vector-1")?.type).toBe("vector");
    expect(editor.getNode("vector-1")?.pathComposition).toBe("independent");
    expect(editor.getNode("vector-1-path-1")?.parentId).toBe("vector-1");
    expect(editor.getNode("vector-1-path-2")?.parentId).toBe("vector-1");
  });

  test("does not treat destructive boolean results with compound-fill render as releasable compounds", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        createPathNode("path-1", "root", 200),
        createPathNode("path-2", "root", 420),
      ] as never);
    editor.setSelectedNodes(["path-1", "path-2"]);
    editor.uniteSelection();

    const vectorNode = editor.selectedNode;

    if (vectorNode?.type !== "vector") {
      throw new Error("Expected a boolean result vector.");
    }

    expect(vectorNode.pathComposition).toBe("compound-fill");
    expect(editor.canReleaseCompoundPath()).toBe(false);
    expect(editor.releaseCompoundPath()).toBe(false);
  });
});
