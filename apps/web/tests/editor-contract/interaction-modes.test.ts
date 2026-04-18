import { describe, expect, test } from "bun:test";
import { Editor, estimateBounds } from "@punchpress/engine";

const FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

const createEditor = () => {
  const editor = new Editor();

  editor.applyLocalFontCatalog({
    error: "",
    fonts: [{ ...FONT, id: "arialmt" }],
    state: "ready",
  });

  return editor;
};

const mockCircleGuideGeometry = (editor, node) => {
  const bbox = estimateBounds(node);

  editor.geometry.getById = () => ({
    bbox,
    guide: { kind: "circle" },
    paths: [],
    ready: true,
    selectionBounds: null,
  });
};

const createCircleNode = () => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize: 120,
    id: "circle-node",
    parentId: "root",
    stroke: null,
    strokeWidth: 0,
    text: "CIRCLE",
    tracking: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 380,
      y: 220,
    },
    type: "text",
    visible: true,
    warp: {
      kind: "circle",
      pathPosition: 0,
      radius: 320,
      sweepDeg: 140,
    },
  } as const;
};

const createPlainTextNode = () => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize: 120,
    id: "text-node",
    parentId: "root",
    stroke: null,
    strokeWidth: 0,
    text: "TEXT",
    tracking: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 380,
      y: 220,
    },
    type: "text",
    visible: true,
    warp: {
      kind: "none",
    },
  } as const;
};

const createArchNode = () => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize: 120,
    id: "arch-node",
    parentId: "root",
    stroke: null,
    strokeWidth: 0,
    text: "ARCH",
    tracking: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 380,
      y: 220,
    },
    type: "text",
    visible: true,
    warp: {
      bend: 0.4,
      kind: "arch",
    },
  } as const;
};

const createWaveNode = () => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize: 120,
    id: "wave-node",
    parentId: "root",
    stroke: null,
    strokeWidth: 0,
    text: "WAVE",
    tracking: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 380,
      y: 220,
    },
    type: "text",
    visible: true,
    warp: {
      amplitude: 180,
      cycles: 2,
      kind: "wave",
    },
  } as const;
};

const createSlantNode = () => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize: 120,
    id: "slant-node",
    parentId: "root",
    stroke: null,
    strokeWidth: 0,
    text: "SLANT",
    tracking: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 380,
      y: 220,
    },
    type: "text",
    visible: true,
    warp: {
      kind: "slant",
      rise: -120,
    },
  } as const;
};

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
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 120, y: -90 },
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 120, y: 90 },
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -120, y: 90 },
          },
        ],
      },
    ],
    fill: "#ffffff",
    fillRule: "nonzero",
    id: "vector-node",
    parentId: "root",
    stroke: "#000000",
    strokeWidth: 12,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 380,
      y: 220,
    },
    type: "vector",
    visible: true,
  } as const;
};

const createVectorContainerWithPaths = () => {
  return [
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
      fill: "#ffffff",
      fillRule: "nonzero" as const,
      id: "vector-path-1",
      parentId: "vector-container",
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
    },
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero" as const,
      id: "vector-path-2",
      parentId: "vector-container",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -80, y: -50 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 80, y: -50 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 80, y: 50 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -80, y: 50 },
          pointType: "corner" as const,
        },
      ],
      stroke: "#000000",
      strokeWidth: 12,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 540,
        y: 220,
      },
      type: "path" as const,
      visible: true,
    },
  ] as const;
};

const createSinglePathVectorNodes = () => {
  return [
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
      fill: "#ffffff",
      fillRule: "nonzero" as const,
      id: "vector-path",
      parentId: "vector-container",
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
      strokeWidth: 12,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 380,
        y: 220,
      },
      type: "path" as const,
      visible: true,
    },
  ] as const;
};

