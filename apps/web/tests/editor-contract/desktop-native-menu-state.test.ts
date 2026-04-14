import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { getDesktopAppMenuState } from "../../src/platform/desktop-menu/desktop-native-menu-state";

const createShapeNode = (id: string) => {
  return {
    cornerRadius: 24,
    fill: "#000000",
    height: 160,
    id,
    parentId: "root",
    shape: "polygon" as const,
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 600,
      y: 450,
    },
    type: "shape" as const,
    visible: true,
    width: 260,
  };
};

describe("desktop native menu state", () => {
  test("enables path editing for editable shape selections", () => {
    const editor = new Editor();
    const shapeNode = createShapeNode("shape-node");

    editor.getState().loadNodes([shapeNode]);
    editor.select(shapeNode.id);

    expect(getDesktopAppMenuState(editor, [shapeNode.id])).toEqual({
      canDelete: true,
      canEditPath: true,
      selectedNodeType: "shape",
      selectionKind: "single",
      vectorStyle: null,
    });
  });
});
