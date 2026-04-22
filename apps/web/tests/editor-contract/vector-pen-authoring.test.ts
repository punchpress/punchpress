import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { getNodeWorldPoint } from "../../../../packages/engine/src/primitives/rotation";

const createRectanglePathDocument = () => {
  const segments = [
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 0, y: 0 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 200, y: 0 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 200, y: 120 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 0, y: 120 },
      pointType: "corner" as const,
    },
  ];

  return {
    nodes: [
      {
        id: "vector-container",
        name: "Vector",
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
      {
        closed: true,
        fill: "#000000",
        fillRule: "nonzero" as const,
        id: "vector-node",
        parentId: "vector-container",
        segments,
        stroke: null,
        strokeLineCap: "butt",
        strokeLineJoin: "miter",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 320,
          y: 220,
        },
        type: "path" as const,
        visible: true,
      },
    ],
    version: "1.7",
  };
};

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

const optionClickPen = (editor: Editor, point: { x: number; y: number }) => {
  const session = editor.dispatchCanvasPointerDown({
    event: {
      altKey: true,
    },
    point,
  });

  if (!session) {
    throw new Error(
      "Expected the pen tool to create a modifier-click placement session."
    );
  }

  if (
    session.complete({
      dragDistancePx: 0,
      point,
    }) !== true
  ) {
    throw new Error("Expected the pen modifier-click placement to complete.");
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
  endPoint: { x: number; y: number },
  {
    dragDistancePx,
    spaceKey = false,
  }: { dragDistancePx?: number; spaceKey?: boolean } = {}
) => {
  const session = editor.dispatchCanvasPointerDown({ point: startPoint });

  if (!session) {
    throw new Error("Expected the pen tool to create a placement session.");
  }

  const resolvedDragDistancePx =
    dragDistancePx ||
    Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);

  session.update({
    dragDistancePx: resolvedDragDistancePx,
    point: endPoint,
    spaceKey,
  });

  if (
    session.complete({
      dragDistancePx: resolvedDragDistancePx,
      point: endPoint,
      spaceKey,
    }) !== true
  ) {
    throw new Error("Expected the pen tool drag session to complete.");
  }
};

const dragPenWithUpdates = (
  editor: Editor,
  startPoint: { x: number; y: number },
  updates: Array<{
    dragDistancePx?: number;
    point: { x: number; y: number };
    spaceKey?: boolean;
  }>
) => {
  const session = editor.dispatchCanvasPointerDown({ point: startPoint });

  if (!session) {
    throw new Error("Expected the pen tool to create a placement session.");
  }

  for (const update of updates) {
    session.update(update);
  }

  const lastUpdate = updates.at(-1);

  if (!lastUpdate) {
    throw new Error("Expected at least one pen drag update.");
  }

  if (session.complete(lastUpdate) !== true) {
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

const getSelectedPathNode = (editor: Editor) => {
  const node = editor.selectedNode;

  if (node?.type !== "path") {
    throw new Error("Expected the selected node to be a path.");
  }

  return node;
};

const getPathNode = (editor: Editor, nodeId = editor.pathEditingNodeId) => {
  const node = nodeId ? editor.getNode(nodeId) : null;

  if (node?.type !== "path") {
    throw new Error("Expected a path node.");
  }

  return node;
};

const getRootPathCount = (editor: Editor) => {
  return editor.nodes.filter((node) => {
    return node.type === "path" && node.parentId === "root";
  }).length;
};

const getRootPathIds = (editor: Editor) => {
  return editor.nodes
    .filter((node) => node.type === "path" && node.parentId === "root")
    .map((node) => node.id);
};

const createOpenPathDocument = () => {
  return {
    nodes: [
      {
        id: "open-vector-container",
        name: "Vector",
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
      {
        closed: false,
        fill: "#000000",
        fillRule: "nonzero" as const,
        id: "open-vector-node",
        parentId: "open-vector-container",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 36, y: 0 },
            point: { x: 0, y: 0 },
            pointType: "smooth" as const,
          },
          {
            handleIn: { x: -48, y: 0 },
            handleOut: { x: 48, y: 0 },
            point: { x: 120, y: 120 },
            pointType: "smooth" as const,
          },
          {
            handleIn: { x: -36, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 240, y: 120 },
            pointType: "smooth" as const,
          },
        ],
        stroke: "#000000",
        strokeLineCap: "round" as const,
        strokeLineJoin: "round" as const,
        strokeMiterLimit: 4,
        strokeWidth: 8,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 280,
          y: 180,
        },
        type: "path" as const,
        visible: true,
      },
    ],
    version: "1.7",
  };
};

