import { describe, expect, test } from "bun:test";
import { getNodeLocalMatrix, multiplyMatrix } from "@punchpress/engine";
import { getRasterWorkingSurfaceRelativeMatrix } from "../../src/components/canvas/raster/raster-working-surface-transform";

describe("Raster working-surface presentation", () => {
  test("keeps a rebased working plane stationary inside a rotated scaled Raster", () => {
    const durableNode = {
      height: 420,
      transform: {
        rotation: 37,
        scaleX: 1.75,
        scaleY: 0.6,
        x: 260,
        y: 140,
      },
      type: "image",
      width: 360,
    };
    const workingSurface = {
      height: 680,
      transform: {
        rotation: 37,
        scaleX: 1.75,
        scaleY: 0.6,
        x: 95,
        y: -45,
      },
      width: 740,
    };
    const relativeMatrix = getRasterWorkingSurfaceRelativeMatrix(
      durableNode,
      workingSurface
    );

    expect(relativeMatrix).not.toBeNull();

    const composedMatrix = multiplyMatrix(
      getNodeLocalMatrix(durableNode, getBounds(durableNode)),
      relativeMatrix
    );
    const workingMatrix = getNodeLocalMatrix(
      { ...durableNode, ...workingSurface },
      getBounds(workingSurface)
    );

    for (const key of ["a", "b", "c", "d", "e", "f"]) {
      expect(composedMatrix[key]).toBeCloseTo(workingMatrix[key], 8);
    }
  });
});

const getBounds = ({ height, width }) => ({
  height,
  maxX: width,
  maxY: height,
  minX: 0,
  minY: 0,
  width,
});
