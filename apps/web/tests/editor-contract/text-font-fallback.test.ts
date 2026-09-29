import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { DEFAULT_LOCAL_FONT, getLocalFontId } from "@punchpress/punch-schema";

const MISSING_FONT = {
  family: "Missing Font",
  fullName: "Missing Font Regular",
  postscriptName: "MissingFont-Regular",
  style: "Regular",
} as const;

const createTextNode = (font = MISSING_FONT) => ({
  fill: "#000000",
  font,
  fontSize: 64,
  id: "fallback-text",
  parentId: "root",
  stroke: "#000000",
  strokeWidth: 3,
  text: "PRINT",
  tracking: 0,
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 100,
    y: 200,
  },
  type: "text" as const,
  visible: true,
  warp: {
    bend: 0.4,
    kind: "arch" as const,
  },
});

describe("text font fallback", () => {
  test("uses the bundled sans font as the default descriptor", () => {
    expect(DEFAULT_LOCAL_FONT).toEqual({
      family: "Source Sans Pro",
      fullName: "Source Sans Pro",
      postscriptName: "SourceSansPro-Regular",
      style: "Regular",
    });

    expect(new Editor().getDefaultFont()).toEqual(DEFAULT_LOCAL_FONT);
  });

  test("keeps the bundled font available when local access is denied", () => {
    const editor = new Editor();
    editor.setBundledFonts([DEFAULT_LOCAL_FONT]);
    editor.applyLocalFontCatalog({
      error: "Local font access was denied.",
      fonts: [],
      state: "permission-denied",
    });

    expect(editor.getFontAvailability(DEFAULT_LOCAL_FONT)).toBe("available");
    expect(editor.availableFonts.map((font) => getLocalFontId(font))).toEqual([
      getLocalFontId(DEFAULT_LOCAL_FONT),
    ]);
  });

  test("does not let an unavailable legacy last-used font override the bundled default", () => {
    const editor = new Editor();
    editor.setLastUsedFont({
      family: "System UI",
      fullName: "System UI",
      postscriptName: "system-ui",
      style: "Regular",
    });

    editor.setBundledFonts([DEFAULT_LOCAL_FONT]);

    expect(editor.getDefaultFont()).toEqual(DEFAULT_LOCAL_FONT);
  });

  test("keeps unresolved fallback geometry ready for an explicit unavailable state", () => {
    const editor = new Editor();
    const node = createTextNode();

    editor.getState().loadNodes([node]);

    const geometry = editor.getNodeGeometry(node.id);

    expect(geometry?.ready).toBe(false);
    expect(geometry?.guide?.kind).toBe("arch");
    expect(geometry?.bbox?.minY).toBe(-0.9 * node.fontSize);
    expect(geometry?.bbox?.maxY).toBe(0.1 * node.fontSize);
    expect(editor.getTextFallbackPreview(node, geometry)).toMatchObject({
      baselineOffset: -0.18 * node.fontSize,
      fontSize: node.fontSize,
      text: node.text,
    });
  });
});
