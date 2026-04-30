import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { getLocalFontId } from "@punchpress/punch-schema";

const FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;
const TRANSLATE_X_REGEX = /^translate\(([-\d.]+)/;

const createSquarePathNode = () => ({
  closed: true,
  fill: "#111111",
  fillRule: "nonzero" as const,
  id: "square",
  parentId: "root",
  segments: [
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -80, y: -80 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 80, y: -80 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 80, y: 80 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -80, y: 80 },
      pointType: "corner" as const,
    },
  ],
  stroke: "#111111",
  strokeLineCap: "round" as const,
  strokeLineJoin: "round" as const,
  strokeMiterLimit: 4,
  strokeWidth: 0,
  transform: {
    rotation: 32,
    scaleX: 1.35,
    scaleY: 1.35,
    x: 458,
    y: 328,
  },
  type: "path" as const,
  visible: true,
});

const createEllipseShapeNode = () => ({
  cornerRadius: 0,
  fill: "#111111",
  height: 100,
  id: "ellipse",
  parentId: "root",
  shape: "ellipse" as const,
  stroke: "none",
  strokeWidth: 0,
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 500,
    y: 360,
  },
  type: "shape" as const,
  visible: true,
  width: 200,
});

const createLoadedFont = () => {
  return {
    charToGlyph: (char: string) => ({
      advanceWidth: char === " " ? 900 : 500,
      getPath: (_x: number, _y: number, fontSize: number) => {
        if (char === " ") {
          return {
            commands: [],
            toPathData: () => "",
          };
        }

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

const createTrackedTextNode = (text = "AA") => ({
  fill: "#111111",
  font: FONT,
  fontSize: 100,
  id: "text",
  parentId: "root",
  stroke: null,
  strokeWidth: 0,
  text,
  tracking: 200,
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 500,
    y: 360,
  },
  type: "text" as const,
  visible: true,
  warp: {
    kind: "none" as const,
  },
});

const getTranslateX = (value: string | undefined) => {
  const match = value?.match(TRANSLATE_X_REGEX);

  return match ? Number.parseFloat(match[1]) : null;
};

const loadTrackedTextNode = (editor: Editor, text: string) => {
  editor.applyLocalFontCatalog({
    error: "",
    fonts: [{ ...FONT, id: "arialmt" }],
    state: "ready",
  });
  editor.fonts.cache.set(getLocalFontId(FONT), {
    descriptor: FONT,
    font: createLoadedFont(),
    status: "ready",
  });
  editor.getState().loadNodes([createTrackedTextNode(text)]);
};

describe("node geometry hit testing", () => {
  test("path hits use transformed node geometry instead of stale local bounds", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createSquarePathNode()]);

    expect(editor.hitTestNodePoint("square", { x: 377.86, y: 277.92 })).toBe(
      true
    );
    expect(editor.hitTestNodePoint("square", { x: 350, y: 220 })).toBe(false);
  });

  test("shape hits use the painted ellipse instead of its bounding box", () => {
    const editor = new Editor();

    editor.getState().loadNodes([createEllipseShapeNode()]);

    expect(editor.hitTestNodePoint("ellipse", { x: 500, y: 360 })).toBe(true);
    expect(editor.hitTestNodePoint("ellipse", { x: 590, y: 320 })).toBe(false);
  });

  test("text hits bridge gaps between adjacent letters in a word", () => {
    const editor = new Editor();

    loadTrackedTextNode(editor, "AA");

    const geometry = editor.getNodeGeometry("text");
    const firstTranslateX = getTranslateX(geometry?.paths[0]?.transform);
    const secondTranslateX = getTranslateX(geometry?.paths[1]?.transform);

    if (!(geometry && firstTranslateX !== null && secondTranslateX !== null)) {
      throw new Error("Expected loaded text geometry");
    }

    const glyphHitPoint = {
      x: 500 + firstTranslateX + 20,
      y: 360 - 30,
    };
    const nearGapHitPoint = {
      x: 500 + firstTranslateX + 45,
      y: 360 - 30,
    };
    const gapHitPoint = {
      x: 500 + (firstTranslateX + 40 + secondTranslateX) / 2,
      y: 360 - 30,
    };

    expect(editor.hitTestNodePoint("text", glyphHitPoint)).toBe(true);
    expect(editor.hitTestNodePoint("text", nearGapHitPoint)).toBe(true);
    expect(editor.hitTestNodePoint("text", gapHitPoint)).toBe(true);
  });

  test("text hits still fall through actual whitespace gaps", () => {
    const editor = new Editor();

    loadTrackedTextNode(editor, "A A");

    const geometry = editor.getNodeGeometry("text");
    const spaceTranslateX = getTranslateX(geometry?.paths[1]?.transform);

    if (!(geometry && spaceTranslateX !== null)) {
      throw new Error("Expected loaded text geometry with whitespace glyph");
    }

    const whitespaceGapPoint = {
      x: 500 + spaceTranslateX + 45,
      y: 360 - 30,
    };

    expect(editor.hitTestNodePoint("text", whitespaceGapPoint)).toBe(false);
  });
});
