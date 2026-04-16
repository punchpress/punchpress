import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { resolveNodeToolbarActions } from "../src/components/canvas/canvas-overlay/node-toolbar/node-toolbar-actions";

const createPathNode = () => {
  return {
    closed: true,
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "path-node",
    parentId: "root",
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -120, y: -90 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 120, y: -90 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 120, y: 90 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -120, y: 90 },
        pointType: "corner" as const,
      },
    ],
    stroke: "#000000",
    strokeLineCap: "round" as const,
    strokeLineJoin: "round" as const,
    strokeMiterLimit: 4,
    strokeWidth: 12,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "path" as const,
    visible: true,
  };
};

const createShapeNode = (id: string, x: number, fill: string) => {
  return {
    cornerRadius: 0,
    fill,
    height: 120,
    id,
    parentId: "root",
    shape: "polygon" as const,
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

const getPathToolbarState = (editor: Editor, nodeId: string) => {
  const selectedNode = editor.getNode(nodeId);

  return {
    canBoolean: false,
    canEditPath: true,
    hasPathEditingMode: true,
    isPathEditing: true,
    selectedNode,
    selectedPathPoint:
      editor.pathEditingPoints.length === 1 ? editor.pathEditingPoint : null,
    selectedPathPoints: editor.pathEditingPoints,
    selectionBooleanOperations: {
      exclude: false,
      hasAny: false,
      intersect: false,
      subtract: false,
      unite: false,
    },
    selectionKey: "test",
    visibleSelectedNodeIds: [nodeId],
  };
};

const getBooleanToolbarState = (editor: Editor, nodeIds: string[]) => {
  const selectionBooleanOperations =
    editor.getSelectionBooleanOperations(nodeIds);

  return {
    canBoolean: selectionBooleanOperations.hasAny,
    canEditPath: false,
    hasPathEditingMode: false,
    isPathEditing: false,
    selectedNode: null,
    selectedPathPoint: null,
    selectedPathPoints: [],
    selectionBooleanOperations,
    selectionKey: nodeIds.join(","),
    visibleSelectedNodeIds: nodeIds,
  };
};

describe("node toolbar actions", () => {
  test("multi-point path selection exposes conversion actions instead of generic delete", () => {
    const editor = new Editor();
    const node = createPathNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);

    const actions = resolveNodeToolbarActions(
      editor,
      getPathToolbarState(editor, node.id)
    );
    const actionIds = actions.map((action) => action.id);

    expect(actionIds).toContain("delete-point");
    expect(actionIds).toContain("set-point-corner");
    expect(actionIds).toContain("set-point-smooth");
    expect(actionIds).not.toContain("delete-selection");

    actions.find((action) => action.id === "set-point-smooth")?.onSelect();

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "path") {
      throw new Error(
        "Expected the path node to remain after toolbar conversion."
      );
    }

    expect(nextNode.segments[0]?.pointType).toBe("smooth");
    expect(nextNode.segments[1]?.pointType).toBe("smooth");
  });

  test("multi-selection exposes icon-only boolean actions in the shared action bar", () => {
    const editor = new Editor();

    editor
      .getState()
      .loadNodes([
        createShapeNode("shape-back", 180, "#3366FF"),
        createShapeNode("shape-front", 240, "#FF3366"),
      ]);
    editor.setSelectedNodes(["shape-back", "shape-front"]);

    const actions = resolveNodeToolbarActions(
      editor,
      getBooleanToolbarState(editor, ["shape-back", "shape-front"])
    );
    const actionIds = actions.map((action) => action.id);

    expect(actionIds.slice(0, 4)).toEqual([
      "unite-selection",
      "subtract-selection",
      "intersect-selection",
      "exclude-selection",
    ]);
    expect(
      actions
        .filter((action) => action.id !== "delete-selection")
        .every((action) => action.isIconOnly === true)
    ).toBe(true);

    actions.find((action) => action.id === "unite-selection")?.onSelect();

    const vectorNodes = editor.nodes.filter((node) => node.type === "vector");

    expect(vectorNodes).toHaveLength(1);
    expect(editor.selectedNodeIds).toEqual([vectorNodes[0]?.id]);
  });
});
