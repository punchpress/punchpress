import { describe, expect, test } from "bun:test";
import { ARCH_BEND_LIMIT, Editor, getNodeWorldPoint } from "@punchpress/engine";

const FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;
const GUIDE_PATH_START_REGEX = /^M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/;

const createArchNode = () => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize: 120,
    id: "arch-node",
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
      bend: 0.4,
      kind: "arch",
    },
  } as const;
};

const getBoundsCenter = (bounds) => {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
};

const getGuidePathStart = (pathD: string) => {
  const match = pathD.match(GUIDE_PATH_START_REGEX);

  if (!match) {
    return null;
  }

  return {
    x: Number.parseFloat(match[1] || "0"),
    y: Number.parseFloat(match[2] || "0"),
  };
};

describe("Editor text arch path sessions", () => {
  test("exposes an editable arch guide", () => {
    const editor = new Editor();
    const node = createArchNode();

    editor.getState().loadNodes([node]);

    const guide = editor.getNodeGeometry(node.id)?.guide;

    expect(guide?.kind).toBe("arch");
    expect(editor.canEditNodePath(node.id)).toBe(true);
    expect(guide?.handles.some((handle) => handle.role === "bend")).toBe(true);

    const bbox = editor.getNodeGeometry(node.id)?.bbox;
    const guideStart = guide?.pathD ? getGuidePathStart(guide.pathD) : null;

    expect(bbox).toBeDefined();
    expect(guideStart).not.toBeNull();

    if (!(bbox && guideStart)) {
      return;
    }

    expect(guideStart.x).toBeCloseTo(bbox.minX, 2);
    expect(guideStart.y).toBeCloseTo(getBoundsCenter(bbox).y, 2);
  });

  test("adjusts arch bend while keeping the render center pinned", () => {
    const editor = new Editor();
    const node = createArchNode();

    editor.getState().loadNodes([node]);

    const beforeNode = editor.getNode(node.id);
    const beforeGeometry = editor.getNodeGeometry(node.id);
    const bendHandle = beforeGeometry?.guide?.handles.find(
      (handle) => handle.role === "bend"
    );

    expect(beforeNode).not.toBeNull();
    expect(beforeGeometry?.bbox).toBeDefined();
    expect(bendHandle).toBeDefined();

    if (!(beforeNode && beforeGeometry?.bbox && bendHandle)) {
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
      bendHandle.point
    );
    const session = editor.beginTextPathEdit({
      mode: "bend",
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

    expect(afterNode?.warp.kind).toBe("arch");
    expect(afterGeometry?.bbox).toBeDefined();

    if (!(afterNode?.warp.kind === "arch" && afterGeometry?.bbox)) {
      return;
    }

    const afterCenter = getNodeWorldPoint(
      afterNode,
      afterGeometry.bbox,
      getBoundsCenter(afterGeometry.bbox)
    );

    expect(afterNode.warp.bend).toBeLessThan(node.warp.bend);
    expect(afterCenter.x).toBeCloseTo(beforeCenter.x, 2);
    expect(afterCenter.y).toBeCloseTo(beforeCenter.y, 2);
  });

  test("lets the bend handle reach the wider arch bend limit", () => {
    const editor = new Editor();
    const node = createArchNode();

    editor.getState().loadNodes([node]);

    const beforeNode = editor.getNode(node.id);
    const beforeGeometry = editor.getNodeGeometry(node.id);
    const bendHandle = beforeGeometry?.guide?.handles.find(
      (handle) => handle.role === "bend"
    );

    expect(beforeNode).not.toBeNull();
    expect(beforeGeometry?.bbox).toBeDefined();
    expect(bendHandle).toBeDefined();

    if (!(beforeNode && beforeGeometry?.bbox && bendHandle)) {
      return;
    }

    const startPoint = getNodeWorldPoint(
      beforeNode,
      beforeGeometry.bbox,
      bendHandle.point
    );
    const session = editor.beginTextPathEdit({
      mode: "bend",
      nodeId: node.id,
      pointerCanvas: startPoint,
    });

    expect(session).not.toBeNull();

    editor.updateTextPathEdit(session, {
      pointerCanvas: {
        x: startPoint.x,
        y: startPoint.y + 400,
      },
    });

    const afterNode = editor.getNode(node.id);

    expect(afterNode?.warp.kind).toBe("arch");

    if (afterNode?.warp.kind !== "arch") {
      return;
    }

    expect(afterNode.warp.bend).toBe(ARCH_BEND_LIMIT);
  });
});
