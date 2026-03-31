import { describe, expect, test } from "bun:test";
import { getVectorBezierHandleAppearance } from "../src/components/canvas/canvas-overlay/vector-handle-appearance";

describe("vector bezier handle appearance", () => {
  test("uses the same smaller solid style for regular path handles and pen preview handles", () => {
    expect(getVectorBezierHandleAppearance()).toEqual({
      fillMode: "solid",
      radiusPx: 5,
    });
  });
});
