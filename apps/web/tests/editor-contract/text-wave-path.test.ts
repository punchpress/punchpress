import { describe, expect, test } from "bun:test";
import { Editor, getNodeWorldPoint } from "@punchpress/engine";

const FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;
const GUIDE_PATH_START_REGEX = /^M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/;

const createWaveNode = () => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize: 120,
    id: "wave-node",
    parentId: "root",
    stroke: null,
    strokeWidth: 0,
    text: "FLAG",
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
      amplitude: 180,
      cycles: 2,
      kind: "wave",
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

describe("Editor text wave path sessions", () => {
  test("exposes editable wave handles", () => {
    const editor = new Editor();
    const node = createWaveNode();

    editor.getState().loadNodes([node]);

    const guide = editor.getNodeGeometry(node.id)?.guide;

    expect(guide?.kind).toBe("wave");
    expect(editor.canEditNodePath(node.id)).toBe(true);
    expect(guide?.handles.some((handle) => handle.role === "amplitude")).toBe(
      true
    );
    expect(guide?.handles.some((handle) => handle.role === "cycles")).toBe(
      true
    );

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

  test("adjusts wave amplitude while keeping the render center pinned", () => {
    const editor = new Editor();
    const node = createWaveNode();

    editor.getState().loadNodes([node]);

    const beforeNode = editor.getNode(node.id);
    const beforeGeometry = editor.getNodeGeometry(node.id);
    const amplitudeHandle = beforeGeometry?.guide?.handles.find(
      (handle) => handle.role === "amplitude"
    );

    expect(beforeNode).not.toBeNull();
    expect(beforeGeometry?.bbox).toBeDefined();
    expect(amplitudeHandle).toBeDefined();

    if (!(beforeNode && beforeGeometry?.bbox && amplitudeHandle)) {
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
      amplitudeHandle.point
    );
    const session = editor.beginTextPathEdit({
      mode: "amplitude",
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

    expect(afterNode?.warp.kind).toBe("wave");
    expect(afterGeometry?.bbox).toBeDefined();

    if (!(afterNode?.warp.kind === "wave" && afterGeometry?.bbox)) {
      return;
    }

    const afterCenter = getNodeWorldPoint(
      afterNode,
      afterGeometry.bbox,
      getBoundsCenter(afterGeometry.bbox)
    );

    expect(afterNode.warp.amplitude).toBeGreaterThan(node.warp.amplitude);
    expect(afterCenter.x).toBeCloseTo(beforeCenter.x, 2);
    expect(afterCenter.y).toBeCloseTo(beforeCenter.y, 2);
  });

  test("adjusts wave cycles from the inline edge handle", () => {
    const editor = new Editor();
    const node = createWaveNode();

    editor.getState().loadNodes([node]);

    const beforeNode = editor.getNode(node.id);
    const beforeGeometry = editor.getNodeGeometry(node.id);
    const cyclesHandle = beforeGeometry?.guide?.handles.find(
      (handle) => handle.role === "cycles"
    );

    expect(beforeNode).not.toBeNull();
    expect(beforeGeometry?.bbox).toBeDefined();
    expect(cyclesHandle).toBeDefined();

    if (!(beforeNode && beforeGeometry?.bbox && cyclesHandle)) {
      return;
    }

    const startPoint = getNodeWorldPoint(
      beforeNode,
      beforeGeometry.bbox,
      cyclesHandle.point
    );
    const session = editor.beginTextPathEdit({
      mode: "cycles",
      nodeId: node.id,
      pointerCanvas: startPoint,
    });

    expect(session).not.toBeNull();

    editor.updateTextPathEdit(session, {
      pointerCanvas: {
        x: startPoint.x - 80,
        y: startPoint.y,
      },
    });

    const afterNode = editor.getNode(node.id);

    expect(afterNode?.warp.kind).toBe("wave");

    if (afterNode?.warp.kind !== "wave") {
      return;
    }

    expect(afterNode.warp.cycles).toBeGreaterThan(node.warp.cycles);
  });

  test("keeps inline warp interaction active during live updates", () => {
    const editor = new Editor();
    const node = createWaveNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    const geometry = editor.getNodeGeometry(node.id);
    const cyclesHandle = geometry?.guide?.handles.find(
      (handle) => handle.role === "cycles"
    );

    expect(geometry?.bbox).toBeDefined();
    expect(cyclesHandle).toBeDefined();

    if (!(geometry?.bbox && cyclesHandle)) {
      return;
    }

    const startPoint = getNodeWorldPoint(
      node,
      geometry.bbox,
      cyclesHandle.point
    );
    const session = editor.beginTextPathEdit({
      mode: "cycles",
      nodeId: node.id,
      pointerCanvas: startPoint,
    });

    expect(session).not.toBeNull();

    editor.beginTextPathPositioningInteraction();

    expect(editor.isTextPathPositioning).toBe(true);

    editor.updateTextPathEdit(session, {
      pointerCanvas: {
        x: startPoint.x - 20,
        y: startPoint.y,
      },
    });

    expect(editor.isTextPathPositioning).toBe(true);
  });
});
