import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

describe("Editor node placement", () => {
  test("click placement keeps the default shape size", () => {
    const editor = new Editor();

    editor.setActiveTool("shape");

    const session = editor.beginNodePlacement({
      point: { x: 120, y: 240 },
      shape: "rectangle",
      type: "shape",
    });

    expect(session).not.toBeNull();

    session?.complete({
      dragDistancePx: 0,
      point: { x: 120, y: 240 },
    });

    expect(editor.activeTool).toBe("pointer");
    expect(editor.selectedNode).toMatchObject({
      height: 180,
      shape: "rectangle",
      type: "shape",
      width: 280,
    });
    expect(editor.selectedNode?.transform).toMatchObject({
      x: 120,
      y: 240,
    });
  });

  test("drag placement sizes the shape from the dragged box", () => {
    const editor = new Editor();

    editor.setActiveTool("shape");

    const session = editor.beginNodePlacement({
      point: { x: 150, y: 200 },
      shape: "rectangle",
      type: "shape",
    });

    expect(session).not.toBeNull();
    expect(editor.nodes).toHaveLength(0);

    session?.update({
      dragDistancePx: 2,
      point: { x: 151, y: 201 },
    });

    expect(editor.nodes).toHaveLength(0);

    session?.update({
      dragDistancePx: 120,
      point: { x: 360, y: 420 },
    });

    expect(editor.nodes).toHaveLength(1);

    session?.complete({
      dragDistancePx: 120,
      point: { x: 360, y: 420 },
    });

    expect(editor.activeTool).toBe("pointer");
    expect(editor.selectedNode).toMatchObject({
      height: 220,
      shape: "rectangle",
      type: "shape",
      width: 210,
    });
    expect(editor.selectedNode?.transform).toMatchObject({
      x: 255,
      y: 310,
    });
  });

  test("drag placement keeps the placed shape centered inside the dragged box", () => {
    const editor = new Editor();

    editor.setActiveTool("shape");

    const session = editor.beginNodePlacement({
      point: { x: 360, y: 420 },
      shape: "ellipse",
      type: "shape",
    });

    expect(session).not.toBeNull();

    session?.update({
      dragDistancePx: 120,
      point: { x: 150, y: 200 },
    });
    session?.complete({
      dragDistancePx: 120,
      point: { x: 150, y: 200 },
    });

    expect(editor.selectedNode).toMatchObject({
      height: 220,
      shape: "ellipse",
      type: "shape",
      width: 210,
    });
    expect(editor.selectedNode?.transform).toMatchObject({
      x: 255,
      y: 310,
    });
  });

  test("holding shift during drag placement locks the shape to a square", () => {
    const editor = new Editor();

    editor.setActiveTool("shape");

    const session = editor.beginNodePlacement({
      point: { x: 150, y: 200 },
      shape: "rectangle",
      type: "shape",
    });

    expect(session).not.toBeNull();

    session?.update({
      dragDistancePx: 120,
      point: { x: 360, y: 420 },
      preserveAspectRatio: true,
    });
    session?.complete({
      dragDistancePx: 120,
      point: { x: 360, y: 420 },
      preserveAspectRatio: true,
    });

    expect(editor.selectedNode).toMatchObject({
      height: 220,
      shape: "rectangle",
      type: "shape",
      width: 220,
    });
    expect(editor.selectedNode?.transform).toMatchObject({
      x: 260,
      y: 310,
    });
  });

  test("click placement creates and selects a vector node", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");

    const session = editor.beginNodePlacement({
      point: { x: 180, y: 260 },
      type: "vector",
    });

    expect(session).not.toBeNull();
    expect(editor.nodes).toHaveLength(0);

    session?.complete({
      dragDistancePx: 0,
      point: { x: 180, y: 260 },
    });

    expect(editor.activeTool).toBe("pointer");
    expect(editor.selectedNode).toMatchObject({
      type: "vector",
    });
    expect(editor.selectedNodeIds).toEqual([editor.selectedNodeId]);
    expect(editor.selectedNode?.transform).toMatchObject({
      x: 180,
      y: 260,
    });
  });
});
