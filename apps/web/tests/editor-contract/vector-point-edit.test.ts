import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import {
  setVectorPointType,
  updateVectorPointHandle,
} from "../../../../packages/engine/src/nodes/vector/point-edit";

const createRectangleContour = () => {
  return {
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
  };
};

describe("vector point editing", () => {
  test("converting a corner point to smooth materializes mirrored handles", () => {
    const contours = [createRectangleContour()];
    const nextContours = setVectorPointType(contours, {
      contourIndex: 0,
      pointType: "smooth",
      segmentIndex: 0,
    });
    const segment = nextContours[0]?.segments[0];

    expect(segment?.pointType).toBe("smooth");
    expect(segment?.handleIn.x).toBeCloseTo(-segment!.handleOut.x, 5);
    expect(segment?.handleIn.y).toBeCloseTo(-segment!.handleOut.y, 5);
    expect(Math.hypot(segment!.handleOut.x, segment!.handleOut.y)).toBeGreaterThan(
      1
    );
  });

  test("dragging one smooth handle keeps the opposite side tangent-aligned", () => {
    const contours = setVectorPointType([createRectangleContour()], {
      contourIndex: 0,
      pointType: "smooth",
      segmentIndex: 0,
    });
    const previousSegment = contours[0]?.segments[0];
    const previousOppositeLength = Math.hypot(
      previousSegment!.handleIn.x,
      previousSegment!.handleIn.y
    );

    const nextContours = updateVectorPointHandle(contours, {
      contourIndex: 0,
      handleRole: "handleOut",
      segmentIndex: 0,
      value: { x: 60, y: 20 },
    });
    const segment = nextContours[0]?.segments[0];
    const nextOppositeLength = Math.hypot(
      segment!.handleIn.x,
      segment!.handleIn.y
    );

    expect(segment?.pointType).toBe("smooth");
    expect(segment?.handleIn.x / segment!.handleIn.y).toBeCloseTo(
      segment!.handleOut.x / segment!.handleOut.y,
      5
    );
    expect(segment?.handleIn.x).toBeLessThan(0);
    expect(segment?.handleIn.y).toBeLessThan(0);
    expect(nextOppositeLength).toBeCloseTo(previousOppositeLength, 5);
  });

  test("dragging one corner handle does not move the opposite side", () => {
    const contours = setVectorPointType([createRectangleContour()], {
      contourIndex: 0,
      pointType: "smooth",
      segmentIndex: 0,
    });
    const cornerContours = setVectorPointType(contours, {
      contourIndex: 0,
      pointType: "corner",
      segmentIndex: 0,
    });
    const previousSegment = cornerContours[0]?.segments[0];

    const nextContours = updateVectorPointHandle(cornerContours, {
      contourIndex: 0,
      handleRole: "handleOut",
      segmentIndex: 0,
      value: { x: 48, y: 12 },
    });
    const segment = nextContours[0]?.segments[0];

    expect(segment?.pointType).toBe("corner");
    expect(segment?.handleIn).toEqual(previousSegment?.handleIn);
    expect(segment?.handleOut).toEqual({ x: 48, y: 12 });
  });

  test("loading a 1.4 vector document defaults point types to corner", () => {
    const editor = new Editor();

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            contours: [createRectangleContour()],
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
              x: 240,
              y: 180,
            },
            type: "vector",
            visible: true,
          },
        ],
        version: "1.4",
      })
    );

    const segment = editor.getNode("vector-node")?.contours?.[0]?.segments?.[0];

    expect(segment?.pointType).toBe("corner");
    expect(editor.getDebugDump().document.version).toBe("1.5");
  });
});
