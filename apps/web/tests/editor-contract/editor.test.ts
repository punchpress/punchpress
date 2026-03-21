import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { MissingDocumentFontsError } from "@punchpress/punch-schema";

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

const createCircleDocument = (id: string, pathPosition?: number) => {
  return JSON.stringify({
    nodes: [
      {
        fill: "#000000",
        font: AVAILABLE_FONT,
        fontSize: 120,
        id,
        parentId: "root",
        stroke: null,
        strokeWidth: 0,
        text: "CIRCLE",
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
          kind: "circle",
          ...(pathPosition === undefined ? {} : { pathPosition }),
          radius: 900,
          sweepDeg: 140,
        },
      },
    ],
    version: "1.3",
  });
};

describe("Editor.loadDocument", () => {
  test("replaces the current document and clears transient selection state", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("first-node", "FIRST", AVAILABLE_FONT));
    editor.select("first-node");
    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.nodes).toHaveLength(2);
    expect(editor.selectedNodeIds.length).toBeGreaterThan(0);

    editor.loadDocument(
      createDocument("second-node", "SECOND", AVAILABLE_FONT)
    );

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

  test("fills in the default circle path position when older documents omit it", () => {
    const editor = new Editor();

    editor.loadDocument(createCircleDocument("circle-node"));

    expect(editor.nodes[0]?.warp).toEqual({
      kind: "circle",
      pathPosition: 0,
      radius: 900,
      sweepDeg: 140,
    });
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

    await expect(editor.exportDocument()).rejects.toThrow(
      MissingDocumentFontsError
    );
  });
});

describe("Editor.getSelectionFrameKey", () => {
  test("updates the selection frame key when selected text geometry changes", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("selected-node", "HEYHEYHEYHEY"));
    editor.select("selected-node");

    const beforeKey = editor.getSelectionFrameKey();

    editor.updateSelectedNode({ text: "HEY" });

    expect(editor.getSelectionFrameKey()).not.toBe(beforeKey);
  });
});

describe("Editor text editing mode", () => {
  test("switches back to the pointer tool when placing a text node", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    editor.setActiveTool("text");
    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.activeTool).toBe("pointer");
    expect(editor.editingNodeId).not.toBeNull();
    expect(editor.selectedNodeIds).toEqual([editor.editingNodeId]);
  });

  test("keeps the pointer tool active when opening an existing text node for editing", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.loadDocument(createDocument("editing-node", "EDIT", AVAILABLE_FONT));
    editor.setActiveTool("text");

    editor.startEditing(editor.getNode("editing-node"));

    expect(editor.activeTool).toBe("pointer");
    expect(editor.editingNodeId).toBe("editing-node");
  });
});

describe("Editor.getDebugDump", () => {
  test("returns a normalized snapshot of document, node, and selection state", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.loadDocument(createDocument("debug-node", "DEBUG", AVAILABLE_FONT));
    editor.select("debug-node");

    const dump = editor.getDebugDump();

    expect(dump.bootstrap.fontCatalogState).toBe("ready");
    expect(dump.document.nodeCount).toBe(1);
    expect(dump.document.version).toBe("1.3");
    expect(dump.nodes).toHaveLength(1);
    expect(dump.nodes[0]?.id).toBe("debug-node");
    expect(dump.nodes[0]?.text).toBe("DEBUG");
    expect(dump.nodes[0]?.transform).toEqual({
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 100,
      y: 200,
    });
    expect(dump.nodes[0]?.frame).not.toBeNull();
    expect(dump.selection.ids).toEqual(["debug-node"]);
    expect(dump.selection.primaryId).toBe("debug-node");
    expect(dump.selection.bounds?.minX).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.minX ?? 0,
      6
    );
    expect(dump.selection.bounds?.minY).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.minY ?? 0,
      6
    );
    expect(dump.selection.bounds?.maxX).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.maxX ?? 0,
      6
    );
    expect(dump.selection.bounds?.maxY).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.maxY ?? 0,
      6
    );
    expect(dump.selection.handleRects).toEqual({
      ne: null,
      nw: null,
      se: null,
      sw: null,
    });
  });

  test("does not finalize editing when producing the dump", () => {
    const editor = new Editor();
    editor.loadDocument(
      createDocument("editing-node", "ORIGINAL", AVAILABLE_FONT)
    );

    editor.startEditing(editor.getNode("editing-node"));
    editor.setEditingText("WORK IN PROGRESS");

    const dump = editor.getDebugDump();

    expect(editor.editingNodeId).toBe("editing-node");
    expect(dump.editing.nodeId).toBe("editing-node");
    expect(dump.editing.text).toBe("WORK IN PROGRESS");
    expect(JSON.parse(dump.document.serialized).nodes[0]?.text).toBe(
      "WORK IN PROGRESS"
    );
  });
});
