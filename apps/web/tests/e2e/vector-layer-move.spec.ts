import { expect, test } from "@playwright/test";
import {
  dragLayerOnto,
  getDebugDump,
  gotoEditor,
  loadDocument,
} from "./helpers/editor";

const VECTOR_LAYER_MOVE_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "source-vector",
      name: "Source Vector",
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
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "source-path",
      parentId: "source-vector",
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
          point: { x: 120, y: 0 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 120, y: 80 },
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
        x: 180,
        y: 180,
      },
      type: "path",
      visible: true,
    },
    {
      id: "target-vector",
      name: "Target Vector",
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
  ],
  version: "1.6",
});

test("dragging a path onto another vector reparents it and deletes the emptied source vector", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, VECTOR_LAYER_MOVE_DOCUMENT);

  await dragLayerOnto(page, "Path 1", "Target Vector");

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        childIds: dump?.nodes
          ?.filter((node) => node.parentId === "target-vector")
          .map((node) => node.id),
        hasSourceVector: dump?.nodes?.some(
          (node) => node.id === "source-vector"
        ),
        sourcePathParentId:
          dump?.nodes?.find((node) => node.id === "source-path")?.parentId ||
          null,
      };
    })
    .toEqual({
      childIds: ["source-path"],
      hasSourceVector: false,
      sourcePathParentId: "target-vector",
    });
});