describe("Editor interaction mode boundaries", () => {
  test("startPathEditing clears incompatible transient interaction state", () => {
    const editor = createEditor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);
    mockCircleGuideGeometry(editor, node);
    editor.select(node.id);
    editor.setHoveredNode(node.id);
    editor.beginSelectionRotationInteraction();
    editor.beginTextPathPositioningInteraction();

    editor.startPathEditing(node.id);

    expect(editor.pathEditingNodeId).toBe(node.id);
    expect(editor.hoveredNodeId).toBeNull();
    expect(editor.isHoveringSuppressed).toBe(false);
    expect(editor.isSelectionDragging).toBe(false);
    expect(editor.isSelectionRotating).toBe(false);
    expect(editor.isTextPathPositioning).toBe(false);
  });

  test("vector nodes can enter explicit path editing mode", () => {
    const editor = createEditor();
    const nodes = createSinglePathVectorNodes();

    editor.getState().loadNodes([...nodes]);
    editor.select("vector-container");

    expect(editor.canEditNodePath("vector-container")).toBe(true);
    expect(editor.canStartPathEditing("vector-container")).toBe(true);
    expect(editor.startPathEditing("vector-container")).toBe(true);
    expect(editor.selectedNodeIds).toEqual(["vector-path"]);
    expect(editor.pathEditingNodeId).toBe("vector-path");
  });

  test("vector path editing exposes an editable child path session for the vector path backend", () => {
    const editor = createEditor();
    const nodes = createSinglePathVectorNodes();
    const pathNode = nodes[1];

    editor.getState().loadNodes([...nodes]);
    editor.select("vector-container");
    editor.startPathEditing("vector-container");
    editor.setPathEditingPoints(
      [
        {
          contourIndex: 0,
          segmentIndex: 1,
        },
        {
          contourIndex: 0,
          segmentIndex: 3,
        },
      ],
      {
        contourIndex: 0,
        segmentIndex: 1,
      }
    );

    expect(editor.getEditablePathSession("vector-path")).toEqual({
      backend: "vector-path",
      contours: [
        {
          closed: pathNode.closed,
          segments: pathNode.segments,
        },
      ],
      interactionPolicy: {
        canInsertPoint: true,
      },
      nodeId: "vector-path",
      nodeType: "path",
      selectedPoints: [
        {
          contourIndex: 0,
          segmentIndex: 1,
        },
        {
          contourIndex: 0,
          segmentIndex: 3,
        },
      ],
      selectedPoint: {
        contourIndex: 0,
        segmentIndex: 1,
      },
    });
  });

  test("multi-path vector containers enter path editing through a child path and select that contour", () => {
    const editor = createEditor();
    const nodes = createVectorContainerWithPaths();

    editor.getState().loadNodes([...nodes]);
    editor.select("vector-container");

    expect(editor.canEditNodePath("vector-container")).toBe(true);
    expect(editor.canStartPathEditing("vector-container")).toBe(true);
    expect(editor.startPathEditing("vector-container")).toBe(true);
    expect(editor.selectedNodeIds).toEqual(["vector-path-1"]);
    expect(editor.pathEditingNodeId).toBe("vector-path-1");
  });

  test("multi-path vector path editing can retarget to another child path without exiting edit mode", () => {
    const editor = createEditor();
    const nodes = createVectorContainerWithPaths();

    editor.getState().loadNodes([...nodes]);
    editor.select("vector-container");
    editor.startPathEditing("vector-container");

    expect(editor.startPathEditing("vector-path-2")).toBe(true);
    expect(editor.selectedNodeIds).toEqual(["vector-path-2"]);
    expect(editor.pathEditingNodeId).toBe("vector-path-2");
  });

  test("selecting a vector parent while path editing exits contour editing", () => {
    const editor = createEditor();
    const nodes = createVectorContainerWithPaths();

    editor.getState().loadNodes([...nodes]);
    editor.select("vector-container");
    editor.startPathEditing("vector-container");

    editor.select("vector-container");

    expect(editor.selectedNodeIds).toEqual(["vector-container"]);
    expect(editor.pathEditingNodeId).toBeNull();
  });

  test("text guide path editing does not expose a vector path session", () => {
    const editor = createEditor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);
    mockCircleGuideGeometry(editor, node);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    expect(editor.getEditablePathSession(node.id)).toBeNull();
  });

  test("vector path editing persists across vector node updates", () => {
    const editor = createEditor();
    const nodes = createSinglePathVectorNodes();

    editor.getState().loadNodes([...nodes]);
    editor.select("vector-container");
    editor.startPathEditing("vector-container");

    editor.updateNode("vector-path", {
      transform: {
        x: nodes[1].transform.x + 40,
        y: nodes[1].transform.y + 20,
      },
    });

    expect(editor.pathEditingNodeId).toBe("vector-path");
    expect(editor.isPathEditing("vector-path")).toBe(true);
  });

  test("updateEditablePath updates vector child path contours through the shared path interface", () => {
    const editor = createEditor();
    const nodes = createSinglePathVectorNodes();
    const pathNode = nodes[1];
    const nextContours = [
      {
        closed: pathNode.closed,
        segments: pathNode.segments.map((segment, segmentIndex) => {
          if (segmentIndex !== 0) {
            return segment;
          }

          return {
            ...segment,
            point: {
              x: segment.point.x - 40,
              y: segment.point.y - 20,
            },
          };
        }),
      },
    ];

    editor.getState().loadNodes([...nodes]);

    expect(editor.updateEditablePath("vector-path", nextContours)).toBe(true);
    expect(editor.getNode("vector-path")).toMatchObject({
      closed: nextContours[0]?.closed,
      segments: nextContours[0]?.segments,
    });
  });

  test("vector child paths advertise the vector path editing overlay mode", () => {
    const editor = createEditor();
    const nodes = createSinglePathVectorNodes();

    editor.getState().loadNodes([...nodes]);

    expect(editor.getNodeEditCapabilities("vector-path")).toMatchObject({
      canEditPath: true,
      pathEditingOverlayMode: "replace-transform",
      requiresPathEditing: true,
    });
  });

  test("stopPathEditing clears transient path interaction state", () => {
    const editor = createEditor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);
    mockCircleGuideGeometry(editor, node);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
    ]);
    editor.beginTextPathPositioningInteraction();

    editor.stopPathEditing();

    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.isHoveringSuppressed).toBe(false);
    expect(editor.isTextPathPositioning).toBe(false);
    expect(editor.hoveredNodeId).toBeNull();
    expect(editor.pathEditingPoints).toEqual([]);
  });

  test("stopping vector path editing restores parent vector selection", () => {
    const editor = createEditor();
    const nodes = createSinglePathVectorNodes();

    editor.getState().loadNodes([...nodes]);
    editor.select("vector-container");
    editor.startPathEditing("vector-container");

    editor.stopPathEditing();

    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.selectedNodeIds).toEqual(["vector-container"]);
  });

  test("canvas shortcut toggles vector path editing with E", () => {
    const editor = createEditor();
    const nodes = createSinglePathVectorNodes();
    let prevented = false;

    editor.getState().loadNodes([...nodes]);
    editor.select("vector-container");

    expect(
      editor.handleCanvasShortcutKeyDown(
        {
          altKey: false,
          code: "KeyE",
          ctrlKey: false,
          metaKey: false,
          preventDefault: () => {
            prevented = true;
          },
        },
        "e"
      )
    ).toBe(true);
    expect(prevented).toBe(true);
    expect(editor.pathEditingNodeId).toBe("vector-path");
    expect(editor.selectedNodeIds).toEqual(["vector-path"]);

    prevented = false;

    expect(
      editor.handleCanvasShortcutKeyDown(
        {
          altKey: false,
          code: "KeyE",
          ctrlKey: false,
          metaKey: false,
          preventDefault: () => {
            prevented = true;
          },
        },
        "e"
      )
    ).toBe(true);
    expect(prevented).toBe(true);
    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.selectedNodeIds).toEqual(["vector-container"]);
  });

  test("groups do not advertise vector-style path editing affordances", () => {
    const editor = createEditor();
    const firstNode = {
      ...createVectorNode(),
      id: "vector-node-a",
      transform: {
        ...createVectorNode().transform,
        x: 200,
      },
    };
    const secondNode = {
      ...createVectorNode(),
      id: "vector-node-b",
      transform: {
        ...createVectorNode().transform,
        x: 400,
      },
    };

    editor.getState().loadNodes([firstNode, secondNode]);
    editor.setSelectedNodes([firstNode.id, secondNode.id]);
    editor.groupSelected();

    const groupNodeId = editor.selectedNodeId;

    if (!groupNodeId) {
      throw new Error("Expected grouped selection to produce a selected group");
    }

    expect(editor.getNode(groupNodeId)?.type).toBe("group");
    expect(editor.getNodeEditCapabilities(groupNodeId)).toMatchObject({
      canEditPath: false,
      pathEditingOverlayMode: "keep-transform",
      requiresPathEditing: false,
    });
    expect(editor.canStartPathEditing(groupNodeId)).toBe(false);
  });

  test("startEditing clears path editing and transient interaction state", () => {
    const editor = createEditor();
    const node = createPlainTextNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.getState().setPathEditingNodeId(node.id);
    editor.beginSelectionRotationInteraction();
    editor.setHoveredNode(node.id);

    editor.startEditing(node);

    expect(editor.editingNodeId).toBe(node.id);
    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.hoveredNodeId).toBeNull();
    expect(editor.isHoveringSuppressed).toBe(true);
    expect(editor.isSelectionDragging).toBe(false);
    expect(editor.isSelectionRotating).toBe(false);
    expect(editor.isTextPathPositioning).toBe(false);
  });

  test("startPathEditing is unavailable for inline arch warp controls", () => {
    const editor = createEditor();
    const node = createArchNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    expect(editor.canEditNodePath(node.id)).toBe(true);
    expect(editor.canStartPathEditing(node.id)).toBe(false);
    expect(editor.startPathEditing(node.id)).toBe(false);
    expect(editor.pathEditingNodeId).toBeNull();
  });

  test("startPathEditing is unavailable for inline wave warp controls", () => {
    const editor = createEditor();
    const node = createWaveNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    expect(editor.canEditNodePath(node.id)).toBe(true);
    expect(editor.canStartPathEditing(node.id)).toBe(false);
    expect(editor.startPathEditing(node.id)).toBe(false);
    expect(editor.pathEditingNodeId).toBeNull();
  });

  test("startPathEditing is unavailable for inline slant warp controls", () => {
    const editor = createEditor();
    const node = createSlantNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    expect(editor.canEditNodePath(node.id)).toBe(true);
    expect(editor.canStartPathEditing(node.id)).toBe(false);
    expect(editor.startPathEditing(node.id)).toBe(false);
    expect(editor.pathEditingNodeId).toBeNull();
  });

  test("clearing a circle warp exits path editing", () => {
    const editor = createEditor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    expect(editor.startPathEditing(node.id)).toBe(true);
    expect(editor.isPathEditing(node.id)).toBe(true);

    editor.updateSelectedNode({
      warp: {
        kind: "none",
      },
    });

    expect(editor.isPathEditing(node.id)).toBe(false);
    expect(editor.pathEditingNodeId).toBeNull();
  });
});
