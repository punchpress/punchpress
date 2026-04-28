import { describe, expect, test } from "bun:test";
import { Editor, TEXT_TRACKING_RANGE } from "@punchpress/engine";
import { getLocalFontId } from "@punchpress/punch-schema";

const FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

const TRANSLATE_X_PATTERN = /^translate\(([-\d.]+)/;

const VARIABLE_WIDTHS = {
  D: 54,
  E: 42,
  I: 18,
  W: 78,
} as const;

const createFixedWidthLoadedFont = () => {
  return {
    charToGlyph: () => ({
      advanceWidth: 500,
      getPath: (_x: number, _y: number, fontSize: number) => {
        return {
          commands: [
            { type: "M", x: 0, y: -0.8 * fontSize },
            { type: "L", x: 40, y: -0.8 * fontSize },
            { type: "L", x: 40, y: 0.2 * fontSize },
            { type: "L", x: 0, y: 0.2 * fontSize },
            { type: "Z" },
          ],
          toPathData: () => "",
        };
      },
    }),
    unitsPerEm: 1000,
  };
};

const createVariableWidthLoadedFont = () => {
  const metrics = {
    D: { advanceWidth: 620, width: VARIABLE_WIDTHS.D },
    E: { advanceWidth: 500, width: VARIABLE_WIDTHS.E },
    I: { advanceWidth: 240, width: VARIABLE_WIDTHS.I },
    W: { advanceWidth: 820, width: VARIABLE_WIDTHS.W },
  } as const;

  return {
    charToGlyph: (char: keyof typeof metrics) => {
      const metric = metrics[char] ?? { advanceWidth: 500, width: 40 };

      return {
        advanceWidth: metric.advanceWidth,
        getPath: (_x: number, _y: number, fontSize: number) => {
          return {
            commands: [
              { type: "M", x: 0, y: -0.8 * fontSize },
              { type: "L", x: metric.width, y: -0.8 * fontSize },
              { type: "L", x: metric.width, y: 0.2 * fontSize },
              { type: "L", x: 0, y: 0.2 * fontSize },
              { type: "Z" },
            ],
            toPathData: () => "",
          };
        },
      };
    },
    unitsPerEm: 1000,
  };
};

const createTextNode = ({ fontSize, id, text, tracking }) => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize,
    id,
    parentId: "root",
    stroke: null,
    strokeWidth: 0,
    text,
    tracking,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 500,
      y: 600,
    },
    type: "text",
    visible: true,
    warp: {
      kind: "none",
    },
  } as const;
};

const getTranslateXs = (editor: Editor, nodeId: string) => {
  return (
    editor
      .getNodeGeometry(nodeId)
      ?.paths.map((path) => {
        const match = path.transform?.match(TRANSLATE_X_PATTERN);
        return match ? Number.parseFloat(match[1]) : null;
      })
      .filter((value): value is number => value !== null) ?? []
  );
};

describe("Editor text tracking", () => {
  test("resolves tracking relative to font size instead of raw pixels", () => {
    const editor = new Editor();

    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.fonts.cache.set(getLocalFontId(FONT), {
      descriptor: FONT,
      font: createFixedWidthLoadedFont(),
      status: "ready",
    });
    editor.getState().loadNodes([
      createTextNode({
        fontSize: 100,
        id: "small-base",
        text: "AA",
        tracking: 0,
      }),
      createTextNode({
        fontSize: 100,
        id: "small-tracked",
        text: "AA",
        tracking: 100,
      }),
      createTextNode({
        fontSize: 200,
        id: "large-base",
        text: "AA",
        tracking: 0,
      }),
      createTextNode({
        fontSize: 200,
        id: "large-tracked",
        text: "AA",
        tracking: 100,
      }),
    ]);

    const smallBaseGap =
      (getTranslateXs(editor, "small-base")[1] ?? 0) -
      (getTranslateXs(editor, "small-base")[0] ?? 0);
    const smallTrackedGap =
      (getTranslateXs(editor, "small-tracked")[1] ?? 0) -
      (getTranslateXs(editor, "small-tracked")[0] ?? 0);
    const largeBaseGap =
      (getTranslateXs(editor, "large-base")[1] ?? 0) -
      (getTranslateXs(editor, "large-base")[0] ?? 0);
    const largeTrackedGap =
      (getTranslateXs(editor, "large-tracked")[1] ?? 0) -
      (getTranslateXs(editor, "large-tracked")[0] ?? 0);

    expect(smallTrackedGap - smallBaseGap).toBeCloseTo(10, 2);
    expect(largeTrackedGap - largeBaseGap).toBeCloseTo(20, 2);
  });

  test("clamps extreme negative tracking before glyph order inverts and keeps text centered", () => {
    const editor = new Editor();
    const node = createTextNode({
      fontSize: 100,
      id: "clamped-tracking-node",
      text: "WIDE",
      tracking: TEXT_TRACKING_RANGE.min,
    });

    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.fonts.cache.set(getLocalFontId(FONT), {
      descriptor: FONT,
      font: createVariableWidthLoadedFont(),
      status: "ready",
    });
    editor.getState().loadNodes([node]);

    const baseXs = getTranslateXs(editor, node.id);
    const centerXs = [
      (baseXs[0] ?? 0) + VARIABLE_WIDTHS.W / 2,
      (baseXs[1] ?? 0) + VARIABLE_WIDTHS.I / 2,
      (baseXs[2] ?? 0) + VARIABLE_WIDTHS.D / 2,
      (baseXs[3] ?? 0) + VARIABLE_WIDTHS.E / 2,
    ];
    const centerGaps = centerXs.slice(1).map((centerX, index) => {
      return centerX - (centerXs[index] ?? 0);
    });
    const geometry = editor.getNodeGeometry(node.id);
    const centerX = geometry?.bbox
      ? (geometry.bbox.minX + geometry.bbox.maxX) / 2
      : null;

    expect(centerGaps).toHaveLength(3);
    expect(Math.min(...centerGaps)).toBeGreaterThanOrEqual(0);
    expect(centerX).not.toBeNull();

    if (centerX === null) {
      return;
    }

    expect(centerX).toBeCloseTo(0, 1);
  });

  test("keeps tracking unchanged when resizing text", () => {
    const editor = new Editor();
    const node = createTextNode({
      fontSize: 120,
      id: "resized-tracking-node",
      text: "HELLO",
      tracking: 250,
    });

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.5,
    });

    expect(editor.getNode(node.id)?.fontSize).toBeCloseTo(180, 2);
    expect(editor.getNode(node.id)?.tracking).toBe(250);
  });
});
