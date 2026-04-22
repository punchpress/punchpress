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

const createVectorNodes = () => {
  return [
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
};

describe("vector path composition actions", () => {
  test("changing path composition updates render and survives save/load", () => {
    const editor = new Editor();
    editor.getState().loadNodes(createVectorNodes() as never);

    expect(editor.getNodeRenderGeometry("vector-1")?.paths).toHaveLength(2);
    expect(editor.setVectorPathComposition("vector-1", "unite")).toBe(true);
    expect(editor.getNode("vector-1")?.pathComposition).toBe("unite");
    expect(editor.getNodeRenderGeometry("vector-1")?.paths).toHaveLength(1);

    const serialized = editor.serializeDocument();
    const reloadedEditor = new Editor();
    reloadedEditor.loadDocument(serialized);

    expect(reloadedEditor.getNode("vector-1")?.pathComposition).toBe("unite");
    expect(
      reloadedEditor.getNodeRenderGeometry("vector-1")?.paths
    ).toHaveLength(1);
  });

  test("rejects legacy child compound metadata on load", () => {
    const editor = new Editor();

    expect(() =>
      editor.loadDocument(
        JSON.stringify({
          nodes: [
            {
              compoundWrapper: true,
              id: "vector-1",
              name: "Compound",
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
              ...createPathNode("vector-1-path-1", "vector-1", 200),
              compoundMode: "subtract",
              compoundPathId: "compound-1",
            },
            {
              ...createPathNode("vector-1-path-2", "vector-1", 240),
              compoundMode: "subtract",
              compoundPathId: "compound-1",
            },
          ],
          version: "1.7",
        })
      )
    ).toThrow();
  });
});
