import { describe, expect, test } from "bun:test";
import { VECTOR_ANCHOR_INTERACTION_RADIUS_PX } from "@punchpress/engine";
import {
  getVectorAnchorHoverHaloRadiusPx,
  getVectorHoverHaloFillAlpha,
  getVectorHoverHaloStrokeWidthPx,
} from "../src/components/canvas/canvas-overlay/vector-hover-halo";

describe("vector hover halo", () => {
  test("anchor halo uses a filled glow that matches the shared interaction radius", () => {
    expect(getVectorAnchorHoverHaloRadiusPx()).toBe(
      VECTOR_ANCHOR_INTERACTION_RADIUS_PX
    );
    expect(getVectorHoverHaloStrokeWidthPx()).toBe(0);
    expect(getVectorHoverHaloFillAlpha()).toBeGreaterThan(0);
  });
});
