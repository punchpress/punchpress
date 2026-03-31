import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const clickPen = (editor: Editor, point: { x: number; y: number }) => {
  const session = editor.dispatchCanvasPointerDown({ point });

  if (!session) {
    throw new Error("Expected the pen tool to create a placement session.");
  }

  if (
    session.complete({
      dragDistancePx: 0,
      point,
    }) !== true
  ) {
    throw new Error("Expected the pen tool placement session to complete.");
  }
};

const clickPenNode = (
  editor: Editor,
  nodeId: string,
  point: { x: number; y: number }
) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    throw new Error(
      "Expected the vector node to exist for endpoint continuation."
    );
  }

  const session = editor.dispatchNodePointerDown({ node, point });

  if (!session) {
    throw new Error(
      "Expected the pen tool to create a node placement session."
    );
  }

  if (
    session.complete({
      dragDistancePx: 0,
      point,
    }) !== true
  ) {
    throw new Error(
      "Expected the pen tool node placement session to complete."
    );
  }
};

const dragPen = (
  editor: Editor,
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number }
) => {
  const session = editor.dispatchCanvasPointerDown({ point: startPoint });

  if (!session) {
    throw new Error("Expected the pen tool to create a placement session.");
  }

  session.update({
    dragDistancePx: Math.hypot(
      endPoint.x - startPoint.x,
      endPoint.y - startPoint.y
    ),
    point: endPoint,
  });

  if (
    session.complete({
      dragDistancePx: Math.hypot(
        endPoint.x - startPoint.x,
        endPoint.y - startPoint.y
      ),
      point: endPoint,
    }) !== true
  ) {
    throw new Error("Expected the pen tool drag session to complete.");
  }
};

const movePen = (editor: Editor, point: { x: number; y: number }) => {
  editor.dispatchCanvasPointerMove({ point });
};

const pressKey = (editor: Editor, key: string, code: string) => {
  let prevented = false;

  const event = {
    altKey: false,
    code,
    ctrlKey: false,
    key,
    metaKey: false,
    preventDefault: () => {
      prevented = true;
    },
    shiftKey: false,
    target: null,
  };

  const loweredKey = key.toLowerCase();

  if (
    !editor.handleCanvasShortcutKeyDown(event, loweredKey) &&
    editor.currentTool.onKeyDown({ event, key: loweredKey })
  ) {
    event.preventDefault();
  }

  return prevented;
};

