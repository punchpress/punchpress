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

  test("stopPathEditing clears transient path interaction state", () => {
    const editor = createEditor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);
    mockCircleGuideGeometry(editor, node);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.beginTextPathPositioningInteraction();

    editor.stopPathEditing();

    expect(editor.pathEditingNodeId).toBeNull();
    expect(editor.isHoveringSuppressed).toBe(false);
    expect(editor.isTextPathPositioning).toBe(false);
    expect(editor.hoveredNodeId).toBeNull();
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
});
