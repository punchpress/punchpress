import { describe, expect, test } from "bun:test";
import {
  closeVectorContourByDraggingEndpoint,
  finalizeVectorEndpointDrag,
  getVectorDraggedEndpointPreviewPoint,
  getVectorEndpointCloseTarget,
  getVectorEndpointSnapTargets,
  resolveVectorEndpointDragTarget,
  shouldSnapVectorEndpointClose,
} from "../src/components/canvas/canvas-overlay/vector-path/endpoint-close";

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

  test("resolves compatible snap targets across open contours", () => {
    const contours = [
      createOpenContour(),
      {
        closed: false,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 220, y: 60 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 300, y: 80 },
            pointType: "corner" as const,
          },
        ],
      },
    ];

    expect(
      getVectorEndpointSnapTargets(contours, {
        contourIndex: 0,
        segmentIndex: 2,
      })
    ).toEqual([
      {
        contourIndex: 0,
        point: { x: 0, y: 0 },
        segmentIndex: 0,
      },
      {
        contourIndex: 1,
        point: { x: 220, y: 60 },
        segmentIndex: 0,
      },
      {
        contourIndex: 1,
        point: { x: 300, y: 80 },
        segmentIndex: 1,
      },
    ]);
  });

  test("picks the closest compatible drag target and marks same-contour drops as close", () => {
    const contours = [createOpenContour()];

    expect(
      resolveVectorEndpointDragTarget(
        contours,
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
        { x: 4, y: 3 },
        {
          projectPoint: (point) => point,
          snapDistancePx: 10,
        }
      )
    ).toEqual({
      behavior: "close-contour",
      contourIndex: 0,
      point: { x: 0, y: 0 },
      segmentIndex: 0,
    });
  });

  test("marks cross-contour endpoint drags as snap-only", () => {
    const contours = [
      createOpenContour(),
      {
        closed: false,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 220, y: 60 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 300, y: 80 },
            pointType: "corner" as const,
          },
        ],
      },
    ];

    expect(
      resolveVectorEndpointDragTarget(
        contours,
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
        { x: 221, y: 61 },
        {
          projectPoint: (point) => point,
          snapDistancePx: 10,
        }
      )
    ).toEqual({
      behavior: "snap-endpoint",
      contourIndex: 1,
      point: { x: 220, y: 60 },
      segmentIndex: 0,
    });
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

  test("drag preview also locks to a compatible endpoint on another contour", () => {
    const contours = [
      createOpenContour(),
      {
        closed: false,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 220, y: 60 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 300, y: 80 },
            pointType: "corner" as const,
          },
        ],
      },
    ];

    const previewPoint = getVectorDraggedEndpointPreviewPoint(
      contours,
      {
        contourIndex: 0,
        segmentIndex: 2,
      },
      { x: 221, y: 61 },
      {
        contourIndex: 1,
        point: { x: 220, y: 60 },
        segmentIndex: 0,
      }
    );

    expect(previewPoint).toEqual({ x: 220, y: 60 });
    expect(contours[0]?.segments[2]?.point).toEqual({ x: 160, y: 20 });
  });

  test("finalize selects both snapped endpoints for explicit join", () => {
    const contours = [
      createOpenContour(),
      {
        closed: false,
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 220, y: 60 },
            pointType: "corner" as const,
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 300, y: 80 },
            pointType: "corner" as const,
          },
        ],
      },
    ];

    expect(
      finalizeVectorEndpointDrag(
        contours,
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
        {
          behavior: "snap-endpoint",
          contourIndex: 1,
          point: { x: 220, y: 60 },
          segmentIndex: 0,
        }
      )
    ).toEqual({
      contours,
      primaryPoint: null,
      selectedPoints: [
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
        {
          contourIndex: 1,
          segmentIndex: 0,
        },
      ],
    });
  });

  test("finalize closes the contour when the snap target is on the same contour", () => {
    expect(
      finalizeVectorEndpointDrag(
        [createOpenContour()],
        {
          contourIndex: 0,
          segmentIndex: 2,
        },
        {
          behavior: "close-contour",
          contourIndex: 0,
          point: { x: 0, y: 0 },
          segmentIndex: 0,
        }
      )
    ).toEqual({
      contours: [
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
      ],
      primaryPoint: {
        contourIndex: 0,
        segmentIndex: 0,
      },
      selectedPoints: [
        {
          contourIndex: 0,
          segmentIndex: 0,
        },
      ],
    });
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
});
