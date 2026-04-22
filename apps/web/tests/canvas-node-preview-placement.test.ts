import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { resolvePreviewPlacementNodeIds } from "../src/components/canvas/canvas-node-preview-placement";

describe("canvas node preview placement", () => {
  test("maps a single-child vector preview onto the rendered vector node", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "vector-1",
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
        id: "path-1",
        parentId: "vector-1",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 100 },
            pointType: "corner",
          },
        ],
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 150,
        },
        type: "path",
        visible: true,
      },
    ]);

    expect(
      resolvePreviewPlacementNodeIds(editor, ["vector-1"], ["path-1"])
    ).toEqual(["vector-1"]);
  });

  test("maps vector child preview ids onto the rendered vector node when the full vector is previewing", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "vector-1",
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
        id: "path-1",
        parentId: "vector-1",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 100 },
            pointType: "corner",
          },
        ],
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 150,
        },
        type: "path",
        visible: true,
      },
      {
        closed: true,
        fill: "#00ff00",
        fillRule: "evenodd",
        id: "path-2",
        parentId: "vector-1",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 20, y: 20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 80, y: 20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 80, y: 80 },
            pointType: "corner",
          },
        ],
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 150,
        },
        type: "path",
        visible: true,
      },
    ]);

    expect(
      resolvePreviewPlacementNodeIds(editor, ["vector-1"], ["path-1", "path-2"])
    ).toEqual(["vector-1"]);
  });

  test("does not map a path-editing child drag onto the vector shell", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "vector-1",
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
        id: "path-1",
        parentId: "vector-1",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 100 },
            pointType: "corner",
          },
        ],
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 150,
        },
        type: "path",
        visible: true,
      },
      {
        closed: true,
        fill: "#00ff00",
        fillRule: "evenodd",
        id: "path-2",
        parentId: "vector-1",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 20, y: 20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 80, y: 20 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 80, y: 80 },
            pointType: "corner",
          },
        ],
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 150,
        },
        type: "path",
        visible: true,
      },
    ]);

    editor.startPathEditing("vector-1");

    expect(
      resolvePreviewPlacementNodeIds(editor, ["vector-1"], ["path-1"])
    ).toEqual([]);
  });

  test("keeps regular rendered leaf nodes unchanged", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        closed: true,
        fill: "#ff0000",
        fillRule: "nonzero",
        id: "path-1",
        parentId: "root",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 0, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 50, y: 0 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 50, y: 50 },
            pointType: "corner",
          },
        ],
        stroke: null,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 20,
          y: 30,
        },
        type: "path",
        visible: true,
      },
    ]);

    expect(
      resolvePreviewPlacementNodeIds(editor, ["path-1"], ["path-1"])
    ).toEqual(["path-1"]);
  });
});
