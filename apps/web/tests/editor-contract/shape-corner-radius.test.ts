import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const createPolygonShapeNode = () => {
  return {
    cornerRadius: 24,
    fill: "#000000",
    height: 160,
    id: "shape-node",
    parentId: "root",
    shape: "polygon",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 600,
      y: 450,
    },
    type: "shape",
    visible: true,
    width: 260,
  } as const;
};

const createIrregularPolygonShapeNode = () => {
  return {
    cornerRadius: 0,
    fill: "#000000",
    height: 160,
    id: "irregular-shape-node",
    parentId: "root",
    points: [
      { x: -130, y: 0 },
      { x: -10, y: -110 },
      { x: 110, y: -90 },
      { x: 110, y: -20 },
      { x: 10, y: 120 },
    ],
    shape: "polygon",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 600,
      y: 450,
    },
    type: "shape",
    visible: true,
    width: 240,
  } as const;
};

const createStarShapeNode = () => {
  return {
    cornerRadius: 18,
    fill: "#000000",
    height: 200,
    id: "star-node",
    parentId: "root",
    shape: "star",
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 600,
      y: 450,
    },
    type: "shape",
    visible: true,
    width: 200,
  } as const;
};

describe("shape corner radius", () => {
  test("renders polygon corner radius from base polygon anchors", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    const geometry = editor.getNodeGeometry(node.id);

    expect(geometry?.paths[0]?.d).toContain("C");
    expect(geometry?.paths[0]?.d).not.toContain("A ");
  });

  test("path editing still exposes the unrounded polygon anchors", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const session = editor.getEditablePathSession(node.id);

    expect(session).toMatchObject({
      backend: "vector-path",
      contours: [
        {
          closed: true,
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -130, y: -80 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 130, y: -80 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 130, y: 80 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -130, y: 80 },
              pointType: "corner",
            },
          ],
        },
      ],
      interactionPolicy: {
        canInsertPoint: true,
      },
      nodeId: node.id,
      nodeType: "shape",
      selectedPoint: null,
      selectedPoints: [],
    });
    expect(session?.cornerCurveSegments?.map((segment) => segment.key)).toEqual(
      ["0:0", "0:1", "0:2", "0:3"]
    );
  });

  test("selected polygon path points can read and update only that corner radius", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode();

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
    ).toBe(24);
    expect(
      editor.setPathPointCornerRadius(36, node.id, editor.pathEditingPoint)
    ).toBe(true);
    expect(
      editor.getPathPointCornerRadius(node.id, editor.pathEditingPoint)
    ).toBe(36);

    const nextNode = editor.getNode(node.id);
    expect(nextNode?.type).toBe("shape");
    expect(nextNode?.type === "shape" ? nextNode.cornerRadius : null).toBe(24);
    expect(nextNode?.type === "shape" ? nextNode.cornerRadii : null).toEqual([
      36, 24, 24, 24,
    ]);
    expect(
      editor
        .getEditablePathSession(node.id)
        ?.cornerCurveSegments?.map((segment) => segment.key)
    ).toEqual(["0:0", "0:1", "0:2", "0:3"]);
    expect(
      editor.getEditablePathSession(node.id)?.cornerCurveSegments?.[0]
    ).toMatchObject({
      contourIndex: 0,
      endSegment: {
        handleOut: { x: 0, y: 0 },
        pointType: "corner",
      },
      key: "0:0",
      startSegment: {
        handleIn: { x: 0, y: 0 },
        pointType: "corner",
      },
    });
    expect(
      editor.getPathPointCornerRadius(node.id, {
        contourIndex: 0,
        segmentIndex: 1,
      })
    ).toBe(24);

    editor.clearPathEditingSelection();

    expect(editor.getPathCornerRadiusSummary(node.id)).toMatchObject({
      eligibleCount: 4,
      isMixed: true,
      value: null,
    });
  });

  test("polygon shapes expose a bulk path corner summary", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const summary = editor.getPathCornerRadiusSummary(node.id);

    expect(summary).toMatchObject({
      eligibleCount: 4,
      isMixed: false,
      value: 24,
    });
    expect(summary?.max).toBeCloseTo(80, 6);
  });

  test("irregular polygon bulk path corner summary reflects the shared shape radius", () => {
    const editor = new Editor();
    const node = createIrregularPolygonShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const initialSummary = editor.getPathCornerRadiusSummary(node.id);

    expect(initialSummary).toMatchObject({
      eligibleCount: 5,
      isMixed: false,
      value: 0,
    });
    expect(initialSummary?.max).toBeGreaterThan(0);

    expect(editor.setPathCornerRadius(999, node.id)).toBe(true);

    const nextSummary = editor.getPathCornerRadiusSummary(node.id);
    const nextNode = editor.getNode(node.id);

    expect(nextNode?.type).toBe("shape");
    expect(
      nextNode?.type === "shape" ? nextNode.cornerRadius : null
    ).toBeCloseTo(initialSummary?.max || 0, 6);
    expect(nextSummary).toMatchObject({
      eligibleCount: 5,
      isMixed: false,
      value: initialSummary?.max || 0,
    });
  });

  test("selected polygon path point updates clamp only that shape corner radius", () => {
    const editor = new Editor();
    const node = createIrregularPolygonShapeNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });

    const pointControl = editor.getPathPointCornerControl(
      node.id,
      editor.pathEditingPoint
    );

    expect(pointControl?.maxRadius).toBeGreaterThan(0);
    expect(
      editor.setPathPointCornerRadius(999, node.id, editor.pathEditingPoint)
    ).toBe(true);

    const nextNode = editor.getNode(node.id);
    const summary = editor.getPathCornerRadiusSummary(node.id);

    expect(nextNode?.type).toBe("shape");
    expect(nextNode?.type === "shape" ? nextNode.cornerRadius : null).toBe(0);
    expect(
      nextNode?.type === "shape" ? nextNode.cornerRadii?.[0] : null
    ).toBeCloseTo(pointControl?.maxRadius || 0, 6);
    expect(summary?.isMixed).toBe(false);
    expect(summary?.value).toBeCloseTo(pointControl?.maxRadius || 0, 6);

    editor.clearPathEditingSelection();

    const bulkSummary = editor.getPathCornerRadiusSummary(node.id);
    expect(bulkSummary?.isMixed).toBe(true);
    expect(bulkSummary?.value).toBeNull();
  });

  test("bulk polygon corner updates clear per-corner shape overrides", () => {
    const editor = new Editor();
    const node = createPolygonShapeNode();

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

    editor.clearPathEditingSelection();
    expect(editor.setPathCornerRadius(12, node.id)).toBe(true);

    const nextNode = editor.getNode(node.id);
    expect(nextNode?.type).toBe("shape");
    expect(nextNode?.type === "shape" ? nextNode.cornerRadius : null).toBe(12);
    expect(
      nextNode?.type === "shape" ? nextNode.cornerRadii : null
    ).toBeUndefined();
    expect(
      editor.getPathPointCornerRadius(node.id, {
        contourIndex: 0,
        segmentIndex: 0,
      })
    ).toBe(12);
    expect(
      editor.getPathPointCornerRadius(node.id, {
        contourIndex: 0,
        segmentIndex: 1,
      })
    ).toBe(12);
  });

  test("selected star path points can read and update only that corner radius", () => {
    const editor = new Editor();
    const node = createStarShapeNode();

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
    const initialSummary = editor.getPathCornerRadiusSummary(node.id);

    expect(
      editor.getPathPointCornerRadius(node.id, editor.pathEditingPoint)
    ).toBeCloseTo(initialSummary?.value || 0, 6);
    const pointControl = editor.getPathPointCornerControl(
      node.id,
      editor.pathEditingPoint
    );

    const initialGeometry = editor.getNodeGeometry(node.id);
    expect(initialGeometry?.paths[0]?.d).toContain("C");

    expect(
      editor.setPathPointCornerRadius(26, node.id, editor.pathEditingPoint)
    ).toBe(true);

    const nextNode = editor.getNode(node.id);
    const nextSummary = editor.getPathCornerRadiusSummary(node.id);
    const nextGeometry = editor.getNodeGeometry(node.id);

    expect(nextNode?.type).toBe("shape");
    expect(
      nextNode?.type === "shape" ? nextNode.cornerRadius : null
    ).toBeCloseTo(18, 6);
    expect(
      nextNode?.type === "shape" ? nextNode.cornerRadii?.[0] : null
    ).toBeCloseTo(nextSummary?.value || 0, 6);
    expect(nextSummary).toMatchObject({
      eligibleCount: 1,
      isMixed: false,
    });
    expect(nextSummary?.value).toBeCloseTo(pointControl?.maxRadius || 0, 6);
    expect(nextGeometry?.paths[0]?.d).toContain("C");
  });
});
