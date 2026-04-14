import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { resolveNodeToolbarActions } from "../src/components/canvas/canvas-overlay/node-toolbar/node-toolbar-actions";

const createVectorNode = () => {
  return {
    contours: [
      {
        closed: true,
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
      },
    ],
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "vector-node",
    parentId: "root",
    stroke: "#000000",
    strokeWidth: 12,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "vector" as const,
    visible: true,
  };
};

const getToolbarState = (editor: Editor, nodeId: string) => {
  const selectedNode = editor.getNode(nodeId);

  return {
    canEditPath: true,
    hasPathEditingMode: true,
    isPathEditing: true,
    selectedNode,
    selectedPathPoint:
      editor.pathEditingPoints.length === 1 ? editor.pathEditingPoint : null,
    selectedPathPoints: editor.pathEditingPoints,
    selectionKey: "test",
    visibleSelectedNodeIds: [nodeId],
  };
};

describe("node toolbar actions", () => {
  test("multi-point path selection exposes conversion actions instead of generic delete", () => {
    const editor = new Editor();
    const node = createVectorNode();

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

    const actions = resolveNodeToolbarActions(editor, getToolbarState(editor, node.id));
    const actionIds = actions.map((action) => action.id);

    expect(actionIds).toContain("delete-point");
    expect(actionIds).toContain("set-point-corner");
    expect(actionIds).toContain("set-point-smooth");
    expect(actionIds).not.toContain("delete-selection");

    actions.find((action) => action.id === "set-point-smooth")?.onSelect();

    const nextNode = editor.getNode(node.id);

    if (nextNode?.type !== "vector") {
      throw new Error("Expected the vector node to remain after toolbar conversion.");
    }

    expect(nextNode.contours[0]?.segments[0]?.pointType).toBe("smooth");
    expect(nextNode.contours[0]?.segments[1]?.pointType).toBe("smooth");
  });
});
