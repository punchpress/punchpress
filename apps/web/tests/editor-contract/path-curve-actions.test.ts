import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const segment = (x: number, y: number) => ({
  handleIn: { x: 0, y: 0 },
  handleOut: { x: 0, y: 0 },
  point: { x, y },
  pointType: "corner" as const,
});

const createPathNode = ({
  contours,
  id,
  x = 0,
}: {
  contours: Array<{
    closed: boolean;
    segments: ReturnType<typeof segment>[];
  }>;
  id: string;
  x?: number;
}) => ({
  contours,
  fill: null,
  fillRule: "nonzero" as const,
  id,
  parentId: "root",
  stroke: "#000000",
  strokeLineCap: "butt" as const,
  strokeLineJoin: "miter" as const,
  strokeMiterLimit: 4,
  strokeWidth: 2,
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x,
    y: 0,
  },
  type: "path" as const,
  visible: true,
});

describe("path curve actions", () => {
  test("merge curves combines selected path nodes as one multi-contour path", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      createPathNode({
        contours: [
          { closed: false, segments: [segment(0, 0), segment(20, 0)] },
        ],
        id: "left",
      }),
      createPathNode({
        contours: [
          { closed: false, segments: [segment(0, 0), segment(20, 0)] },
        ],
        id: "right",
        x: 40,
      }),
    ]);
    editor.setSelectedNodes(["left", "right"]);

    expect(editor.mergeCurves()).toBe(true);

    const mergedPath = editor.getNode("left");

    expect(editor.nodes.map((node) => node.id)).toEqual(["left"]);
    expect(editor.selectedNodeIds).toEqual(["left"]);
    expect(mergedPath?.type).toBe("path");
    expect(mergedPath?.contours).toHaveLength(2);
    expect(mergedPath?.contours[1]?.segments[0]?.point.x).toBe(40);
  });

  test("separate curves splits a multi-contour path into path nodes", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      createPathNode({
        contours: [
          { closed: false, segments: [segment(0, 0), segment(20, 0)] },
          { closed: false, segments: [segment(40, 0), segment(60, 0)] },
        ],
        id: "path",
      }),
    ]);
    editor.setSelectedNodes(["path"]);

    expect(editor.separateCurves()).toBe(true);

    expect(editor.nodes).toHaveLength(2);
    expect(editor.nodes.map((node) => node.type)).toEqual(["path", "path"]);
    expect(editor.nodes.map((node) => node.contours.length)).toEqual([1, 1]);
    expect(editor.selectedNodeIds).toHaveLength(2);
  });

  test("join curves connects the nearest endpoints of two selected open paths", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      createPathNode({
        contours: [
          { closed: false, segments: [segment(0, 0), segment(20, 0)] },
        ],
        id: "left",
      }),
      createPathNode({
        contours: [
          { closed: false, segments: [segment(40, 0), segment(60, 0)] },
        ],
        id: "right",
      }),
    ]);
    editor.setSelectedNodes(["left", "right"]);

    expect(editor.joinCurves()).toBe(true);

    const joinedPath = editor.getNode("left");

    expect(editor.nodes.map((node) => node.id)).toEqual(["left"]);
    expect(joinedPath?.contours).toHaveLength(1);
    expect(joinedPath?.contours[0]?.closed).toBe(false);
    expect(
      joinedPath?.contours[0]?.segments.map((entry) => entry.point.x)
    ).toEqual([0, 20, 40, 60]);
  });

  test("close curve closes the active open contour", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      createPathNode({
        contours: [
          { closed: false, segments: [segment(0, 0), segment(20, 0)] },
        ],
        id: "path",
      }),
    ]);
    editor.select("path");
    editor.startPathEditing("path");
    editor.setPathEditingPoint({ contourIndex: 0, segmentIndex: 1 });

    expect(editor.closePathContour()).toBe(true);
    expect(editor.getNode("path")?.contours[0]?.closed).toBe(true);
    expect(editor.pathEditingPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });
  });
});
