import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { getArtboardClipPath } from "../src/components/canvas/artboard-clip-path";

describe("artboard clip path", () => {
  test("clips nested descendants to their nearest artboard ancestor", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        background: "#ffffff",
        height: 200,
        id: "artboard-1",
        locked: false,
        name: "Artboard 1",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "artboard",
        visible: true,
        width: 200,
      },
      {
        id: "group-1",
        name: "Group 1",
        parentId: "artboard-1",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "group",
        visible: true,
      },
      {
        cornerRadius: 0,
        fill: "#3366ff",
        height: 180,
        id: "shape-1",
        parentId: "group-1",
        shape: "polygon",
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 100,
        },
        type: "shape",
        visible: true,
        width: 280,
      },
    ]);

    const bounds = editor.getNodeRenderFrame("shape-1")?.bounds;

    expect(bounds).not.toBeNull();
    expect(getArtboardClipPath(editor, "shape-1", bounds)).toBe(
      "inset(0px 40px 0px 40px)"
    );
  });
});
