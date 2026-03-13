import { describe, expect, test } from "bun:test";
import { MissingDocumentFontsError } from "../document/errors";
import { Editor } from "./editor";

const AVAILABLE_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

const MISSING_FONT = {
  family: "Missing Font",
  fullName: "Missing Font",
  postscriptName: "MissingFont-Regular",
  style: "Regular",
} as const;

const createDocument = (
  id: string,
  text: string,
  font = MISSING_FONT,
  version = "1.1"
) => {
  return JSON.stringify({
    nodes: [
      {
        fill: "#000000",
        fontSize: 120,
        font,
        id,
        stroke: null,
        strokeWidth: 0,
        text,
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "none",
        },
      },
    ],
    version,
  });
};

describe("Editor.loadDocument", () => {
  test("replaces the current document and clears transient selection state", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("first-node", "FIRST", AVAILABLE_FONT));
    editor.getState().selectNode("first-node");
    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.nodes).toHaveLength(2);
    expect(editor.selectedNodeIds.length).toBeGreaterThan(0);

    editor.loadDocument(createDocument("second-node", "SECOND", AVAILABLE_FONT));

    expect(
      editor.nodes.map((node) => ({
        id: node.id,
        text: node.text,
      }))
    ).toEqual([
      {
        id: "second-node",
        text: "SECOND",
      },
    ]);
    expect(editor.getNode("first-node")).toBeNull();
    expect(editor.selectedNodeIds).toEqual([]);
    expect(editor.selectedNodeId).toBeNull();
  });

  test("replaces missing fonts with the resolved default font on import", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    const resolution = editor.loadDocument(
      createDocument("missing-font-node", "TEST")
    );

    expect(resolution.missingFonts).toEqual([MISSING_FONT]);
    expect(resolution.replacementFont).toEqual(AVAILABLE_FONT);
    expect(editor.nodes[0]?.font).toEqual(AVAILABLE_FONT);
  });
});

describe("Editor.exportDocument", () => {
  test("throws a missing-font error before export when a node uses an unavailable font", async () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.getState().loadNodes([
      {
        fill: "#000000",
        font: MISSING_FONT,
        fontSize: 120,
        id: "missing-font-node",
        stroke: null,
        strokeWidth: 0,
        text: "TEST",
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "none",
        },
      },
    ]);

    await expect(editor.exportDocument()).rejects.toThrow(MissingDocumentFontsError);
  });
});

describe("Editor.getSelectionFrameKey", () => {
  test("updates the selection frame key when selected text geometry changes", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("selected-node", "HEYHEYHEYHEY"));
    editor.getState().selectNode("selected-node");

    const beforeKey = editor.getSelectionFrameKey();

    editor.updateSelectedNode({ text: "HEY" });

    expect(editor.getSelectionFrameKey()).not.toBe(beforeKey);
  });
});
