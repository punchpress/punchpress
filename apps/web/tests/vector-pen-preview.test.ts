import { describe, expect, test } from "bun:test";
import {
  getPenPreviewEndpoint,
  getPenPreviewHandleAppearance,
  getPenPreviewHandleIn,
  getPenPreviewHandleOut,
  shouldShowPenPreviewGhostAnchor,
  shouldShowPenPreviewHandles,
} from "../src/components/canvas/canvas-overlay/vector-pen-preview";

const contour = {
  closed: false,
  segments: [
    {
      handleIn: { x: -60, y: 20 },
      handleOut: { x: 60, y: -20 },
      point: { x: 0, y: 0 },
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 40, y: 30 },
      point: { x: 120, y: 60 },
    },
  ],
};

describe("vector pen preview", () => {
  test("does not invent an incoming handle for a hover preview after a smooth point", () => {
    expect(
      getPenPreviewHandleIn(contour, {
        contourIndex: 0,
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: null,
      })
    ).toBeNull();
  });

  test("uses the authored handle while dragging the next smooth point", () => {
    expect(
      getPenPreviewHandleIn(contour, {
        contourIndex: 0,
        handleIn: { x: -30, y: 18 },
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: null,
      })
    ).toEqual({ x: -30, y: 18 });
  });

  test("reuses the start anchor when previewing a close", () => {
    expect(
      getPenPreviewEndpoint(contour, {
        contourIndex: 0,
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: {
          segmentIndex: 0,
          type: "start-anchor",
        },
      })
    ).toEqual({ x: 0, y: 0 });

    expect(
      getPenPreviewHandleIn(contour, {
        contourIndex: 0,
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: {
          segmentIndex: 0,
          type: "start-anchor",
        },
      })
    ).toEqual({ x: -60, y: 20 });
  });

  test("hides the ghost anchor for plain hover preview under the cursor", () => {
    expect(
      shouldShowPenPreviewGhostAnchor({
        contourIndex: 0,
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: null,
      })
    ).toBe(false);
  });

  test("shows the ghost anchor while dragging the next smooth point", () => {
    expect(
      shouldShowPenPreviewGhostAnchor({
        contourIndex: 0,
        handleIn: { x: -30, y: 18 },
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: null,
      })
    ).toBe(true);
  });

  test("shows mirrored handles for the pending smooth point while dragging", () => {
    expect(
      shouldShowPenPreviewHandles({
        contourIndex: 0,
        handleIn: { x: -30, y: 18 },
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: null,
      })
    ).toBe(true);

    expect(
      getPenPreviewHandleOut({
        contourIndex: 0,
        handleIn: { x: -30, y: 18 },
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: null,
      })
    ).toEqual({ x: 30, y: -18 });
  });

  test("uses a slightly smaller solid style for preview handles", () => {
    expect(getPenPreviewHandleAppearance()).toEqual({
      fillMode: "solid",
      radiusPx: 5,
    });
  });

  test("does not show pending-point handles for plain hover preview", () => {
    expect(
      shouldShowPenPreviewHandles({
        contourIndex: 0,
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: null,
      })
    ).toBe(false);
  });

  test("hides the ghost anchor when previewing a close onto the start anchor", () => {
    expect(
      shouldShowPenPreviewGhostAnchor({
        contourIndex: 0,
        kind: "segment",
        nodeId: "node-1",
        pointer: { x: 220, y: 140 },
        target: {
          segmentIndex: 0,
          type: "start-anchor",
        },
      })
    ).toBe(false);
  });
});