describe("vector pen authoring", () => {
  test("starts an open vector contour and keeps the pen tool active", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });

    const node = editor.selectedNode;

    expect(editor.activeTool).toBe("pen");
    expect(editor.pathEditingNodeId).toBe(node?.id || null);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });
    expect(node).toMatchObject({
      transform: {
        x: 200,
        y: 160,
      },
      type: "vector",
    });

    if (node?.type !== "vector") {
      throw new Error("Expected a vector node after the first pen click.");
    }

    expect(node.contours).toEqual([
      {
        closed: false,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 0 },
            pointType: "corner",
          },
        ],
      },
    ]);
  });

  test("continues the same contour on subsequent pen clicks", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });

    const nodeId = editor.selectedNodeId;

    clickPen(editor, { x: 260, y: 180 });

    expect(editor.nodes).toHaveLength(1);
    expect(editor.selectedNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

    const node = editor.getNode(nodeId);

    if (node?.type !== "vector") {
      throw new Error("Expected the authored path to remain a vector node.");
    }

    expect(node.contours[0]).toEqual({
      closed: false,
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
          point: { x: 60, y: 20 },
          pointType: "corner",
        },
      ],
    });
  });

  test("tracks a live preview point while hovering before the next placement", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });
    movePen(editor, { x: 280, y: 200 });

    expect(editor.getPenPreviewState()).toEqual({
      contourIndex: 0,
      kind: "segment",
      nodeId: editor.selectedNodeId,
      pointer: { x: 80, y: 40 },
      target: null,
    });
  });

  test("dragging the first point creates a smooth anchor with mirrored handles", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    dragPen(editor, { x: 200, y: 160 }, { x: 250, y: 190 });

    const node = editor.selectedNode;

    if (node?.type !== "vector") {
      throw new Error("Expected a vector node after smooth pen placement.");
    }

    const segment = node.contours[0]?.segments[0];

    expect(segment?.pointType).toBe("smooth");
    expect(segment?.handleIn).toEqual({ x: -50, y: -30 });
    expect(segment?.handleOut).toEqual({ x: 50, y: 30 });
  });

  test("dragging a following point creates a smooth anchor with incoming and outgoing handles", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    dragPen(editor, { x: 200, y: 160 }, { x: 250, y: 190 });
    dragPen(editor, { x: 320, y: 220 }, { x: 360, y: 250 });

    const node = editor.selectedNode;

    if (node?.type !== "vector") {
      throw new Error(
        "Expected the authored smooth path to remain a vector node."
      );
    }

    const secondSegment = node.contours[0]?.segments[1];

    expect(secondSegment?.point).toEqual({ x: 120, y: 60 });
    expect(secondSegment?.pointType).toBe("smooth");
    expect(secondSegment?.handleIn).toEqual({ x: -40, y: -30 });
    expect(secondSegment?.handleOut).toEqual({ x: 40, y: 30 });
  });

  test("escape finishes the current pen path so the next click starts a new vector", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });
    clickPen(editor, { x: 260, y: 180 });

    const firstNodeId = editor.selectedNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);
    expect(editor.activeTool).toBe("pen");
    expect(editor.pathEditingNodeId).toBe(firstNodeId);

    clickPen(editor, { x: 360, y: 260 });

    expect(editor.nodes).toHaveLength(2);
    expect(editor.selectedNodeId).not.toBe(firstNodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });
  });

  test("continues an open path from its trailing endpoint with the pen tool", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    clickPenNode(editor, nodeId, { x: 260, y: 140 });

    const resumedNode = editor.getNode(nodeId);

    if (resumedNode?.type !== "vector") {
      throw new Error(
        "Expected the open vector path to remain available for continuation."
      );
    }

    expect(resumedNode.contours[0]?.segments).toHaveLength(2);
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

    clickPen(editor, { x: 320, y: 220 });

    const continuedNode = editor.getNode(nodeId);

    if (continuedNode?.type !== "vector") {
      throw new Error("Expected the continued path to remain a vector node.");
    }

    expect(editor.nodes).toHaveLength(1);
    expect(continuedNode.contours[0]?.segments).toHaveLength(3);
    expect(continuedNode.contours[0]?.segments[2]?.point).toEqual({
      x: 200,
      y: 80,
    });
  });

  test("continues an open path from its leading endpoint with the pen tool", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    clickPenNode(editor, nodeId, { x: 120, y: 140 });

    const resumedNode = editor.getNode(nodeId);

    if (resumedNode?.type !== "vector") {
      throw new Error(
        "Expected the open vector path to remain available for continuation."
      );
    }

    expect(resumedNode.contours[0]?.segments).toHaveLength(2);
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

    clickPen(editor, { x: 80, y: 100 });

    const continuedNode = editor.getNode(nodeId);

    if (continuedNode?.type !== "vector") {
      throw new Error("Expected the continued path to remain a vector node.");
    }

    expect(editor.nodes).toHaveLength(1);
    expect(continuedNode.contours[0]?.segments).toHaveLength(3);
    expect(continuedNode.contours[0]?.segments[2]?.point).toEqual({
      x: -40,
      y: -40,
    });
  });

  test("switching to the pen tool continues from the selected open endpoint", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    editor.setActiveTool("pointer");
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    editor.setActiveTool("pen");
    clickPen(editor, { x: 320, y: 220 });

    const continuedNode = editor.getNode(nodeId);

    if (continuedNode?.type !== "vector") {
      throw new Error("Expected the continued path to remain a vector node.");
    }

    expect(editor.nodes).toHaveLength(1);
    expect(editor.selectedNodeId).toBe(nodeId);
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 2,
    });
    expect(continuedNode.contours[0]?.segments).toHaveLength(3);
    expect(continuedNode.contours[0]?.segments[2]?.point).toEqual({
      x: 200,
      y: 80,
    });
  });

  test("switching to the pen tool from a selected endpoint reactivates the preview path", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    editor.setActiveTool("pointer");
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    editor.setActiveTool("pen");
    movePen(editor, { x: 320, y: 220 });

    expect(editor.getPenPreviewState()).toEqual({
      contourIndex: 0,
      kind: "segment",
      nodeId,
      pointer: { x: 200, y: 80 },
      target: null,
    });
  });

  test("pen hover keeps endpoint continuation and deletes only interior anchors", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 200, y: 200 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    movePen(editor, { x: 260, y: 140 });

    expect(editor.getPenHoverState()).toMatchObject({
      contourIndex: 0,
      intent: "continue",
      nodeId,
      role: "anchor",
      segmentIndex: 2,
    });

    movePen(editor, { x: 200, y: 200 });

    expect(editor.getPenHoverState()).toMatchObject({
      contourIndex: 0,
      intent: "delete",
      nodeId,
      role: "anchor",
      segmentIndex: 1,
    });

    clickPenNode(editor, nodeId, { x: 200, y: 200 });

    const node = editor.getNode(nodeId);

    if (node?.type !== "vector") {
      throw new Error("Expected the vector node to remain after pen deletion.");
    }

    expect(node.contours[0]?.closed).toBe(false);
    expect(node.contours[0]?.segments).toHaveLength(2);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("pen hover accepts slightly off-center hits within the visible anchor halo", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 200, y: 200 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    movePen(editor, { x: 272, y: 140 });

    expect(editor.getPenHoverState()).toMatchObject({
      contourIndex: 0,
      intent: "continue",
      nodeId,
      role: "anchor",
      segmentIndex: 2,
    });

    movePen(editor, { x: 212, y: 200 });

    expect(editor.getPenHoverState()).toMatchObject({
      contourIndex: 0,
      intent: "delete",
      nodeId,
      role: "anchor",
      segmentIndex: 1,
    });

    movePen(editor, { x: 276, y: 140 });

    expect(editor.getPenHoverState()).toMatchObject({
      contourIndex: 0,
      intent: "continue",
      nodeId,
      role: "anchor",
      segmentIndex: 2,
    });

    movePen(editor, { x: 216, y: 200 });

    expect(editor.getPenHoverState()).toMatchObject({
      contourIndex: 0,
      intent: "delete",
      nodeId,
      role: "anchor",
      segmentIndex: 1,
    });
  });

  test("off-center pen clicks still resolve nearby endpoint continuation", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 200, y: 200 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    clickPen(editor, { x: 272, y: 140 });

    expect(editor.nodes).toHaveLength(1);
    expect(editor.selectedNodeId).toBe(nodeId);
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 2,
    });
  });

  test("off-center pen clicks still resolve nearby interior delete", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 200, y: 200 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    clickPen(editor, { x: 212, y: 200 });

    const node = editor.getNode(nodeId);

    if (node?.type !== "vector") {
      throw new Error(
        "Expected the vector node to remain after off-center pen delete."
      );
    }

    expect(editor.nodes).toHaveLength(1);
    expect(node.contours[0]?.segments).toHaveLength(2);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("pen clicking a segment inserts a point instead of requiring the pointer tool", () => {
    const editor = new Editor();

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            contours: [
              {
                closed: true,
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
                    point: { x: 200, y: 0 },
                    pointType: "corner",
                  },
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 200, y: 120 },
                    pointType: "corner",
                  },
                  {
                    handleIn: { x: 0, y: 0 },
                    handleOut: { x: 0, y: 0 },
                    point: { x: 0, y: 120 },
                    pointType: "corner",
                  },
                ],
              },
            ],
            fill: "#000000",
            fillRule: "nonzero",
            id: "vector-node",
            parentId: "root",
            stroke: null,
            strokeWidth: 0,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              x: 320,
              y: 220,
            },
            type: "vector",
            visible: true,
          },
        ],
        version: "1.5",
      })
    );

    editor.select("vector-node");
    editor.startPathEditing("vector-node");
    editor.setActiveTool("pen");

    const session = editor.dispatchNodePointerDown({
      node: editor.getNode("vector-node"),
      point: { x: 420, y: 220 },
    });

    if (!session) {
      throw new Error(
        "Expected pen segment insertion to create a placement session."
      );
    }

    expect(
      session.complete({
        dragDistancePx: 0,
        point: { x: 420, y: 220 },
      })
    ).toBe(true);

    const node = editor.getNode("vector-node");
    const segment =
      node?.type === "vector" ? node.contours[0]?.segments[1] : null;

    expect(node?.type).toBe("vector");
    expect(
      node?.type === "vector" ? node.contours[0]?.segments.length : 0
    ).toBe(5);
    expect(segment?.point).toEqual({ x: 100, y: 0 });
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("dragging onto the starting anchor closes the contour with a smooth incoming handle", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    dragPen(editor, { x: 120, y: 140 }, { x: 80, y: 100 });

    const node = editor.getNode(nodeId);

    if (node?.type !== "vector") {
      throw new Error("Expected the closed path to remain a vector node.");
    }

    expect(node.contours[0]?.closed).toBe(true);
    expect(node.contours[0]?.segments).toHaveLength(2);
    expect(node.contours[0]?.segments[0]).toMatchObject({
      handleIn: { x: 40, y: 40 },
      pointType: "smooth",
    });
  });

  test("clicking the starting anchor closes the active contour", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.selectedNodeId;

    clickPen(editor, { x: 120, y: 140 });

    expect(editor.nodes).toHaveLength(1);
    expect(editor.activeTool).toBe("pen");
    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.pathEditingPoint).toBeNull();

    const node = editor.getNode(nodeId);

    if (node?.type !== "vector") {
      throw new Error("Expected the closed path to remain a vector node.");
    }

    expect(node.contours[0]?.closed).toBe(true);
    expect(node.contours[0]?.segments).toHaveLength(2);

    clickPen(editor, { x: 320, y: 240 });

    expect(editor.nodes).toHaveLength(2);
    expect(editor.selectedNodeId).not.toBe(nodeId);
  });
});
