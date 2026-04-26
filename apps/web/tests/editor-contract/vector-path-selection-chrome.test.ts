import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { getVectorCornerWidgetGeometry } from "../../src/components/canvas/canvas-overlay/vector-path/corner-widget-geometry";
import { getVectorCornerDragIdentity } from "../../src/components/canvas/canvas-overlay/vector-path/vector-corner-drag-session";
import { VectorCornerRadiusHandles } from "../../src/components/canvas/canvas-overlay/vector-path/vector-corner-radius-handle";
import {
  getHoveredVectorCornerCurveSegment,
  getMaxedVectorCornerCurveSegments,
  getVisibleVectorCornerHandles,
  shouldAdjustSelectedCornerPoints,
} from "../../src/components/canvas/canvas-overlay/vector-path/vector-corner-radius-points";
import {
  shouldShowBezierHandlesForPoint,
  shouldShowSelectedAnchorForPoint,
} from "../../src/components/canvas/canvas-overlay/vector-path/vector-path-selection-chrome";

const createRectangleVectorNode = () => {
  return {
    closed: true,
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "vector-node",
    parentId: "root",
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
    stroke: "#000000",
    strokeWidth: 12,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "path" as const,
    visible: true,
  };
};

const TEST_MATRIX = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

const getActiveDragSession = (contours, point, overrides = {}) => {
  const identity = getVectorCornerDragIdentity(contours, point);
  const displayGeometry = getVectorCornerWidgetGeometry({
    contours,
    matrix: TEST_MATRIX,
    point,
  });

  if (!(identity && displayGeometry)) {
    return null;
  }

  return {
    displayGeometry,
    displayRadius: displayGeometry.currentRadius,
    identity,
    isAtMax: false,
    maxRadius: displayGeometry.maxRadius,
    ...overrides,
  };
};

const getEditableContours = (node) => {
  if (!node) {
    return [];
  }

  if (node.type === "path") {
    return [
      {
        closed: node.closed,
        segments: node.segments,
      },
    ];
  }

  return node.type === "vector" ? node.contours || [] : [];
};

const createIrregularPolygonVectorNode = () => {
  return {
    closed: true,
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "irregular-vector-node",
    parentId: "root",
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
    stroke: "#000000",
    strokeWidth: 12,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "path" as const,
    visible: true,
  };
};

const createDiamondVectorNode = () => {
  return {
    closed: true,
    fill: "#ffffff",
    fillRule: "nonzero" as const,
    id: "diamond-vector-node",
    parentId: "root",
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 0, y: -120 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -90, y: 0 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 0, y: 120 },
        pointType: "corner" as const,
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: 90, y: 0 },
        pointType: "corner" as const,
      },
    ],
    stroke: "#000000",
    strokeWidth: 12,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 320,
      y: 220,
    },
    type: "path" as const,
    visible: true,
  };
};

