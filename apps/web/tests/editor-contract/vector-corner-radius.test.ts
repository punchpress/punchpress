import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createRectangleVectorNode = () => {
  return {
    contours: [
      {
        closed: true,
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
      x: 320,
      y: 220,
    },
    type: "vector",
    visible: true,
  } as const;
};

describe("vector corner radius", () => {
  test("sets live corner radius on eligible vector points and rounds the rendered path", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    expect(editor.canRoundPathPoint(node.id, editor.pathEditingPoint)).toBe(true);
    expect(editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint)).toBe(
      true
    );
    expect(editor.getPathPointCornerRadius(node.id, editor.pathEditingPoint)).toBe(
      24
    );
    const nextNode = editor.getNode(node.id);

    expect(nextNode?.type).toBe("vector");
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.cornerRadius
        : null
    ).toBe(24);
    expect(editor.getPathCornerRadiusSummary(node.id)?.max).toBeCloseTo(90, 6);
    expect(editor.getNodeGeometry(node.id)?.paths[0]?.d).toContain("C");
  });

  test("rejects live corner radius on smooth vector points", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointType("smooth", node.id, editor.pathEditingPoint);

    expect(editor.canRoundPathPoint(node.id, editor.pathEditingPoint)).toBe(false);
    expect(
      editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint)
    ).toBe(false);
  });

  test("rejects live corner radius on open-path endpoints", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();
    const openNode = {
      ...node,
      contours: [
        {
          ...node.contours[0],
          closed: false,
        },
      ],
      id: "open-vector-node",
    };

    editor.getState().loadNodes([openNode]);
    editor.select(openNode.id);
    editor.startPathEditing(openNode.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    expect(editor.canRoundPathPoint(openNode.id, editor.pathEditingPoint)).toBe(
      false
    );
    expect(
      editor.setPathPointCornerRadius(24, openNode.id, editor.pathEditingPoint)
    ).toBe(false);
  });

  test("summarizes all eligible vector corners when no point is selected", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const initialSummary = editor.getPathCornerRadiusSummary(node.id);

    expect(initialSummary).toMatchObject({
      eligibleCount: 4,
      isMixed: false,
      value: 0,
    });
    expect(initialSummary?.max).toBeCloseTo(90, 6);

    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    expect(editor.setPathPointCornerRadius(12, node.id, editor.pathEditingPoint)).toBe(
      true
    );
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 2,
    });
    expect(editor.setPathPointCornerRadius(30, node.id, editor.pathEditingPoint)).toBe(
      true
    );
    editor.setPathEditingPoint(null);

    const mixedSummary = editor.getPathCornerRadiusSummary(node.id);

    expect(mixedSummary).toMatchObject({
      eligibleCount: 4,
      isMixed: true,
      value: null,
    });
    expect(mixedSummary?.max).toBeCloseTo(90, 6);
  });

  test("bulk path corner radius applies to all eligible vector corners", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    expect(editor.setPathCornerRadius(18, node.id)).toBe(true);
    const summary = editor.getPathCornerRadiusSummary(node.id);

    expect(summary).toMatchObject({
      eligibleCount: 4,
      isMixed: false,
      value: 18,
    });
    expect(summary?.max).toBeCloseTo(90, 6);

    const nextNode = editor.getNode(node.id);
    expect(nextNode?.type).toBe("vector");
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments.map((segment) => segment.cornerRadius ?? 0)
        : null
    ).toEqual([18, 18, 18, 18]);
  });

  test("bulk path corner radius summarizes only the selected vector corners when multiple points are selected", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    expect(
      editor.setPathPointCornerRadius(12, node.id, editor.pathEditingPoint)
    ).toBe(true);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 2,
    });
    expect(
      editor.setPathPointCornerRadius(30, node.id, editor.pathEditingPoint)
    ).toBe(true);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);

    const summary = editor.getPathCornerRadiusSummary(node.id);

    expect(summary).toMatchObject({
      eligibleCount: 2,
      isMixed: true,
      value: null,
    });
    expect(summary?.max).toBeCloseTo(90, 6);
  });

  test("reports the geometric max for selected vector points", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    expect(editor.getPathPointCornerRadius(node.id, editor.pathEditingPoint)).toBe(0);

    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathEditingPoints(
      [
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
      ],
      {
        contourIndex: 0,
        segmentIndex: 0,
      }
    );

    expect(editor.getPathCornerRadiusSummary(node.id)?.max).toBeCloseTo(90, 6);
  });

  test("bulk path corner radius applies only to the selected vector corners when multiple points are selected", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
    ]);

    expect(editor.setPathCornerRadius(18, node.id)).toBe(true);

    const nextNode = editor.getNode(node.id);
    expect(nextNode?.type).toBe("vector");
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments.map((segment) => segment.cornerRadius ?? 0)
        : null
    ).toEqual([18, 18, 0, 0]);
  });
});
