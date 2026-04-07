import { describe, expect, test } from "bun:test";
import {
  getVectorCornerRadiusFromWidgetDrag,
  getVectorCornerRadiusFromWidgetDragDelta,
  getVectorCornerWidgetDisplayGeometry,
  getVectorCornerWidgetGeometry,
} from "../../src/components/canvas/canvas-overlay/vector-path/corner-widget-geometry";

const createRectangleContours = () => {
  return [
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
  ];
};

const createImportedRoundedCornerContours = () => {
  const handleLength = 13.254_833_995_939_045;

  return [
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
  ];
};

const identityMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
};

describe("vector corner widget geometry", () => {
  test("places the widget inside an eligible corner", () => {
    const geometry = getVectorCornerWidgetGeometry({
      contours: createRectangleContours(),
      matrix: identityMatrix,
      point: {
        contourIndex: 0,
        segmentIndex: 0,
      },
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.center.x).toBeGreaterThan(geometry?.anchor.x || 0);
    expect(geometry?.center.y).toBeGreaterThan(geometry?.anchor.y || 0);
    expect(geometry?.maxRadius).toBeGreaterThan(0);
  });

  test("maps drag distance back to corner radius and clamps to the corner maximum", () => {
    const geometry = getVectorCornerWidgetGeometry({
      contours: createRectangleContours(),
      matrix: identityMatrix,
      point: {
        contourIndex: 0,
        segmentIndex: 0,
      },
    });

    if (!geometry) {
      throw new Error("Expected corner widget geometry");
    }

    const targetRadius = 24;
    const distancePerRadius = 1 / Math.sin(geometry.cornerAngle / 2);
    const dragPoint = {
      x:
        geometry.anchor.x +
        geometry.direction.x *
          (geometry.minDistancePx +
            targetRadius * distancePerRadius * geometry.pixelsPerLocalUnit),
      y:
        geometry.anchor.y +
        geometry.direction.y *
          (geometry.minDistancePx +
            targetRadius * distancePerRadius * geometry.pixelsPerLocalUnit),
    };

    expect(
      getVectorCornerRadiusFromWidgetDrag(geometry, dragPoint)
    ).toBeCloseTo(targetRadius, 6);

    const farPoint = {
      x:
        geometry.anchor.x +
        geometry.direction.x * (geometry.maxDistancePx + 500),
      y:
        geometry.anchor.y +
        geometry.direction.y * (geometry.maxDistancePx + 500),
    };

    expect(getVectorCornerRadiusFromWidgetDrag(geometry, farPoint)).toBeCloseTo(
      geometry.maxRadius,
      6
    );
  });

  test("maps drag delta from the initial handle position without rebasing to moved geometry", () => {
    const geometry = getVectorCornerWidgetGeometry({
      contours: createRectangleContours(),
      matrix: identityMatrix,
      point: {
        contourIndex: 0,
        segmentIndex: 0,
      },
    });

    if (!geometry) {
      throw new Error("Expected corner widget geometry");
    }

    const startPoint = geometry.center;
    const targetRadius = 24;
    const distancePerRadius = 1 / Math.sin(geometry.cornerAngle / 2);
    const dragPoint = {
      x:
        startPoint.x +
        geometry.direction.x *
          (targetRadius * distancePerRadius * geometry.pixelsPerLocalUnit),
      y:
        startPoint.y +
        geometry.direction.y *
          (targetRadius * distancePerRadius * geometry.pixelsPerLocalUnit),
    };

    expect(
      getVectorCornerRadiusFromWidgetDragDelta(geometry, startPoint, dragPoint)
    ).toBeCloseTo(targetRadius, 6);
    expect(
      getVectorCornerRadiusFromWidgetDragDelta(geometry, startPoint, startPoint)
    ).toBeCloseTo(0, 6);
  });

  test("can render the active drag handle from pointer-down geometry across a broader shared max", () => {
    const geometry = getVectorCornerWidgetGeometry({
      contours: createRectangleContours(),
      matrix: identityMatrix,
      point: {
        contourIndex: 0,
        segmentIndex: 0,
      },
    });

    if (!geometry) {
      throw new Error("Expected corner widget geometry");
    }

    const displayGeometry = getVectorCornerWidgetDisplayGeometry(
      geometry,
      geometry.maxRadius + 24,
      geometry.maxRadius + 24
    );

    expect(displayGeometry).not.toBeNull();
    expect(
      (displayGeometry?.center.x || 0) - geometry.center.x
    ).toBeGreaterThan(0);
    expect(displayGeometry?.currentRadius).toBeCloseTo(
      geometry.maxRadius + 24,
      6
    );
  });

  test("exposes widget geometry for an imported rounded corner trim point", () => {
    const geometry = getVectorCornerWidgetGeometry({
      contours: createImportedRoundedCornerContours(),
      matrix: identityMatrix,
      point: {
        contourIndex: 0,
        segmentIndex: 0,
      },
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.currentRadius).toBeCloseTo(24, 3);
  });

  test("uses the geometric corner max for the widget range", () => {
    const geometry = getVectorCornerWidgetGeometry({
      contours: createRectangleContours(),
      currentRadius: 240,
      matrix: identityMatrix,
      point: {
        contourIndex: 0,
        segmentIndex: 0,
      },
    });

    if (!geometry) {
      throw new Error("Expected corner widget geometry");
    }

    expect(geometry.currentRadius).toBeCloseTo(90, 6);
    expect(geometry.localMaxRadius).toBeCloseTo(90, 6);
    expect(geometry.maxRadius).toBeCloseTo(90, 6);
  });

  test("does not expose widgets for ineligible points", () => {
    const contours = createRectangleContours();
    contours[0].segments[0] = {
      ...contours[0].segments[0],
      pointType: "smooth",
    };

    expect(
      getVectorCornerWidgetGeometry({
        contours,
        matrix: identityMatrix,
        point: {
          contourIndex: 0,
          segmentIndex: 0,
        },
      })
    ).toBeNull();
  });
});
