import { describe, expect, test } from "bun:test";
import {
  getScrubPercent,
  resolveScrubValue,
} from "@/components/ui/scrub-slider";

describe("ScrubSlider", () => {
  test("allows overscroll beyond the scrub range while keeping hard bounds", () => {
    const nextValue = resolveScrubValue(
      450,
      400,
      -500,
      500,
      -1000,
      10_000,
      1,
      80
    );

    expect(nextValue).toBe(850);
    expect(getScrubPercent(nextValue, -500, 500)).toBe("96%");
  });

  test("recovers back toward the scrub range from overscrolled values", () => {
    const nextValue = resolveScrubValue(
      850,
      -120,
      -500,
      500,
      -1000,
      10_000,
      1,
      80
    );

    expect(nextValue).toBeLessThan(850);
    expect(nextValue).toBeLessThan(500);
    expect(nextValue).toBeGreaterThan(450);
  });
});
