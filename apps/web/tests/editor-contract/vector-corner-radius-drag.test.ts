import { describe, expect, test } from "bun:test";
import { getVectorPointCornerControl } from "@punchpress/engine";
import { getVectorCornerRadiusDragContours } from "../../src/components/canvas/canvas-overlay/vector-path/corner-radius-drag";

const createReversingPolygonContours = () => {
  return [
    {
      closed: true,
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 170.97, y: -1.12 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 18.65, y: 158.18 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -131.32, y: 85.95 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -120.91, y: -58.96 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 11.26, y: -99.35 },
          pointType: "corner" as const,
        },
      ],
    },
  ];
};

describe("vector corner radius drag", () => {
  test("uses the pointer-down contours for grouped drag so the dragged corner radius stays monotonic", () => {
    const startContours = createReversingPolygonContours();
    const requestedRadii = [12, 24, 36, 48, 60, 72, 84, 96];
    let previousRadius = -1;

    for (const requestedRadius of requestedRadii) {
      const nextContours = getVectorCornerRadiusDragContours({
        contours: startContours,
        dragScope: "all",
        point: {
          contourIndex: 0,
          segmentIndex: 0,
        },
        radius: requestedRadius,
        selectedPoints: [],
      });

      expect(nextContours).not.toBeNull();

      const activeCorner = getVectorPointCornerControl(nextContours || [], {
        contourIndex: 0,
        segmentIndex: 0,
      });
      const appliedRadius = activeCorner?.currentRadius ?? 0;

      expect(appliedRadius).toBeGreaterThanOrEqual(previousRadius - 0.001);
      previousRadius = appliedRadius;
    }
  });
});
