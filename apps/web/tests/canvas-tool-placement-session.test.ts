import { describe, expect, test } from "bun:test";
import { getPlacementSessionEventNames } from "../src/components/canvas/canvas-tool-placement-session";

describe("canvas tool placement session events", () => {
  test("uses only pointer events for pointer-originated placement gestures", () => {
    expect(getPlacementSessionEventNames({ pointerId: 1 })).toEqual({
      cancel: "pointercancel",
      move: "pointermove",
      up: "pointerup",
    });
  });

  test("falls back to mouse events for mouse-originated placement gestures", () => {
    expect(getPlacementSessionEventNames({})).toEqual({
      cancel: null,
      move: "mousemove",
      up: "mouseup",
    });
  });
});
