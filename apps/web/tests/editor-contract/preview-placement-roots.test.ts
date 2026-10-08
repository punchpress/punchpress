import { describe, expect, test } from "bun:test";
import {
  createSolidAppearance,
  Editor,
  type PreviewPresentationPlan,
} from "@punchpress/engine";

const describeTargets = (plan: PreviewPresentationPlan) => {
  return plan.targets.map((target) => `${target.kind}:${target.nodeId}`);
};

describe("preview placement roots", () => {
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
        appearance: createSolidAppearance({ fill: "#ff0000" }),
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
      describeTargets(
        editor.getPreviewPresentationPlan({
          nodeIds: ["path-1"],
        })
      )
    ).toEqual(["shell:vector-1"]);
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
        appearance: createSolidAppearance({ fill: "#ff0000" }),
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
        appearance: createSolidAppearance({ fill: "#00ff00" }),
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
      describeTargets(
        editor.getPreviewPresentationPlan({
          nodeIds: ["path-1", "path-2"],
        })
      )
    ).toEqual(["shell:vector-1"]);
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
        appearance: createSolidAppearance({ fill: "#ff0000" }),
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
        appearance: createSolidAppearance({ fill: "#00ff00" }),
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
      describeTargets(
        editor.getPreviewPresentationPlan({
          nodeIds: ["path-1"],
        })
      )
    ).toEqual([]);
  });

  test("keeps regular rendered leaf nodes unchanged", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        closed: true,
        appearance: createSolidAppearance({ fill: "#ff0000" }),
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
      describeTargets(
        editor.getPreviewPresentationPlan({
          nodeIds: ["path-1"],
        })
      )
    ).toEqual(["shell:path-1"]);
  });

  test("maps a selected container resize preview onto visible descendants", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "group-1",
        name: "Imported SVG",
        parentId: "root",
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
        closed: true,
        appearance: createSolidAppearance({ fill: "#ff0000" }),
        fillRule: "nonzero",
        id: "path-1",
        parentId: "group-1",
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
      describeTargets(
        editor.getPreviewPresentationPlan({
          effectiveNodeIdSet: new Set(["path-1"]),
          nodeIds: ["group-1"],
        })
      )
    ).toEqual(["shell:path-1"]);
    // A translation moves the fully covered group as one layer instead.
    expect(
      describeTargets(
        editor.getPreviewPresentationPlan({
          delta: { x: 4, y: 0 },
          effectiveNodeIdSet: new Set(["path-1"]),
          nodeIds: ["group-1"],
        })
      )
    ).toEqual(["layer:group-1"]);
  });
});
