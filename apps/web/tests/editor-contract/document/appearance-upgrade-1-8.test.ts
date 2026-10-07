import { describe, expect, test } from "bun:test";
import { appearanceSchema } from "../../../../../packages/punch-schema/src/appearance-schema";
import { upgradeNodeAppearance1_8 } from "../../../../../packages/punch-schema/src/migrate-appearance";

const baseText = {
  id: "t1",
  type: "text",
  fill: "#ffffff",
  stroke: "#000000",
  strokeWidth: 3,
};

describe("upgradeNodeAppearance1_8", () => {
  test("text fill and stroke fold into one layer each with round caps", () => {
    const upgraded = upgradeNodeAppearance1_8(baseText);

    expect(upgraded).toEqual({
      appearance: {
        fills: [
          {
            enabled: true,
            id: "fill-1",
            opacity: 1,
            paint: { color: "#ffffff", kind: "solid" },
          },
        ],
        strokes: [
          {
            align: "center",
            cap: "round",
            enabled: true,
            id: "stroke-1",
            join: "round",
            miterLimit: 4,
            opacity: 1,
            paint: { color: "#000000", kind: "solid" },
            width: 3,
          },
        ],
      },
      id: "t1",
      type: "text",
    });
    expect(appearanceSchema.safeParse(upgraded.appearance).success).toBe(true);
  });

  test("path keeps its cap and join; an invalid miter below 1 paints as 4", () => {
    const upgraded = upgradeNodeAppearance1_8({
      fill: null,
      fillRule: "evenodd",
      id: "p1",
      stroke: "rgba(255, 0, 0, 0.5)",
      strokeLineCap: "butt",
      strokeLineJoin: "miter",
      strokeMiterLimit: 0,
      strokeWidth: 2,
      type: "path",
    }) as { appearance: { fills: unknown[]; strokes: unknown[] } };

    expect(upgraded.appearance.fills).toEqual([]);
    expect(upgraded.appearance.strokes).toEqual([
      {
        align: "center",
        cap: "butt",
        enabled: true,
        id: "stroke-1",
        join: "miter",
        miterLimit: 4,
        opacity: 0.5,
        paint: { color: "#ff0000", kind: "solid" },
        width: 2,
      },
    ]);
    expect(upgraded).toHaveProperty("fillRule", "evenodd");
    expect(upgraded).not.toHaveProperty("strokeLineCap");
  });

  test("zero-width, null, none, and transparent paint produce no layers", () => {
    for (const [fill, stroke, strokeWidth] of [
      ["none", "#000000", 0],
      ["transparent", null, 4],
      [null, "none", 4],
    ] as const) {
      const upgraded = upgradeNodeAppearance1_8({
        fill,
        id: "s1",
        stroke,
        strokeWidth,
        type: "shape",
      }) as { appearance: { fills: unknown[]; strokes: unknown[] } };

      expect(upgraded.appearance).toEqual({ fills: [], strokes: [] });
    }
  });

  test("unparseable colors survive so validation can reject them", () => {
    const upgraded = upgradeNodeAppearance1_8({
      ...baseText,
      fill: "url(#legacy)",
    }) as { appearance: unknown };

    expect(appearanceSchema.safeParse(upgraded.appearance).success).toBe(false);
  });

  test("non-paint nodes pass through untouched", () => {
    const group = { id: "g", opacity: 0.5, type: "group" };

    expect(upgradeNodeAppearance1_8(group)).toBe(group);
  });
});
