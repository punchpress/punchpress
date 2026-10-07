import { describe, expect, test } from "bun:test";
import {
  formatColor,
  isCanonicalColor,
  parseColor,
} from "../../../../../packages/punch-schema/src/color";

describe("parseColor", () => {
  test.each([
    ["#FFF", "#ffffff", 1],
    ["#1f6FEB", "#1f6feb", 1],
    ["1f6feb", "#1f6feb", 1],
    ["#00000080", "#000000", 0.502],
    ["#f008", "#ff0000", 0.533],
    ["rgb(255, 0, 0)", "#ff0000", 1],
    ["rgba(31, 111, 235, 0.25)", "#1f6feb", 0.25],
    ["rgb(31 111 235 / 50%)", "#1f6feb", 0.5],
    ["rgb(100%, 0%, 0%)", "#ff0000", 1],
    ["hsl(120, 100%, 25%)", "#008000", 1],
    ["hsla(0, 0%, 100%, 0.4)", "#ffffff", 0.4],
    ["RebeccaPurple", "#663399", 1],
    ["hsl(0.5turn 100% 50%)", "#00ffff", 1],
    ["hsl(-120deg, 100%, 50%)", "#0000ff", 1],
    ["hsl(200grad 100% 50%)", "#00ffff", 1],
    ["  white ", "#ffffff", 1],
  ])("%s → %s @ %d", (input, color, opacity) => {
    expect(parseColor(input)).toEqual({ color, opacity });
  });

  test("clamps out-of-range channels and alpha", () => {
    expect(parseColor("rgba(300, -5, 20, 2)")).toEqual({
      color: "#ff0014",
      opacity: 1,
    });
  });

  test.each([
    "none",
    "transparent",
    "",
    "url(#g)",
    "#12",
    "rgb(1,2)",
    "bogus",
    "constructor",
    "__proto__",
    "rgb(1oops 2 3)",
    "rgb(1,,2,3)",
    "rgb(1, 2 3)",
    "rgba(1, 2, 3, 4, 5)",
  ])("%s is not a color", (input) => {
    expect(parseColor(input)).toBeNull();
  });

  test("rejects non-strings", () => {
    expect(parseColor(null)).toBeNull();
    expect(parseColor(12)).toBeNull();
  });

  test("canonical output round-trips", () => {
    const parsed = parseColor("hsl(210, 40%, 60%)");

    expect(parsed && isCanonicalColor(parsed.color)).toBe(true);
    expect(parseColor(parsed?.color)).toEqual({
      color: parsed?.color,
      opacity: 1,
    });
  });

  test("formatColor rounds and clamps channels", () => {
    expect(formatColor({ b: 255.6, g: -2, r: 15.4 })).toBe("#0f00ff");
    expect(isCanonicalColor("#0F00FF")).toBe(false);
  });
});