describe("vector path selection chrome", () => {
  test("shows corner radius handles for all eligible live corners in path edit mode", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    expect(getVisibleVectorCornerHandles(getEditableContours(node))).toEqual({
      dragScope: "all",
      points: [
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
        {
          contourIndex: 0,
          segmentIndex: 1,
        },
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
        {
          contourIndex: 0,
          segmentIndex: 3,
        },
      ],
    });
  });

  test("shows only the selected logical corner handles when path points are selected", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint);
    editor.setPathEditingPoints([
      {
        contourIndex: 0,
        segmentIndex: 0,
      },
      {
        contourIndex: 0,
        segmentIndex: 1,
      },
      {
        contourIndex: 0,
        segmentIndex: 3,
      },
    ]);

    expect(
      getVisibleVectorCornerHandles(
        getEditableContours(editor.getNode(node.id)),
        editor.pathEditingPoints
      )
    ).toEqual({
      dragScope: "selected",
      points: [
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
        {
          contourIndex: 0,
          segmentIndex: 3,
        },
      ],
    });
  });

  test("shows only the active corner handle while a corner-radius drag is in progress", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const activeDragSession = getActiveDragSession(getEditableContours(node), {
      contourIndex: 0,
      segmentIndex: 2,
    });

    expect(
      getVisibleVectorCornerHandles(
        getEditableContours(node),
        [],
        activeDragSession
      )
    ).toEqual({
      dragScope: "active",
      points: [
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
      ],
    });
  });

  test("keeps the active corner handle pinned to the same logical corner across topology changes", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const activeDragSession = getActiveDragSession(getEditableContours(node), {
      contourIndex: 0,
      segmentIndex: 0,
    });

    expect(activeDragSession?.identity.anchor).toEqual({ x: -120, y: -90 });

    expect(
      editor.setPathPointCornerRadius(24, node.id, {
        contourIndex: 0,
        segmentIndex: 0,
      })
    ).toBe(true);

    let nextContours = getEditableContours(editor.getNode(node.id));

    expect(
      getVisibleVectorCornerHandles(nextContours, [], activeDragSession)
    ).toEqual({
      dragScope: "active",
      points: [
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
      ],
    });

    expect(
      editor.setPathPointCornerRadius(0, node.id, {
        contourIndex: 0,
        segmentIndex: 0,
      })
    ).toBe(true);

    nextContours = getEditableContours(editor.getNode(node.id));

    expect(
      getVisibleVectorCornerHandles(nextContours, [], activeDragSession)
    ).toEqual({
      dragScope: "active",
      points: [
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
      ],
    });
  });

  test("keeps the dragged sharp corner active even when other corner indices shift after the first round", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const activeDragSession = getActiveDragSession(getEditableContours(node), {
      contourIndex: 0,
      segmentIndex: 2,
    });

    expect(activeDragSession?.identity.anchor).toEqual({ x: 120, y: 90 });
    expect(
      editor.setPathPointCornerRadius(24, node.id, {
        contourIndex: 0,
        segmentIndex: 2,
      })
    ).toBe(true);

    const nextContours = getEditableContours(editor.getNode(node.id));

    expect(
      getVisibleVectorCornerHandles(nextContours, [], activeDragSession)
    ).toEqual({
      dragScope: "active",
      points: [
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
      ],
    });
  });

  test("keeps the bottom diamond handle active during bulk rounding from that handle", () => {
    const editor = new Editor();
    const node = createDiamondVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);

    const activeDragSession = getActiveDragSession(getEditableContours(node), {
      contourIndex: 0,
      segmentIndex: 2,
    });

    expect(activeDragSession?.identity.anchor).toEqual({ x: 0, y: 120 });
    expect(editor.setPathCornerRadius(24, node.id)).toBe(true);

    const nextContours = getEditableContours(editor.getNode(node.id));
    const renderedHandles = VectorCornerRadiusHandles({
      activeDragSession,
      contours: nextContours,
      editor,
      hoveredPoint: null,
      matrix: TEST_MATRIX,
      nodeId: node.id,
      onDragStateChange: null,
      onHoverChange: null,
      selectedPoints: [],
    });

    expect(Array.isArray(renderedHandles)).toBe(true);
    expect(renderedHandles).toHaveLength(1);

    const activeHandlePoint = renderedHandles?.[0]?.props?.selectedPoint;
    const activeHandleCorner = editor.getPathPointCornerControl(
      node.id,
      activeHandlePoint
    );

    expect(activeHandleCorner?.anchor?.x).toBeCloseTo(
      activeDragSession?.identity.anchor?.x || 0
    );
    expect(activeHandleCorner?.anchor?.y).toBeCloseTo(
      activeDragSession?.identity.anchor?.y || 0
    );
  });

  test("marks a selected logical corner handle as active", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint);

    const nextContours = getEditableContours(editor.getNode(node.id));

    const renderedHandles = VectorCornerRadiusHandles({
      activeDragSession: null,
      contours: nextContours,
      editor,
      hoveredPoint: null,
      matrix: TEST_MATRIX,
      nodeId: node.id,
      onDragStateChange: null,
      onHoverChange: null,
      selectedPoints: [
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
      ],
    });

    expect(Array.isArray(renderedHandles)).toBe(true);
    expect(renderedHandles).toHaveLength(1);
    expect(renderedHandles?.[0]?.props?.isSelected).toBe(true);
  });

  test("marks the active dragged corner red when that handle reaches its local max", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    expect(
      editor.setPathPointCornerRadius(24, node.id, {
        contourIndex: 0,
        segmentIndex: 0,
      })
    ).toBe(true);

    const nextContours = getEditableContours(editor.getNode(node.id));

    expect(getMaxedVectorCornerCurveSegments(nextContours)).toEqual([]);
    expect(
      getMaxedVectorCornerCurveSegments(
        nextContours,
        [],
        null,
        getActiveDragSession(
          nextContours,
          {
            contourIndex: 0,
            segmentIndex: 0,
          },
          { isAtMax: true }
        )
      )
    ).toEqual([
      {
        contourIndex: 0,
        endIndex: 1,
        startIndex: 0,
      },
    ]);
  });

  test("treats a detected live corner selection as a logical corner instead of point-handle chrome", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint);

    expect(
      shouldShowBezierHandlesForPoint(
        editor,
        node.id,
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
        {
          contourIndex: 0,
          segmentIndex: 0,
        }
      )
    ).toBe(false);
    expect(
      shouldShowBezierHandlesForPoint(
        editor,
        node.id,
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
        {
          contourIndex: 0,
          segmentIndex: 1,
        }
      )
    ).toBe(false);
    expect(
      shouldShowSelectedAnchorForPoint(
        editor,
        node.id,
        [
          {
            contourIndex: 0,
            segmentIndex: 0,
          },
        ],
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
        {
          contourIndex: 0,
          segmentIndex: 0,
        }
      )
    ).toBe(false);
    expect(
      shouldShowSelectedAnchorForPoint(
        editor,
        node.id,
        [
          {
            contourIndex: 0,
            segmentIndex: 0,
          },
        ],
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
        {
          contourIndex: 0,
          segmentIndex: 1,
        }
      )
    ).toBe(false);
  });

  test("does not show bezier handles for unrelated points in a detected live corner selection", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint);

    expect(
      shouldShowBezierHandlesForPoint(
        editor,
        node.id,
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
        {
          contourIndex: 0,
          segmentIndex: 2,
        }
      )
    ).toBe(false);
  });

  test("keeps ordinary smooth-point handles visible", () => {
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

    expect(
      shouldShowBezierHandlesForPoint(
        editor,
        node.id,
        editor.pathEditingPoint,
        editor.pathEditingPoint
      )
    ).toBe(true);
    expect(
      shouldShowBezierHandlesForPoint(
        editor,
        node.id,
        editor.pathEditingPoint,
        {
          contourIndex: 0,
          segmentIndex: 1,
        }
      )
    ).toBe(false);
  });

  test("only bulk-adjusts selected corners when dragging a handle from the current selected set", () => {
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

    expect(
      shouldAdjustSelectedCornerPoints("selected", editor.pathEditingPoints)
    ).toBe(true);
    expect(shouldAdjustSelectedCornerPoints("all", [])).toBe(true);
    expect(
      shouldAdjustSelectedCornerPoints(null, editor.pathEditingPoints)
    ).toBe(false);
  });

  test("hovering a detected live-corner handle resolves the fillet segment to highlight", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    editor.setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
    editor.setPathPointCornerRadius(24, node.id, editor.pathEditingPoint);
    const nextContours = getEditableContours(editor.getNode(node.id));

    expect(
      getHoveredVectorCornerCurveSegment(nextContours, {
        contourIndex: 0,
        segmentIndex: 0,
      })
    ).toEqual({
      contourIndex: 0,
      endIndex: 1,
      startIndex: 0,
    });
    expect(
      getHoveredVectorCornerCurveSegment(nextContours, {
        contourIndex: 0,
        segmentIndex: 2,
      })
    ).toBeNull();
  });

  test("resolves visible live-corner segments that have reached their max radius", () => {
    const editor = new Editor();
    const node = createRectangleVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    expect(editor.setPathCornerRadius(200, node.id)).toBe(true);

    const contours = getEditableContours(editor.getNode(node.id));

    expect(getMaxedVectorCornerCurveSegments(contours)).toEqual([
      {
        contourIndex: 0,
        endIndex: 1,
        startIndex: 0,
      },
      {
        contourIndex: 0,
        endIndex: 3,
        startIndex: 2,
      },
      {
        contourIndex: 0,
        endIndex: 5,
        startIndex: 4,
      },
      {
        contourIndex: 0,
        endIndex: 7,
        startIndex: 6,
      },
    ]);
  });

  test("does not mark corners red before the active drag scope reaches its stable max", () => {
    const editor = new Editor();
    const node = createIrregularPolygonVectorNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.startPathEditing(node.id);
    expect(editor.setPathCornerRadius(35, node.id)).toBe(true);

    const contours = getEditableContours(editor.getNode(node.id));

    expect(getMaxedVectorCornerCurveSegments(contours)).toEqual([]);
  });
});
