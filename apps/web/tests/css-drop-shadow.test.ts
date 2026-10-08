import { describe, expect, test } from "bun:test";
import { buildEffectFilter } from "@punchpress/engine";
import { getCssDropShadow } from "../src/components/canvas/css-drop-shadow";

const shadow = (extra = {}) => ({
  blur: 24,
  color: "#ff0000",
  enabled: true,
  id: "shadow-1",
  kind: "drop-shadow" as const,
  opacity: 0.5,
  x: 10,
  y: -4,
  ...extra,
});

const INK = { height: 100, maxX: 100, maxY: 100, minX: 0, minY: 0, width: 100 };

const findStdDeviation = (element): string | null => {
  if (element?.tag === "feGaussianBlur") {
    return element.attributes.stdDeviation;
  }

  for (const child of element?.children ?? []) {
    const found = findStdDeviation(child);

    if (found) {
      return found;
    }
  }

  return null;
};

describe("css drop shadow", () => {
  test("uses the same Gaussian deviation as the SVG graph and export", () => {
    const presentation = { effects: [shadow()], ink: INK };

    // CSS drop-shadow() takes the standard deviation, not the blur radius.
    expect(getCssDropShadow(presentation)).toBe(
      "drop-shadow(10px -4px 12px rgba(255, 0, 0, 0.5))"
    );
    expect(findStdDeviation(buildEffectFilter(presentation, "fx"))).toBe("12");
  });

  test("several shadows need the SVG graph", () => {
    const presentation = {
      effects: [shadow(), shadow({ id: "shadow-2" })],
      ink: INK,
    };

    expect(getCssDropShadow(presentation)).toBeNull();
  });
});
