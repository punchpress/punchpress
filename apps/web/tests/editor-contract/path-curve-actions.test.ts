import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { confirmMergeCurves } from "../../src/components/editor/merge-curves-command";

const segment = (x: number, y: number) => ({
  handleIn: { x: 0, y: 0 },
  handleOut: { x: 0, y: 0 },
  point: { x, y },
  pointType: "corner" as const,
});

const createPathNode = ({
  contours,
  id,
  opacity = 1,
  stroke = "#000000",
  x = 0,
}: {
  contours: Array<{
    closed: boolean;
    segments: ReturnType<typeof segment>[];
  }>;
  id: string;
  opacity?: number;
  stroke?: string;
  x?: number;
}) => ({
  contours,
  fill: null,
  fillRule: "nonzero" as const,
  id,
  opacity,
  parentId: "root",
  stroke,
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
  test("opacity differences require the mixed-style confirmation", () => {
    const editor = new Editor();
    editor.getState().loadNodes([
      createPathNode({
        contours: [
          { closed: false, segments: [segment(0, 0), segment(20, 0)] },
        ],
        id: "opaque",
      }),
      createPathNode({
        contours: [
          { closed: false, segments: [segment(40, 0), segment(60, 0)] },
        ],
        id: "faded",
        opacity: 0.3,
      }),
    ]);
    editor.setSelectedNodes(["opaque", "faded"]);

    expect(editor.hasMixedCurveStyles()).toBe(true);
  });

  test("a pending merge cannot run in another editor with matching node IDs", () => {
    const first = new Editor();
    const second = new Editor();
    const nodes = [
      createPathNode({
        contours: [
          { closed: false, segments: [segment(0, 0), segment(20, 0)] },
        ],
        id: "red",
        stroke: "#ff0000",
      }),
      createPathNode({
        contours: [
          { closed: false, segments: [segment(40, 0), segment(60, 0)] },
        ],
        id: "blue",
        stroke: "#0000ff",
      }),
    ];
    first.getState().loadNodes(nodes);
    second.getState().loadNodes(nodes);
    const pending = { editor: first, nodeIds: ["red", "blue"] };

    expect(confirmMergeCurves(second, pending)).toBe(false);
    expect(second.nodes).toHaveLength(2);
    expect(first.nodes).toHaveLength(2);
    expect(confirmMergeCurves(first, pending)).toBe(true);
    expect(first.nodes).toHaveLength(1);
    expect(second.nodes).toHaveLength(2);
  });

  test("mixed styles are disclosed before merging, and merge remains one style through Separate", () => {
    const editor = new Editor();
    editor.getState().loadNodes([
      createPathNode({
        contours: [
          { closed: false, segments: [segment(0, 0), segment(20, 0)] },
        ],
        id: "red",
        stroke: "#ff0000",
      }),
      createPathNode({
        contours: [
          { closed: false, segments: [segment(0, 0), segment(20, 0)] },
        ],
        id: "blue",
        stroke: "#0000ff",
        x: 40,
      }),
    ]);
    editor.setSelectedNodes(["red", "blue"]);

    expect(editor.hasMixedCurveStyles()).toBe(true);
    expect(editor.nodes.map((node) => node.stroke)).toEqual([
      "#ff0000",
      "#0000ff",
    ]);

    expect(editor.mergeCurves()).toBe(true);
    expect(editor.nodes.map((node) => node.stroke)).toEqual(["#ff0000"]);

    expect(editor.separateCurves()).toBe(true);
    expect(editor.nodes.map((node) => node.stroke)).toEqual([
      "#ff0000",
      "#ff0000",
    ]);

    editor.undo();
    editor.undo();
    expect(editor.nodes.map((node) => node.stroke)).toEqual([
      "#ff0000",
      "#0000ff",
    ]);
  });

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

    expect(editor.hasMixedCurveStyles()).toBe(false);
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