describe("vector pen authoring", () => {
  test("starts an open path and keeps the pen tool active", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });

    const pathNode = getPathNode(editor);
    const selectedPathNode = getSelectedPathNode(editor);

    expect(editor.activeTool).toBe("pen");
    expect(editor.pathEditingNodeId).toBe(pathNode.id);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });
    expect(selectedPathNode.id).toBe(pathNode.id);
    expect(pathNode).toMatchObject({
      parentId: "root",
      strokeWidth: 3,
      transform: {
        x: 200,
        y: 160,
      },
      type: "path",
    });
    expect(pathNode.segments).toEqual([
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 0, y: 0 },
        pointType: "corner",
      },
    ]);
  });

  test("continues the same contour on subsequent pen clicks", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });

    const nodeId = editor.pathEditingNodeId;

    clickPen(editor, { x: 260, y: 180 });

    expect(editor.nodes).toHaveLength(1);
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

    const node = getPathNode(editor, nodeId);

    expect(node.closed).toBe(false);
    expect(node.segments).toEqual([
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
    ]);
  });

  test("tracks a live preview point while hovering before the next placement", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });
    movePen(editor, { x: 280, y: 200 });

    expect(editor.getPenPreviewState()).toEqual({
      contourIndex: 0,
      kind: "segment",
      nodeId: editor.pathEditingNodeId,
      pointer: { x: 80, y: 40 },
      target: null,
    });
  });

  test("dragging the first point creates a smooth anchor with mirrored handles", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    dragPen(editor, { x: 200, y: 160 }, { x: 250, y: 190 });

    const node = getPathNode(editor);
    const segment = node.segments[0];

    expect(segment?.pointType).toBe("smooth");
    expect(segment?.handleIn).toEqual({ x: -50, y: -30 });
    expect(segment?.handleOut).toEqual({ x: 50, y: 30 });
  });

  test("holding space while dragging a following pen point repositions the anchor without changing its handles", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });
    dragPenWithUpdates(editor, { x: 260, y: 180 }, [
      {
        dragDistancePx: Math.hypot(40, 20),
        point: { x: 300, y: 200 },
      },
      {
        dragDistancePx: Math.hypot(60, 40),
        point: { x: 320, y: 220 },
        spaceKey: true,
      },
    ]);

    const node = getPathNode(editor);
    const segment = node.segments[1];

    expect(segment).toMatchObject({
      handleIn: { x: -40, y: -20 },
      handleOut: { x: 40, y: 20 },
      point: { x: 80, y: 40 },
      pointType: "smooth",
    });
  });

  test("option-clicking an existing anchor with pen toggles it between corner and smooth", () => {
    const editor = new Editor();

    editor.loadDocument(JSON.stringify(createOpenPathDocument()));
    editor.select("open-vector-node");
    editor.startPathEditing("open-vector-node");
    editor.setActiveTool("pen");

    const node = getPathNode(editor, "open-vector-node");
    const bbox = editor.getNodeGeometry("open-vector-node")?.bbox;

    if (!bbox) {
      throw new Error("Expected an editable path node for pen point toggle.");
    }

    const targetPoint = getNodeWorldPoint(node, bbox, node.segments[1].point);

    optionClickPen(editor, targetPoint);

    let updatedNode = getPathNode(editor, "open-vector-node");
    let segment = updatedNode.segments[1];

    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
    expect(segment).toMatchObject({
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      pointType: "corner",
    });

    optionClickPen(editor, targetPoint);

    updatedNode = getPathNode(editor, "open-vector-node");
    segment = updatedNode.segments[1];

    expect(segment?.pointType).toBe("smooth");
    expect(
      Math.hypot(segment?.handleIn.x || 0, segment?.handleIn.y || 0)
    ).toBeGreaterThan(1);
    expect(
      Math.hypot(segment?.handleOut.x || 0, segment?.handleOut.y || 0)
    ).toBeGreaterThan(1);
  });

  test("tiny pen drag on the first point still creates a corner point", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    dragPen(editor, { x: 200, y: 160 }, { x: 204, y: 163 });

    const node = getPathNode(editor);
    const segment = node.segments[0];

    expect(segment?.pointType).toBe("corner");
    expect(segment?.handleIn).toEqual({ x: 0, y: 0 });
    expect(segment?.handleOut).toEqual({ x: 0, y: 0 });
  });

  test("near-click pen drag on the first point still creates a corner point", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    dragPen(editor, { x: 200, y: 160 }, { x: 208, y: 166 });

    const node = getPathNode(editor);
    const segment = node.segments[0];

    expect(segment?.pointType).toBe("corner");
    expect(segment?.handleIn).toEqual({ x: 0, y: 0 });
    expect(segment?.handleOut).toEqual({ x: 0, y: 0 });
  });

  test("first-point smoothing uses authored handle length instead of raw drag distance", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    dragPen(
      editor,
      { x: 200, y: 160 },
      { x: 204, y: 163 },
      { dragDistancePx: 8 }
    );

    const node = getPathNode(editor);
    const segment = node.segments[0];

    expect(segment?.pointType).toBe("corner");
    expect(segment?.handleIn).toEqual({ x: 0, y: 0 });
    expect(segment?.handleOut).toEqual({ x: 0, y: 0 });
  });

  test("dragging a following point creates a smooth anchor with incoming and outgoing handles", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    dragPen(editor, { x: 200, y: 160 }, { x: 250, y: 190 });
    dragPen(editor, { x: 320, y: 220 }, { x: 360, y: 250 });

    const node = getPathNode(editor);
    const secondSegment = node.segments[1];

    expect(secondSegment?.point).toEqual({ x: 120, y: 60 });
    expect(secondSegment?.pointType).toBe("smooth");
    expect(secondSegment?.handleIn).toEqual({ x: -40, y: -30 });
    expect(secondSegment?.handleOut).toEqual({ x: 40, y: 30 });
  });

  test("tiny pen drag on a following point still creates a corner point", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });
    dragPen(editor, { x: 260, y: 180 }, { x: 264, y: 183 });

    const node = getPathNode(editor);
    const secondSegment = node.segments[1];

    expect(secondSegment?.pointType).toBe("corner");
    expect(secondSegment?.handleIn).toEqual({ x: 0, y: 0 });
    expect(secondSegment?.handleOut).toEqual({ x: 0, y: 0 });
  });

  test("near-click pen drag on a following point still creates a corner point", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });
    dragPen(editor, { x: 260, y: 180 }, { x: 268, y: 186 });

    const node = getPathNode(editor);
    const secondSegment = node.segments[1];

    expect(secondSegment?.pointType).toBe("corner");
    expect(secondSegment?.handleIn).toEqual({ x: 0, y: 0 });
    expect(secondSegment?.handleOut).toEqual({ x: 0, y: 0 });
  });

  test("follow-up smoothing uses authored handle length instead of raw drag distance", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });
    dragPen(
      editor,
      { x: 260, y: 180 },
      { x: 264, y: 183 },
      { dragDistancePx: 8 }
    );

    const node = getPathNode(editor);
    const secondSegment = node.segments[1];

    expect(secondSegment?.pointType).toBe("corner");
    expect(secondSegment?.handleIn).toEqual({ x: 0, y: 0 });
    expect(secondSegment?.handleOut).toEqual({ x: 0, y: 0 });
  });

  test("escape finishes the current pen path so the next click starts a new path", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });
    clickPen(editor, { x: 260, y: 180 });

    const firstPathId = editor.selectedNodeId;
    const firstNodeId = editor.pathEditingNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);
    expect(editor.activeTool).toBe("pen");
    expect(editor.pathEditingNodeId).toBe(firstNodeId);
    expect(editor.pathEditingPoint).toBeNull();

    clickPen(editor, { x: 360, y: 260 });

    expect(getRootPathCount(editor)).toBe(2);
    expect(editor.selectedNodeId).not.toBe(firstPathId);
    expect(editor.pathEditingNodeId).not.toBe(firstNodeId);
    expect(getRootPathIds(editor)).toHaveLength(2);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });
  });

  test("exiting path editing with E finishes the active pen path so the next click starts a new path", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 200, y: 160 });
    clickPen(editor, { x: 260, y: 160 });
    clickPen(editor, { x: 260, y: 220 });

    const firstPathId = editor.selectedNodeId;
    const firstNodeId = editor.pathEditingNodeId;

    expect(pressKey(editor, "E", "KeyE")).toBe(true);
    expect(editor.activeTool).toBe("pen");
    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.pathEditingPoint).toBeNull();

    clickPen(editor, { x: 360, y: 260 });

    expect(getRootPathCount(editor)).toBe(2);
    expect(editor.selectedNodeId).not.toBe(firstPathId);
    expect(editor.pathEditingNodeId).not.toBe(firstNodeId);
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

    const nodeId = editor.pathEditingNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    clickPenNode(editor, nodeId, { x: 260, y: 140 });

    const resumedNode = getPathNode(editor, nodeId);

    expect(resumedNode.segments).toHaveLength(2);
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

    clickPen(editor, { x: 320, y: 220 });

    const continuedNode = getPathNode(editor, nodeId);

    expect(editor.nodes).toHaveLength(1);
    expect(continuedNode.segments).toHaveLength(3);
    expect(continuedNode.segments[2]?.point).toEqual({
      x: 200,
      y: 80,
    });
  });

  test("continues an open path from its leading endpoint with the pen tool", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.pathEditingNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    clickPenNode(editor, nodeId, { x: 120, y: 140 });

    const resumedNode = getPathNode(editor, nodeId);

    expect(resumedNode.segments).toHaveLength(2);
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });

    clickPen(editor, { x: 80, y: 100 });

    const continuedNode = getPathNode(editor, nodeId);

    expect(editor.nodes).toHaveLength(1);
    expect(continuedNode.segments).toHaveLength(3);
    expect(continuedNode.segments[2]?.point).toEqual({
      x: -40,
      y: -40,
    });
  });

  test("switching to the pen tool continues from the selected open endpoint", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.pathEditingNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    editor.setActiveTool("pointer");
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    editor.setActiveTool("pen");
    clickPen(editor, { x: 320, y: 220 });

    const continuedNode = getPathNode(editor, nodeId);

    expect(editor.nodes).toHaveLength(1);
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 2,
    });
    expect(continuedNode.segments).toHaveLength(3);
    expect(continuedNode.segments[2]?.point).toEqual({
      x: 200,
      y: 80,
    });
  });

  test("switching to the pen tool from a selected endpoint reactivates the preview path", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const nodeId = editor.pathEditingNodeId;

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

    const nodeId = editor.pathEditingNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    movePen(editor, { x: 260, y: 140 });

    expect(editor.getPenHoverState()).toMatchObject({
      contourIndex: 0,
      intent: "continue",
      nodeId,
      point: { x: 140, y: 0 },
      role: "anchor",
      segmentIndex: 2,
    });

    movePen(editor, { x: 200, y: 200 });

    expect(editor.getPenHoverState()).toMatchObject({
      contourIndex: 0,
      intent: "delete",
      nodeId,
      point: { x: 80, y: 60 },
      role: "anchor",
      segmentIndex: 1,
    });

    clickPenNode(editor, nodeId, { x: 200, y: 200 });

    const node = getPathNode(editor, nodeId);

    expect(node.closed).toBe(false);
    expect(node.segments).toHaveLength(2);
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

    const nodeId = editor.pathEditingNodeId;

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

    const nodeId = editor.pathEditingNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    clickPen(editor, { x: 272, y: 140 });

    expect(editor.nodes).toHaveLength(1);
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

    const nodeId = editor.pathEditingNodeId;

    expect(pressKey(editor, "Escape", "Escape")).toBe(true);

    clickPen(editor, { x: 212, y: 200 });

    const node = getPathNode(editor, nodeId);

    expect(editor.nodes).toHaveLength(1);
    expect(node.segments).toHaveLength(2);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("pen clicking a segment inserts a point instead of requiring the pointer tool", () => {
    const editor = new Editor();

    editor.loadDocument(JSON.stringify(createRectanglePathDocument()));

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
    const segment = node?.type === "path" ? node.segments[1] : null;

    expect(node?.type).toBe("path");
    expect(node?.type === "path" ? node.segments.length : 0).toBe(5);
    expect(segment?.point).toEqual({ x: 100, y: 0 });
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("pen clicking an off-center spot on a segment inserts the point at that hovered location", () => {
    const editor = new Editor();

    editor.loadDocument(JSON.stringify(createRectanglePathDocument()));

    editor.select("vector-node");
    editor.startPathEditing("vector-node");
    editor.setActiveTool("pen");

    const vectorNode = editor.getNode("vector-node");
    const bbox = editor.getNodeGeometry("vector-node")?.bbox;

    if (!(vectorNode?.type === "path" && bbox)) {
      throw new Error("Expected vector geometry for off-center insertion.");
    }

    const firstWorldPoint = getNodeWorldPoint(
      vectorNode,
      bbox,
      vectorNode.segments[0].point
    );
    const secondWorldPoint = getNodeWorldPoint(
      vectorNode,
      bbox,
      vectorNode.segments[1].point
    );
    const quarterPoint = {
      x: firstWorldPoint.x + (secondWorldPoint.x - firstWorldPoint.x) * 0.25,
      y: firstWorldPoint.y + (secondWorldPoint.y - firstWorldPoint.y) * 0.25,
    };

    const session = editor.dispatchNodePointerDown({
      node: editor.getNode("vector-node"),
      point: quarterPoint,
    });

    if (!session) {
      throw new Error(
        "Expected off-center pen segment insertion to create a placement session."
      );
    }

    expect(
      session.complete({
        dragDistancePx: 0,
        point: quarterPoint,
      })
    ).toBe(true);

    const node = editor.getNode("vector-node");
    const segment = node?.type === "path" ? node.segments[1] : null;

    expect(node?.type).toBe("path");
    expect(node?.type === "path" ? node.segments.length : 0).toBe(5);
    expect(segment?.point).toEqual({ x: 50, y: 0 });
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
  });

  test("pen hover updates the add-point target while moving along the same segment", () => {
    const editor = new Editor();

    editor.loadDocument(JSON.stringify(createRectanglePathDocument()));

    editor.select("vector-node");
    editor.startPathEditing("vector-node");
    editor.setActiveTool("pen");

    const vectorNode = editor.getNode("vector-node");
    const bbox = editor.getNodeGeometry("vector-node")?.bbox;

    if (!(vectorNode?.type === "path" && bbox)) {
      throw new Error("Expected vector geometry for insert hover.");
    }

    const firstWorldPoint = getNodeWorldPoint(
      vectorNode,
      bbox,
      vectorNode.segments[0].point
    );
    const secondWorldPoint = getNodeWorldPoint(
      vectorNode,
      bbox,
      vectorNode.segments[1].point
    );

    movePen(editor, {
      x: firstWorldPoint.x + (secondWorldPoint.x - firstWorldPoint.x) * 0.25,
      y: firstWorldPoint.y,
    });

    expect(editor.getPenHoverState()).toEqual({
      contourIndex: 0,
      intent: "add",
      nodeId: "vector-node",
      point: { x: 50, y: 0 },
      role: "segment",
      segmentIndex: 1,
    });

    movePen(editor, {
      x: firstWorldPoint.x + (secondWorldPoint.x - firstWorldPoint.x) * 0.75,
      y: firstWorldPoint.y,
    });

    expect(editor.getPenHoverState()).toEqual({
      contourIndex: 0,
      intent: "add",
      nodeId: "vector-node",
      point: { x: 150, y: 0 },
      role: "segment",
      segmentIndex: 1,
    });
  });

  test("dragging on a segment with the pen inserts a smooth point and authors handles", () => {
    const editor = new Editor();

    editor.loadDocument(JSON.stringify(createRectanglePathDocument()));

    editor.select("vector-node");
    editor.startPathEditing("vector-node");
    editor.setActiveTool("pen");

    const vectorNode = editor.getNode("vector-node");
    const bbox = editor.getNodeGeometry("vector-node")?.bbox;

    if (!(vectorNode?.type === "path" && bbox)) {
      throw new Error("Expected vector geometry for dragged insertion.");
    }

    const firstWorldPoint = getNodeWorldPoint(
      vectorNode,
      bbox,
      vectorNode.segments[0].point
    );
    const secondWorldPoint = getNodeWorldPoint(
      vectorNode,
      bbox,
      vectorNode.segments[1].point
    );
    const quarterPoint = {
      x: firstWorldPoint.x + (secondWorldPoint.x - firstWorldPoint.x) * 0.25,
      y: firstWorldPoint.y + (secondWorldPoint.y - firstWorldPoint.y) * 0.25,
    };
    const dragEndPoint = {
      x: quarterPoint.x + 40,
      y: quarterPoint.y - 30,
    };

    const session = editor.dispatchNodePointerDown({
      node: editor.getNode("vector-node"),
      point: quarterPoint,
    });

    if (!session) {
      throw new Error(
        "Expected dragged pen segment insertion to create a placement session."
      );
    }

    session.update({
      dragDistancePx: Math.hypot(
        dragEndPoint.x - quarterPoint.x,
        dragEndPoint.y - quarterPoint.y
      ),
      point: dragEndPoint,
    });

    expect(
      session.complete({
        dragDistancePx: Math.hypot(
          dragEndPoint.x - quarterPoint.x,
          dragEndPoint.y - quarterPoint.y
        ),
        point: dragEndPoint,
      })
    ).toBe(true);

    const node = editor.getNode("vector-node");
    const segment = node?.type === "path" ? node.segments[1] : null;

    expect(node?.type).toBe("path");
    expect(node?.type === "path" ? node.segments.length : 0).toBe(5);
    expect(segment?.point).toEqual({ x: 50, y: 0 });
    expect(segment?.pointType).toBe("smooth");
    expect(segment?.handleIn).toEqual({ x: -40, y: 30 });
    expect(segment?.handleOut).toEqual({ x: 40, y: -30 });
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

    const nodeId = editor.pathEditingNodeId;

    dragPen(editor, { x: 120, y: 140 }, { x: 80, y: 100 });

    const node = getPathNode(editor, nodeId);

    expect(node.closed).toBe(true);
    expect(node.segments).toHaveLength(2);
    expect(node.segments[0]).toMatchObject({
      handleIn: { x: 40, y: 40 },
      pointType: "smooth",
    });
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });
  });

  test("clicking the starting anchor closes the active contour and the next disconnected click starts a new path", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    clickPen(editor, { x: 120, y: 140 });
    clickPen(editor, { x: 260, y: 140 });

    const firstPathId = editor.selectedNodeId;
    const nodeId = editor.pathEditingNodeId;

    clickPen(editor, { x: 120, y: 140 });

    expect(editor.nodes).toHaveLength(1);
    expect(editor.activeTool).toBe("pen");
    expect(editor.pathEditingNodeId).toBe(nodeId);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });

    const node = getPathNode(editor, nodeId);

    expect(node.closed).toBe(true);
    expect(node.segments).toHaveLength(2);

    clickPen(editor, { x: 320, y: 240 });

    expect(getRootPathCount(editor)).toBe(2);
    expect(editor.selectedNodeId).not.toBe(firstPathId);
    expect(editor.pathEditingNodeId).not.toBe(nodeId);
    expect(getRootPathIds(editor)).toHaveLength(2);
  });
});
