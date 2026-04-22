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

const createPathNode = (id, x = 200, y = 160) => {
  return {
    closed: true,
    fill: "#ff0000",
    fillRule: "nonzero",
    id,
    parentId: "root",
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -60, y: -40 },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 60, y: -40 },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 60, y: 40 },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -60, y: 40 },
        pointType: "corner",
      },
    ],
    stroke: "#111111",
    strokeLineCap: "round",
    strokeLineJoin: "round",
    strokeMiterLimit: 4,
    strokeWidth: 3,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x,
      y,
    },
    type: "path",
    visible: true,
  } as const;
};

const createVectorContainerNode = (
  id: string,
  pathComposition:
    | "compound-fill"
    | "exclude"
    | "independent"
    | "intersect"
    | "subtract"
    | "unite" = "independent"
) => {
  return {
    id,
    name: id,
    parentId: "root",
    pathComposition,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    },
    type: "vector",
    visible: true,
  } as const;
};

const createCircleTextNode = () => {
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

const mockCircleGuideGeometry = (editor, node) => {
  const bbox = estimateBounds(node);
  const originalGetById = editor.geometry.getById.bind(editor.geometry);

  editor.geometry.getById = (nodes, fontRevision, nodeId) => {
    if (nodeId !== node.id) {
      return originalGetById(nodes, fontRevision, nodeId);
    }

    return {
      bbox,
      guide: { kind: "circle" },
      paths: [],
      ready: true,
      selectionBounds: null,
    };
  };
};

describe("canvas overlay state queries", () => {
  test("returns single-node transform overlay state for a selected path", () => {
    const editor = createEditor();

    editor.getState().loadNodes([createPathNode("path-1")]);
    editor.select("path-1");

    expect(editor.getCanvasTransformOverlayState()).toMatchObject({
      isDraggable: true,
      isResizable: true,
      isRotatable: true,
      mode: "single",
      selectedNodeId: "path-1",
    });
  });

  test("suppresses the transform overlay when path editing replaces transform chrome", () => {
    const editor = createEditor();

    editor.getState().loadNodes([createPathNode("path-1")]);
    editor.select("path-1");
    editor.startPathEditing("path-1");

    expect(editor.getCanvasTransformOverlayState()).toBeNull();
  });

  test("returns multi-node transform overlay state for a multi-selection", () => {
    const editor = createEditor();

    editor
      .getState()
      .loadNodes([
        createPathNode("path-1", 200, 160),
        createPathNode("path-2", 420, 200),
      ]);
    editor.setSelectedNodes(["path-1", "path-2"]);

    expect(editor.getCanvasTransformOverlayState()).toMatchObject({
      isDraggable: true,
      isResizable: true,
      isRotatable: true,
      mode: "multi",
      nodeIds: ["path-1", "path-2"],
    });
  });

  test("returns a selection ghost for a selected child path inside a subtract compound", () => {
    const editor = createEditor();

    editor.getState().loadNodes([
      createVectorContainerNode("vector-container", "subtract"),
      {
        ...createPathNode("path-back", 260, 260),
        parentId: "vector-container",
      },
      {
        ...createPathNode("path-front", 320, 260),
        parentId: "vector-container",
      },
    ]);
    editor.getState().selectNodes(["path-front"]);

    expect(editor.getCanvasTransformOverlayState()).toMatchObject({
      mode: "single",
      selectedNodeId: "path-front",
      selectionGhost: {
        bbox: expect.any(Object),
        nodeId: "path-front",
        paths: expect.any(Array),
      },
    });
    expect(
      editor.getCanvasTransformOverlayState()?.selectionGhost?.paths.length
    ).toBeGreaterThan(0);
  });

  test("returns text path overlay state for a selected guided text node", () => {
    const editor = createEditor();
    const node = createCircleTextNode();

    editor.getState().loadNodes([node]);
    mockCircleGuideGeometry(editor, node);
    editor.select(node.id);

    const overlayState = editor.getTextPathOverlayState();

    expect(overlayState?.node.id).toBe("circle-node");
    expect(overlayState?.isPathEditing).toBe(false);
    expect(overlayState?.isSelectionRotating).toBe(false);
    expect(overlayState?.geometry.guide).toEqual({ kind: "circle" });
  });

  test("does not return text path overlay state for plain text without a guide", () => {
    const editor = createEditor();

    editor.getState().loadNodes([createPlainTextNode()]);
    editor.select("text-node");

    expect(editor.getTextPathOverlayState()).toBeNull();
  });

  test("returns vector path overlay state for an active path-edit session", () => {
    const editor = createEditor();

    editor.getState().loadNodes([createPathNode("path-1")]);
    editor.select("path-1");
    editor.startPathEditing("path-1");

    const overlayState = editor.getVectorPathOverlayState();

    expect(overlayState?.isPathEditing).toBe(true);
    expect(overlayState?.node.id).toBe("path-1");
    expect(overlayState?.editablePathSession.backend).toBe("vector-path");
    expect(overlayState?.geometry.bbox).toBeTruthy();
  });
});
