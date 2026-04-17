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

const createImportedRoundedCornerVectorNode = () => {
  const handleLength = 13.254_833_995_939_045;

  return {
    contours: [
      {
        closed: true,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: -handleLength },
            point: { x: -120, y: -66 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: -handleLength, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -96, y: -90 },
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
    id: "imported-rounded-corner-vector-node",
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

const createIrregularPolygonVectorNode = () => {
  return {
    contours: [
      {
        closed: true,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -50, y: -10 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 10, y: -45 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 95, y: -5 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 75, y: 70 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -20, y: 85 },
            pointType: "corner" as const,
          },
        ],
      },
    ],
    fill: "#ffffff",
    fillRule: "nonzero",
    id: "irregular-polygon-vector-node",
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

    expect(editor.canRoundPathPoint(node.id, editor.pathEditingPoint)).toBe(
      true
    );
    expect(
      editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint)
    ).toBe(true);
    expect(
      editor.getPathPointCornerRadius(node.id, editor.pathEditingPoint)
    ).toBeCloseTo(24, 6);
    const nextNode = editor.getNode(node.id);

    expect(nextNode?.type).toBe("vector");
    expect(
      nextNode?.type === "vector" ? nextNode.contours[0]?.segments : null
    ).toHaveLength(5);
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.point
        : null
    ).toEqual({ x: -120, y: -66 });
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[1]?.point
        : null
    ).toEqual({ x: -96, y: -90 });
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.pointType
        : null
    ).toBe("corner");
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[1]?.pointType
        : null
    ).toBe("corner");
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

    expect(editor.canRoundPathPoint(node.id, editor.pathEditingPoint)).toBe(
      false
    );
    expect(
      editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint)
    ).toBe(false);
  });

  test("detects an imported rounded corner from either trim point", () => {
    const editor = new Editor();
    const node = createImportedRoundedCornerVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    expect(editor.canRoundPathPoint(node.id, editor.pathEditingPoint)).toBe(
      true
    );
    expect(
      editor.getPathPointCornerRadius(node.id, editor.pathEditingPoint)
    ).toBeCloseTo(24, 3);

    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    expect(editor.canRoundPathPoint(node.id, editor.pathEditingPoint)).toBe(
      true
    );
    expect(
      editor.getPathPointCornerRadius(node.id, editor.pathEditingPoint)
    ).toBeCloseTo(24, 3);
  });

  test("editing an imported rounded corner updates both trim points", () => {
    const editor = new Editor();
    const node = createImportedRoundedCornerVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    expect(
      editor.setPathPointCornerRadius(36, node.id, editor.pathEditingPoint)
    ).toBe(true);

    const nextNode = editor.getNode(node.id);

    expect(nextNode?.type).toBe("vector");
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.point.x
        : null
    ).toBe(-120);
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.point.y
        : null
    ).toBeCloseTo(-54, 6);
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[1]?.point
        : null
    ).toEqual({ x: -84, y: -90 });
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.pointType
        : null
    ).toBe("corner");
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[1]?.pointType
        : null
    ).toBe("corner");
  });

  test("reducing an imported rounded corner to zero collapses it back to one sharp corner point", () => {
    const editor = new Editor();
    const node = createImportedRoundedCornerVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 1,
    });

    expect(
      editor.setPathPointCornerRadius(0, node.id, editor.pathEditingPoint)
    ).toBe(true);

    const nextNode = editor.getNode(node.id);

    expect(nextNode?.type).toBe("vector");
    expect(
      nextNode?.type === "vector" ? nextNode.contours[0]?.segments : null
    ).toHaveLength(4);
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.point
        : null
    ).toEqual({ x: -120, y: -90 });
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.handleIn
        : null
    ).toEqual({ x: 0, y: 0 });
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.handleOut
        : null
    ).toEqual({ x: 0, y: 0 });
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments[0]?.pointType
        : null
    ).toBe("corner");
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
    expect(editor.getNodeRenderGeometry(openNode.id)?.paths[0]).toMatchObject({
      closed: false,
    });
    expect(
      editor.getNodeRenderGeometry(openNode.id)?.paths[0]?.d
    ).not.toContain("Z");
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
    expect(
      editor.setPathPointCornerRadius(12, node.id, editor.pathEditingPoint)
    ).toBe(true);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 3,
    });
    expect(
      editor.setPathPointCornerRadius(30, node.id, editor.pathEditingPoint)
    ).toBe(true);
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
    });
    expect(summary?.value).toBeCloseTo(18, 6);
    expect(summary?.max || 0).toBeGreaterThan(summary?.value || 0);

    const nextNode = editor.getNode(node.id);
    expect(nextNode?.type).toBe("vector");
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments.map((segment) => {
            return Object.hasOwn(segment, "cornerRadius");
          })
        : null
    ).toEqual([false, false, false, false, false, false, false, false]);
  });

  test("bulk path corner radius clamps to the stable maximum when increasing an existing uniform round", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    expect(editor.setPathCornerRadius(40, node.id)).toBe(true);
    expect(editor.setPathCornerRadius(80, node.id)).toBe(true);

    const summary = editor.getPathCornerRadiusSummary(node.id);

    expect(summary).toMatchObject({
      eligibleCount: 4,
      isMixed: false,
    });
    expect(summary?.value).toBeCloseTo(70, 6);

    const nextNode = editor.getNode(node.id);

    expect(nextNode?.type).toBe("vector");
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments.filter((_, segmentIndex) => {
            return editor.canRoundPathPoint(node.id, {
              contourIndex: 0,
              segmentIndex,
            });
          }).length
        : null
    ).toBe(8);
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
      segmentIndex: 3,
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
        segmentIndex: 2,
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

    expect(
      editor.getPathPointCornerRadius(node.id, editor.pathEditingPoint)
    ).toBe(0);

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
      nextNode?.type === "vector" ? nextNode.contours[0]?.segments : null
    ).toHaveLength(6);
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments.some((segment) => {
            return Object.hasOwn(segment, "cornerRadius");
          })
        : null
    ).toBe(false);
  });

  test("bulk path corner radius clamps before an irregular closed polygon loses live-corner editability", () => {
    const editor = new Editor();
    const node = createIrregularPolygonVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    for (const radius of [
      5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70,
    ]) {
      expect(editor.setPathCornerRadius(radius, node.id)).toBe(true);
    }

    const summary = editor.getPathCornerRadiusSummary(node.id);

    expect(summary).toMatchObject({
      eligibleCount: 5,
    });

    const nextNode = editor.getNode(node.id);

    expect(nextNode?.type).toBe("vector");
    expect(
      nextNode?.type === "vector"
        ? nextNode.contours[0]?.segments.filter((_, segmentIndex) => {
            return editor.canRoundPathPoint(node.id, {
              contourIndex: 0,
              segmentIndex,
            });
          }).length
        : null
    ).toBe(10);
  });

  test("bulk path corner radius summary stays uniform for an irregular vector after a bulk apply", () => {
    const editor = new Editor();
    const node = createIrregularPolygonVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    expect(editor.setPathCornerRadius(20, node.id)).toBe(true);

    const summary = editor.getPathCornerRadiusSummary(node.id);

    expect(summary).toMatchObject({
      eligibleCount: 5,
      isMixed: false,
    });
    expect(summary?.value).toBeCloseTo(20, 6);
  });
});
