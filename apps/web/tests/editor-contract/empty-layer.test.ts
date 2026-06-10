import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { designDocumentSchema } from "@punchpress/punch-schema";

const createKeyEvent = (patch = {}) => {
  let prevented = false;

  return {
    event: {
      altKey: false,
      code: "",
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => {
        prevented = true;
      },
      shiftKey: false,
      ...patch,
    },
    wasPrevented: () => prevented,
  };
};

describe("empty layers", () => {
  test("new layer starts empty and persists in the document", () => {
    const editor = new Editor();
    const nodeId = editor.addEmptyLayer();

    expect(nodeId).toBeTruthy();
    expect(editor.selectedNodeIds).toEqual([nodeId]);

    const node = editor.getNode(nodeId);

    expect(node).toMatchObject({
      name: "Layer 1",
      parentId: "root",
      type: "empty",
      visible: true,
    });
    expect(editor.getNodeFrame(nodeId)).toBeNull();
    expect(editor.getLayerRow(nodeId)).toMatchObject({
      isEmpty: true,
      label: "Layer 1",
    });
    expect(editor.getLayerRow(nodeId)?.node.type).toBe("empty");
    expect(() => editor.getDebugDump()).not.toThrow();
    expect(editor.getDebugDump().nodes[0]).toMatchObject({
      id: nodeId,
      rotation: 0,
      transform: null,
      type: "empty",
    });

    const serializedDocument = editor.serializeDocument();
    const parsedDocument = JSON.parse(serializedDocument);

    expect(designDocumentSchema.safeParse(parsedDocument).success).toBe(true);

    const loadedEditor = new Editor();
    loadedEditor.loadDocument(serializedDocument);

    expect(loadedEditor.getNode(nodeId)).toMatchObject({
      name: "Layer 1",
      type: "empty",
    });
  });

  test("cmd shift n creates an empty layer", () => {
    const editor = new Editor();
    const { event, wasPrevented } = createKeyEvent({
      code: "KeyN",
      metaKey: true,
      shiftKey: true,
    });

    expect(editor.handleCanvasShortcutKeyDown(event, "n")).toBe(true);
    expect(wasPrevented()).toBe(true);
    expect(editor.nodes).toHaveLength(1);
    expect(editor.nodes[0]).toMatchObject({
      name: "Layer 1",
      type: "empty",
    });
  });

  test("brush and eraser shortcuts select raster tools", () => {
    const editor = new Editor();
    const brushKey = createKeyEvent({ code: "KeyB", key: "b" });
    const eraserKey = createKeyEvent({ code: "KeyE", key: "e" });

    expect(
      editor.currentTool.onKeyDown({ event: brushKey.event, key: "b" })
    ).toBe(true);

    expect(editor.activeTool).toBe("brush");

    expect(
      editor.currentTool.onKeyDown({ event: eraserKey.event, key: "e" })
    ).toBe(true);

    expect(editor.activeTool).toBe("eraser");
  });
});
