import { describe, expect, test } from "bun:test";
import {
  closeVectorContourByDraggingEndpoint,
  getVectorDraggedEndpointPreviewPoint,
  getVectorEndpointCloseTarget,
  shouldSnapVectorEndpointClose,
} from "../src/components/canvas/canvas-overlay/vector-endpoint-close";

const createOpenContour = () => {
  return {
    closed: false,
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 24, y: 6 },
        point: { x: 0, y: 0 },
        pointType: "smooth",
      },
      {
        handleIn: { x: -12, y: 0 },
        handleOut: { x: 18, y: 4 },
        point: { x: 80, y: 40 },
        pointType: "smooth",
      },
      {
        handleIn: { x: -20, y: -8 },
        handleOut: { x: 0, y: 0 },
        point: { x: 160, y: 20 },
        pointType: "corner",
      },
    ],
  };
};

describe("vector endpoint close", () => {
  test("resolves the opposite endpoint as the only valid close target", () => {
    const contours = [createOpenContour()];

    expect(
      getVectorEndpointCloseTarget(contours, {
        contourIndex: 0,
        segmentIndex: 2,
      })
    ).toEqual({
      contourIndex: 0,
      point: { x: 0, y: 0 },
      segmentIndex: 0,
    });

    expect(
      getVectorEndpointCloseTarget(contours, {
        contourIndex: 0,
        segmentIndex: 0,
      })
    ).toEqual({
      contourIndex: 0,
      point: { x: 160, y: 20 },
      segmentIndex: 2,
    });

    expect(
      getVectorEndpointCloseTarget(contours, {
        contourIndex: 0,
        segmentIndex: 1,
      })
    ).toBeNull();
  });

  test("snaps only when the dragged endpoint is close enough to the target endpoint", () => {
    expect(
      shouldSnapVectorEndpointClose({ x: 160, y: 20 }, { x: 168, y: 24 }, 10)
    ).toBe(true);

    expect(
      shouldSnapVectorEndpointClose({ x: 160, y: 20 }, { x: 176, y: 40 }, 10)
    ).toBe(false);
  });

  test("drag preview locks to the target point without mutating the dragged endpoint source point", () => {
    const contours = [createOpenContour()];
    const target = getVectorEndpointCloseTarget(contours, {
      contourIndex: 0,
      segmentIndex: 2,
    });

    expect(target).not.toBeNull();

    if (!target) {
      return;
    }

    const previewPoint = getVectorDraggedEndpointPreviewPoint(
      contours,
      {
        contourIndex: 0,
        segmentIndex: 2,
      },
      { x: 159, y: 19 },
      target
    );

    expect(previewPoint).toEqual({ x: 0, y: 0 });
    expect(contours[0]?.segments[2]?.point).toEqual({ x: 160, y: 20 });
  });

  test("closing by dragging the trailing endpoint onto the leading endpoint removes the duplicate endpoint", () => {
    const result = closeVectorContourByDraggingEndpoint([createOpenContour()], {
      contourIndex: 0,
      draggedSegmentIndex: 2,
      targetSegmentIndex: 0,
    });

    expect(result.selectedPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 0,
    });
    expect(result.contours).toEqual([
      {
        closed: true,
        segments: [
          {
            handleIn: { x: -20, y: -8 },
            handleOut: { x: 24, y: 6 },
            point: { x: 0, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: -12, y: 0 },
            handleOut: { x: 18, y: 4 },
            point: { x: 80, y: 40 },
            pointType: "smooth",
          },
        ],
      },
    ]);
  });

  test("closing by dragging the leading endpoint onto the trailing endpoint removes the duplicate endpoint", () => {
    const result = closeVectorContourByDraggingEndpoint([createOpenContour()], {
      contourIndex: 0,
      draggedSegmentIndex: 0,
      targetSegmentIndex: 2,
    });

    expect(result.selectedPoint).toEqual({
      contourIndex: 0,
      segmentIndex: 1,
    });
    expect(result.contours).toEqual([
      {
        closed: true,
        segments: [
          {
            handleIn: { x: -12, y: 0 },
            handleOut: { x: 18, y: 4 },
            point: { x: 80, y: 40 },
            pointType: "smooth",
          },
          {
            handleIn: { x: -20, y: -8 },
            handleOut: { x: 24, y: 6 },
            point: { x: 160, y: 20 },
            pointType: "corner",
          },
        ],
      },
    ]);
  });

  test("closing a uniformly rounded open contour applies that radius to the new closing corner", () => {
    const contour = createOpenContour();
    contour.segments[0] = {
      ...contour.segments[0],
      handleOut: { x: 0, y: 0 },
      pointType: "corner",
    };
    contour.segments[1] = {
      ...contour.segments[1],
      cornerRadius: 14,
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      pointType: "corner",
    };
    contour.segments[2] = {
      ...contour.segments[2],
      handleIn: { x: 0, y: 0 },
    };

    const result = closeVectorContourByDraggingEndpoint([contour], {
      contourIndex: 0,
      draggedSegmentIndex: 2,
      targetSegmentIndex: 0,
    });

    expect(result.contours[0]?.segments[0]?.cornerRadius).toBe(14);
  });

  test("closing a mixed-radius open contour does not invent a new inherited radius", () => {
    const contour = {
      closed: false,
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 0, y: 0 },
          pointType: "corner" as const,
        },
        {
          cornerRadius: 14,
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 60, y: 40 },
          pointType: "corner" as const,
        },
        {
          cornerRadius: 28,
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: 10 },
          pointType: "corner" as const,
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 180, y: 40 },
          pointType: "corner" as const,
        },
      ],
    };

    const result = closeVectorContourByDraggingEndpoint([contour], {
      contourIndex: 0,
      draggedSegmentIndex: 3,
      targetSegmentIndex: 0,
    });

    expect(result.contours[0]?.segments[0]?.cornerRadius).toBeUndefined();
  });
});
