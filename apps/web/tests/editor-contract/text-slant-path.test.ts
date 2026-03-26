import { describe, expect, test } from "bun:test";
import { Editor, getNodeWorldPoint } from "@punchpress/engine";

const FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

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
      x: 500,
      y: 600,
    },
    type: "text",
    visible: true,
    warp: {
      kind: "slant",
      rise: -120,
    },
  } as const;
};

const getBoundsCenter = (bounds) => {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
};

describe("Editor text slant path sessions", () => {
  test("exposes an editable slant guide", () => {
    const editor = new Editor();
    const node = createSlantNode();

    editor.getState().loadNodes([node]);

    const guide = editor.getNodeGeometry(node.id)?.guide;

    expect(guide?.kind).toBe("slant");
    expect(editor.canEditNodePath(node.id)).toBe(true);
    expect(guide?.handles.some((handle) => handle.role === "slant")).toBe(true);
  });

  test("adjusts slant while keeping the render center pinned", () => {
    const editor = new Editor();
    const node = createSlantNode();

    editor.getState().loadNodes([node]);

    const beforeNode = editor.getNode(node.id);
    const beforeGeometry = editor.getNodeGeometry(node.id);
    const slantHandle = beforeGeometry?.guide?.handles.find(
      (handle) => handle.role === "slant"
    );

    expect(beforeNode).not.toBeNull();
    expect(beforeGeometry?.bbox).toBeDefined();
    expect(slantHandle).toBeDefined();

    if (!(beforeNode && beforeGeometry?.bbox && slantHandle)) {
      return;
    }

    const beforeCenter = getNodeWorldPoint(
      beforeNode,
      beforeGeometry.bbox,
      getBoundsCenter(beforeGeometry.bbox)
    );
    const startPoint = getNodeWorldPoint(
      beforeNode,
      beforeGeometry.bbox,
      slantHandle.point
    );
    const session = editor.beginTextPathEdit({
      mode: "slant",
      nodeId: node.id,
      pointerCanvas: startPoint,
    });

    expect(session).not.toBeNull();

    editor.updateTextPathEdit(session, {
      pointerCanvas: {
        x: startPoint.x,
        y: startPoint.y - 80,
      },
    });

    const afterNode = editor.getNode(node.id);
    const afterGeometry = editor.getNodeGeometry(node.id);

    expect(afterNode?.warp.kind).toBe("slant");
    expect(afterGeometry?.bbox).toBeDefined();

    if (!(afterNode?.warp.kind === "slant" && afterGeometry?.bbox)) {
      return;
    }

    const afterCenter = getNodeWorldPoint(
      afterNode,
      afterGeometry.bbox,
      getBoundsCenter(afterGeometry.bbox)
    );

    expect(afterNode.warp.rise).toBeLessThan(node.warp.rise);
    expect(afterCenter.x).toBeCloseTo(beforeCenter.x, 2);
    expect(afterCenter.y).toBeCloseTo(beforeCenter.y, 2);
  });
});
