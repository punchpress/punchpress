import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import {
  getLocalFontId,
  MissingDocumentFontsError,
  PUNCH_DOCUMENT_VERSION,
} from "@punchpress/punch-schema";

const INTENDED_FONT = {
  family: "Fixture Serif",
  fullName: "Fixture Serif Regular",
  postscriptName: "FixtureSerif-Regular",
  style: "Regular",
};

const REPLACEMENT_FONT = {
  family: "Fixture Sans",
  fullName: "Fixture Sans Regular",
  postscriptName: "FixtureSans-Regular",
  style: "Regular",
};

const documentContents = JSON.stringify({
  nodes: [
    {
      fill: "#222222",
      font: INTENDED_FONT,
      fontSize: 120,
      id: "font-fixture",
      parentId: "root",
      stroke: null,
      strokeWidth: 0,
      text: "PRESERVE ME",
      tracking: 0,
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 100, y: 200 },
      type: "text",
      visible: true,
      warp: { kind: "none" },
    },
  ],
  version: PUNCH_DOCUMENT_VERSION,
});

const catalog = (state: "action-required" | "permission-denied" | "ready") => ({
  error: state === "permission-denied" ? "Local font access was denied." : "",
  fonts: [],
  state,
});

describe("unresolved document fonts", () => {
  test.each([
    "action-required",
    "permission-denied",
    "ready",
  ] as const)("preserves the intended font while the catalog is %s", (state) => {
    const editor = new Editor();
    editor.applyLocalFontCatalog(catalog(state));

    const resolution = editor.loadDocument(documentContents);

    expect(resolution.missingFonts).toEqual([INTENDED_FONT]);
    expect(resolution.replacementFont).toBeNull();
    expect(editor.getFontAvailability(INTENDED_FONT)).toBe(
      state === "ready" ? "missing" : state
    );
    expect(editor.nodes[0]?.font).toEqual(INTENDED_FONT);
    expect(JSON.parse(editor.serializeDocument()).nodes[0].font).toEqual(
      INTENDED_FONT
    );
  });

  test("later availability restores the intended font without changing saved data", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog(catalog("action-required"));
    editor.loadDocument(documentContents);
    const saved = editor.serializeDocument();

    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...INTENDED_FONT, id: "fixtureserif-regular" }],
      state: "ready",
    });

    expect(editor.availableFonts[0]?.postscriptName).toBe(
      INTENDED_FONT.postscriptName
    );
    expect(editor.getFontAvailability(INTENDED_FONT)).toBe("available");
    expect(editor.serializeDocument()).toBe(saved);

    const reopened = new Editor();
    reopened.applyLocalFontCatalog(catalog("permission-denied"));
    reopened.loadDocument(saved);
    expect(reopened.nodes[0]?.font).toEqual(INTENDED_FONT);
  });

  test("only an explicit font selection changes the document", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...REPLACEMENT_FONT, id: "fixturesans-regular" }],
      state: "ready",
    });
    editor.loadDocument(documentContents);

    editor.select("font-fixture");
    editor.setSelectionProperty("font", REPLACEMENT_FONT);

    expect(JSON.parse(editor.serializeDocument()).nodes[0].font).toEqual(
      REPLACEMENT_FONT
    );
  });

  test("does not reuse old glyphs when the same node loads an unresolved font", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...INTENDED_FONT, id: getLocalFontId(INTENDED_FONT) }],
      state: "ready",
    });
    editor.loadDocument(documentContents);
    editor.fonts.cache.set(getLocalFontId(INTENDED_FONT), {
      descriptor: INTENDED_FONT,
      font: {
        charToGlyph: () => ({
          advanceWidth: 500,
          getPath: () => ({
            commands: [
              { type: "M", x: 0, y: 0 },
              { type: "L", x: 40, y: 0 },
              { type: "L", x: 40, y: 80 },
              { type: "L", x: 0, y: 80 },
              { type: "Z" },
            ],
            toPathData: () => "M0 0L40 0L40 80L0 80Z",
          }),
        }),
        unitsPerEm: 1000,
      },
      status: "ready",
    });
    editor.getState().bumpFontRevision();
    expect(editor.getNodeRenderGeometry("font-fixture")?.ready).toBe(true);

    const missingDocument = JSON.parse(documentContents);
    missingDocument.nodes[0].font = REPLACEMENT_FONT;
    editor.loadDocument(JSON.stringify(missingDocument));

    const geometry = editor.getNodeRenderGeometry("font-fixture");
    expect(geometry?.ready).toBe(false);
    expect(
      editor.getTextFallbackPreview(editor.nodes[0], geometry)
    ).not.toBeNull();
  });

  test("export remains blocked until the intended font becomes available", async () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog(catalog("action-required"));
    editor.loadDocument(documentContents);

    await expect(editor.exportDocument()).rejects.toThrow(
      MissingDocumentFontsError
    );
  });
});
