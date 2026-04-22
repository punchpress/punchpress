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
      compoundOperation: null,
      canMakeCompoundPath: false,
      canReleaseCompoundPath: false,
      selectedNodeType: "shape",
      selectionKind: "single",
      vectorStyle: null,
    });
  });

  test("enables compound path commands for a selected vector with eligible child paths", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "vector-node",
        name: "Vector",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "vector",
        visible: true,
      },
      {
        closed: true,
        fill: "#ff0000",
        fillRule: "evenodd",
        id: "vector-node-path-1",
        parentId: "vector-node",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -40, y: -40 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 40, y: -40 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 40, y: 40 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -40, y: 40 },
            pointType: "corner",
          },
        ],
        stroke: "#000000",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 3,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 200,
        },
        type: "path",
        visible: true,
      },
      {
        closed: true,
        fill: "#ff0000",
        fillRule: "evenodd",
        id: "vector-node-path-2",
        parentId: "vector-node",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -20, y: -20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 20, y: -20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 20, y: 20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -20, y: 20 },
            pointType: "corner",
          },
        ],
        stroke: "#000000",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 3,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 200,
        },
        type: "path",
        visible: true,
      },
    ] as never);

    editor.select("vector-node");

    expect(getDesktopAppMenuState(editor, ["vector-node"])).toMatchObject({
      compoundOperation: null,
      canMakeCompoundPath: true,
      canReleaseCompoundPath: false,
      selectedNodeType: "vector",
    });

    editor.makeCompoundPath(["vector-node"]);

    expect(getDesktopAppMenuState(editor, ["vector-node"])).toMatchObject({
      compoundOperation: {
        enabled: true,
        isMixed: false,
        value: "unite",
      },
      canMakeCompoundPath: false,
      canReleaseCompoundPath: true,
      selectedNodeType: "vector",
    });

    editor.setVectorPathComposition("vector-node", "subtract");

    expect(getDesktopAppMenuState(editor, ["vector-node"])).toMatchObject({
      compoundOperation: {
        enabled: true,
        isMixed: false,
        value: "subtract",
      },
    });

    editor.startPathEditing("vector-node");

    expect(
      getDesktopAppMenuState(editor, editor.selectedNodeIds)
    ).toMatchObject({
      compoundOperation: {
        enabled: true,
        isMixed: false,
        value: "subtract",
      },
    });
  });
});
