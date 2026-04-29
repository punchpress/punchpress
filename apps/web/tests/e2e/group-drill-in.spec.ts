import { expect, test } from "@playwright/test";
import {
  clickEmptyCanvas,
  clickNodeCenter,
  doubleClickNodeCenter,
} from "./helpers/canvas";
import {
  getDebugDump,
  getSelectionSnapshot,
  gotoEditor,
  loadDocument,
  loadDocumentFixture,
  pauseForUi,
} from "./helpers/editor";

const createSquareContour = () => ({
  closed: true,
  segments: [
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -50, y: -50 },
      pointType: "corner",
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 50, y: -50 },
      pointType: "corner",
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 50, y: 50 },
      pointType: "corner",
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -50, y: 50 },
      pointType: "corner",
    },
  ],
});

const createNestedPathDocument = () =>
  JSON.stringify({
    nodes: [
      {
        id: "outer-group",
        name: "Imported SVG",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      {
        id: "inner-group",
        name: "Face",
        parentId: "outer-group",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      {
        closed: true,
        contours: [createSquareContour()],
        fill: "#494a47",
        fillRule: "evenodd",
        id: "left-path",
        parentId: "inner-group",
        segments: createSquareContour().segments,
        stroke: null,
        strokeLineCap: "butt",
        strokeLineJoin: "miter",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 520, y: 360 },
        type: "path",
        visible: true,
      },
      {
        closed: true,
        contours: [createSquareContour()],
        fill: "#2f6f73",
        fillRule: "evenodd",
        id: "right-path",
        parentId: "inner-group",
        segments: createSquareContour().segments,
        stroke: null,
        strokeLineCap: "butt",
        strokeLineJoin: "miter",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 700, y: 360 },
        type: "path",
        visible: true,
      },
    ],
    version: "1.7",
  });

const createOverlappingParallelGroupDocument = () =>
  JSON.stringify({
    nodes: [
      {
        id: "outer-group",
        name: "Imported SVG",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      {
        id: "black-eye-group",
        name: "Black Eye",
        parentId: "outer-group",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      {
        closed: true,
        contours: [createSquareContour()],
        fill: "#111111",
        fillRule: "evenodd",
        id: "black-eye-path",
        parentId: "black-eye-group",
        segments: createSquareContour().segments,
        stroke: null,
        strokeLineCap: "butt",
        strokeLineJoin: "miter",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 520, y: 360 },
        type: "path",
        visible: true,
      },
      {
        id: "white-pupil-group",
        name: "White Pupil",
        parentId: "outer-group",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      {
        closed: true,
        contours: [createSquareContour()],
        fill: "#ffffff",
        fillRule: "evenodd",
        id: "white-pupil-path",
        parentId: "white-pupil-group",
        segments: createSquareContour().segments,
        stroke: null,
        strokeLineCap: "butt",
        strokeLineJoin: "miter",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: { rotation: 0, scaleX: 0.3, scaleY: 0.3, x: 550, y: 360 },
        type: "path",
        visible: true,
      },
    ],
    version: "1.7",
  });

test("double-clicking grouped content drills into the group and allows child selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "group-basic.punch");

  const firstNodeId = "basic-group-first-node";
  const groupNodeId = "basic-group-node";
  const secondNodeId = "basic-group-second-node";

  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);

  await doubleClickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: groupNodeId,
      selectedNodeIds: [firstNodeId],
    });

  await clickNodeCenter(page, secondNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: groupNodeId,
      selectedNodeIds: [secondNodeId],
    });

  await page.keyboard.press("Escape");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: null,
      selectedNodeIds: [groupNodeId],
    });

  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);

  await clickEmptyCanvas(page);
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: null,
      selectedNodeIds: [],
    });

  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);

  await page.keyboard.press("Escape");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.editing?.focusedGroupId || null;
    })
    .toBeNull();

  await clickNodeCenter(page, firstNodeId);
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual([groupNodeId]);
});

test("focused group clicks target deeply nested path layers", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, createNestedPathDocument());

  await clickNodeCenter(page, "left-path");
  await pauseForUi(page);

  await expect
    .poll(async () => (await getSelectionSnapshot(page)).selectedNodeIds)
    .toEqual(["outer-group"]);

  await doubleClickNodeCenter(page, "left-path");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        pathEditingNodeId: dump?.editing?.pathNodeId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: "outer-group",
      pathEditingNodeId: null,
      selectedNodeIds: ["left-path"],
    });

  await clickNodeCenter(page, "right-path");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        pathEditingNodeId: dump?.editing?.pathNodeId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: "outer-group",
      pathEditingNodeId: null,
      selectedNodeIds: ["right-path"],
    });
});

test("node tool selects nested path layers directly", async ({ page }) => {
  await gotoEditor(page);
  await loadDocument(page, createNestedPathDocument());

  await page.getByRole("button", { name: "Node (A)" }).click();
  await clickNodeCenter(page, "left-path");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        pathEditingNodeId: dump?.editing?.pathNodeId || null,
        selectedNodeIds: dump?.selection?.ids || [],
        tool: dump?.tool || null,
      };
    })
    .toEqual({
      focusedGroupId: "inner-group",
      pathEditingNodeId: "left-path",
      selectedNodeIds: ["left-path"],
      tool: "node",
    });
});

test("path editing can switch to an overlapping path in a parallel group", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, createOverlappingParallelGroupDocument());

  await page.getByRole("button", { name: "Node (A)" }).click();
  await clickNodeCenter(page, "black-eye-path");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        pathEditingNodeId: dump?.editing?.pathNodeId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      pathEditingNodeId: "black-eye-path",
      selectedNodeIds: ["black-eye-path"],
    });

  await clickNodeCenter(page, "white-pupil-path");
  await pauseForUi(page);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return {
        focusedGroupId: dump?.editing?.focusedGroupId || null,
        pathEditingNodeId: dump?.editing?.pathNodeId || null,
        selectedNodeIds: dump?.selection?.ids || [],
      };
    })
    .toEqual({
      focusedGroupId: "white-pupil-group",
      pathEditingNodeId: "white-pupil-path",
      selectedNodeIds: ["white-pupil-path"],
    });
});
