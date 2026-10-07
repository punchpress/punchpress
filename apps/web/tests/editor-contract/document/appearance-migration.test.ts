import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import {
  PUNCH_CLIPBOARD_MIME_TYPE,
  PUNCH_DOCUMENT_VERSION,
  parseClipboardContent,
  parseDesignDocument,
  UnsupportedDocumentVersionError,
} from "@punchpress/punch-schema";

const transform = { rotation: 0, scaleX: 1, scaleY: 1, x: 10, y: 20 };

const legacyText = {
  fill: "#FFFFFF",
  font: {
    family: "Source Sans Pro",
    fullName: "Source Sans Pro",
    postscriptName: "SourceSansPro-Regular",
    style: "Regular",
  },
  fontSize: 100,
  id: "text",
  opacity: 1,
  parentId: "root",
  stroke: "#000000",
  strokeWidth: 3,
  text: "Hello",
  tracking: 0,
  transform,
  type: "text",
  visible: true,
  warp: { kind: "none" },
};

const legacyShape = {
  fill: "rgba(255, 0, 0, 0.5)",
  height: 100,
  id: "shape",
  opacity: 1,
  parentId: "root",
  shape: "ellipse",
  stroke: null,
  strokeWidth: 0,
  transform,
  type: "shape",
  visible: true,
  width: 100,
};

const legacyPath = {
  contours: [
    {
      closed: true,
      segments: [0, 1, 2].map((index) => ({
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: index * 10, y: index % 2 },
        pointType: "corner",
      })),
    },
  ],
  fill: "none",
  fillRule: "evenodd",
  id: "path",
  opacity: 1,
  parentId: "root",
  stroke: "#00ff00",
  strokeLineCap: "square",
  strokeLineJoin: "bevel",
  strokeMiterLimit: 0,
  strokeWidth: 2,
  transform,
  type: "path",
  visible: true,
};

const legacyDocument = (nodes: unknown[], version = "1.8") => {
  return JSON.stringify({ assets: {}, nodes, version });
};

describe("1.8 → 1.9 appearance migration", () => {
  test("folds flat paint into canonical stacks for every paint family", () => {
    const document = parseDesignDocument(
      legacyDocument([legacyText, legacyShape, legacyPath])
    );
    const [text, shape, path] = document.nodes as Record<string, any>[];

    expect(document.version).toBe(PUNCH_DOCUMENT_VERSION);
    expect(text.appearance).toEqual({
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
    });
    expect(text).not.toHaveProperty("fill");
    expect(shape.appearance.fills[0]).toMatchObject({
      opacity: 0.5,
      paint: { color: "#ff0000" },
    });
    expect(shape.appearance.strokes).toEqual([]);
    expect(path.appearance.fills).toEqual([]);
    expect(path.appearance.strokes[0]).toMatchObject({
      cap: "square",
      join: "bevel",
      miterLimit: 4,
    });
    expect(path).not.toHaveProperty("strokeLineCap");
  });

  test("a migrated document saves and reloads unchanged, and loading resets history", () => {
    const editor = new Editor();

    editor.loadDocument(legacyDocument([legacyShape]));

    const saved = editor.serializeDocument();

    expect(JSON.parse(saved).version).toBe(PUNCH_DOCUMENT_VERSION);
    expect(parseDesignDocument(saved).nodes).toEqual(
      parseDesignDocument(legacyDocument([legacyShape])).nodes
    );
    expect(editor.canUndo).toBe(false);
  });

  test("1.7 and older stay unsupported", () => {
    expect(() =>
      parseDesignDocument(legacyDocument([legacyShape], "1.7"))
    ).toThrow(UnsupportedDocumentVersionError);
  });

  test("1.9 documents reject leftover flat paint fields", () => {
    expect(() =>
      parseDesignDocument(
        legacyDocument(
          [{ ...legacyShape, appearance: { fills: [], strokes: [] } }],
          PUNCH_DOCUMENT_VERSION
        )
      )
    ).toThrow();
  });

  test("clipboard payloads from a 1.8 build upgrade on paste", () => {
    const content = parseClipboardContent(
      JSON.stringify({
        documentVersion: "1.8",
        nodes: [legacyShape],
        rootNodeIds: ["shape"],
        type: PUNCH_CLIPBOARD_MIME_TYPE,
        version: 1,
      })
    );

    expect(content.documentVersion).toBe(PUNCH_DOCUMENT_VERSION);
    expect(content.nodes[0]).toMatchObject({
      appearance: { fills: [{ opacity: 0.5, paint: { color: "#ff0000" } }] },
    });
  });
});
