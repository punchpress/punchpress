import { describe, expect, test } from "bun:test";
import {
  getPixelGridPaths,
  getVisiblePixelGridBounds,
} from "../src/components/canvas/canvas-pixel-grid-path";

describe("canvas pixel-grid paths", () => {
  test("limits an enormous target to the visible screen plus one-cell overscan", () => {
    const bounds = getVisiblePixelGridBounds(
      {
        height: 1_000_000,
        width: 1_000_000,
        x: -500_000,
        y: -500_000,
      },
      {
        cellHeight: 1,
        cellWidth: 1,
        originX: -500_000,
        originY: -500_000,
      },
      {
        a: 40,
        b: 0,
        c: 0,
        d: 40,
        e: -12_000,
        f: -8000,
        viewportHeight: 900,
        viewportWidth: 1600,
      }
    );

    expect(bounds).toEqual({
      height: 24.5,
      width: 42,
      x: 299,
      y: 199,
    });

    if (!bounds) {
      throw new Error("Expected visible grid bounds");
    }

    const paths = getPixelGridPaths(bounds, {
      cellHeight: 1,
      cellWidth: 1,
      originX: -500_000,
      originY: -500_000,
    });
    const lineCount = `${paths.horizontal}${paths.vertical}`.match(/M/g);

    expect(lineCount).toHaveLength(68);
  });
});
