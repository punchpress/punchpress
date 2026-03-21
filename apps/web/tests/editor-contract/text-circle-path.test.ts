import { describe, expect, test } from "bun:test";
import { Editor, estimateBounds, getNodeWorldPoint } from "@punchpress/engine";

const FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

const createCircleNode = () => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize: 120,
    id: "circle-node",
    parentId: "root",
    stroke: null,
    strokeWidth: 0,
    text: "HEY",
    tracking: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 500,
      y: 600,
    },
    type: "text",
    visible: true,
    warp: {
      kind: "circle",
      pathPosition: 0,
      radius: 900,
      sweepDeg: 140,
    },
  } as const;
};

describe("Editor text circle path sessions", () => {
  test("slides text around the circle without changing the radius", () => {
    const editor = new Editor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);

    const bbox = estimateBounds(node);
    const startPoint = getNodeWorldPoint(node, bbox, { x: 0, y: 0 });
    const rightPoint = getNodeWorldPoint(node, bbox, { x: 900, y: 900 });
    const session = editor.beginTextPathEdit({
      mode: "position",
      nodeId: node.id,
      pointerCanvas: startPoint,
    });

    expect(session).not.toBeNull();

    editor.updateTextPathEdit(session, {
      pointerCanvas: rightPoint,
    });

    expect(editor.getNode(node.id)?.warp.pathPosition).toBeCloseTo(0.25, 2);
    expect(editor.getNode(node.id)?.warp.radius).toBe(900);
  });

  test("scales the circle radius with the regular resize flow", () => {
    const editor = new Editor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.5,
    });

    expect(editor.getNode(node.id)?.fontSize).toBeCloseTo(180, 2);
    expect(editor.getNode(node.id)?.warp.radius).toBeCloseTo(1350, 2);
  });

  test("only uses full path bounds while path editing is active", () => {
    const editor = new Editor();
    const node = createCircleNode();
    const bbox = estimateBounds(node);
    const selectionBounds = {
      height: bbox.height + 420,
      maxX: bbox.maxX + 160,
      maxY: bbox.maxY + 260,
      minX: bbox.minX - 160,
      minY: bbox.minY - 160,
      width: bbox.width + 320,
    };

    editor.getState().loadNodes([node]);
    editor.geometry.getById = () => ({
      bbox,
      guide: { kind: "circle" },
      paths: [],
      ready: true,
      selectionBounds,
    });
    editor.select(node.id);

    const defaultFrame = editor.getNodeFrame(node.id);

    expect(defaultFrame?.bounds.height).toBeCloseTo(bbox.height ?? 0, 2);
    expect(defaultFrame?.bounds.height).toBeLessThan(selectionBounds.height);

    editor.registerNodeTransformElement(node.id, {});

    const pathEditFrame = editor.getNodeFrame(node.id);

    expect(pathEditFrame?.bounds.height).toBeCloseTo(selectionBounds.height, 2);
  });
});
