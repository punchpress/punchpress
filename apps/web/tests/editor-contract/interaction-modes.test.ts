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
    const node = createVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    expect(editor.canEditNodePath(node.id)).toBe(true);
    expect(editor.canStartPathEditing(node.id)).toBe(true);
    expect(editor.startPathEditing(node.id)).toBe(true);
    expect(editor.pathEditingNodeId).toBe(node.id);
  });

  test("vector nodes expose an editable path session for the vector path backend", () => {
    const editor = createEditor();
    const node = createVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
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

    expect(editor.getEditablePathSession(node.id)).toEqual({
      backend: "vector-path",
      contours: node.contours,
      interactionPolicy: {
        canInsertPoint: true,
      },
      nodeId: node.id,
      nodeType: "vector",
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
    const node = createVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    editor.updateNode(node.id, {
      transform: {
        x: node.transform.x + 40,
        y: node.transform.y + 20,
      },
    });

    expect(editor.pathEditingNodeId).toBe(node.id);
    expect(editor.isPathEditing(node.id)).toBe(true);
  });

  test("updateEditablePath updates vector node contours through the shared path interface", () => {
    const editor = createEditor();
    const node = createVectorNode();
    const nextContours = [
      {
        ...node.contours[0],
        segments: node.contours[0].segments.map((segment, segmentIndex) => {
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

    editor.getState().loadNodes([node]);

    expect(editor.updateEditablePath(node.id, nextContours)).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({
      contours: nextContours,
    });
  });

  test("vector path editing replaces the normal transform overlay", () => {
    const editor = createEditor();
    const node = createVectorNode();

    editor.getState().loadNodes([node]);

    expect(editor.getNodeEditCapabilities(node.id)).toMatchObject({
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

  test("canvas shortcut toggles vector path editing with E", () => {
    const editor = createEditor();
    const node = createVectorNode();
    let prevented = false;

    editor.getState().loadNodes([node]);
    editor.select(node.id);

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
    expect(editor.pathEditingNodeId).toBe(node.id);

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
