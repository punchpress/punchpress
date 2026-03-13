import { describe, expect, test } from "bun:test";
import {
  formatCssColor,
  formatDisplayValue,
  formatHexColor,
  formatStorageColor,
  parseColor,
} from "./color-picker-utils";

describe("color-picker-utils", () => {
  test("parses hex colors with alpha into picker state", () => {
    const color = parseColor("#FF000080");

    if (!color) {
      throw new Error("Expected color to parse.");
    }

    expect(formatHexColor(color)).toBe("#FF0000");
    expect(Math.round(color.alpha)).toBe(50);
  });

  test("parses rgba colors and preserves the normalized storage format", () => {
    const color = parseColor("rgba(12, 34, 56, 0.25)");

    if (!color) {
      throw new Error("Expected color to parse.");
    }

    expect(formatStorageColor(color)).toBe("rgba(12, 34, 56, 0.25)");
  });

  test("parses hsl colors and exposes rgb and css display values", () => {
    const color = parseColor("hsl(210, 65%, 20%)");

    if (!color) {
      throw new Error("Expected color to parse.");
    }

    expect(formatCssColor(color)).toBe("rgb(18, 51, 84)");
    expect(formatDisplayValue(color, "rgb")).toEqual({
      alpha: "100",
      values: ["18", "51", "84"],
    });
  });
});
