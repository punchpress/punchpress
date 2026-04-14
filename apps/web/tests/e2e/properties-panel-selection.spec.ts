import { expect, test } from "@playwright/test";
import {
  getStateSnapshot,
  gotoEditor,
  loadDocument,
  loadDocumentFixture,
} from "./helpers/editor";

const GROUP_SELECTED_TEXT = /Group selected/i;
const LAYERS_SELECTED_TEXT = /layers selected/i;

const selectNodes = (page, nodeIds) => {
  return page.evaluate((nextNodeIds) => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes(nextNodeIds);
  }, nodeIds);
};

const getSection = (page, title) => {
  return page.locator("section").filter({ hasText: title });
};

const getFillSection = (page) => getSection(page, "Fill");
const getStrokeSection = (page) => getSection(page, "Stroke");

const loadVectorStrokeStyleDocument = (page) => {
  return loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          contours: [
            {
              closed: false,
              segments: [
                {
                  handleIn: { x: 0, y: 0 },
                  handleOut: { x: 0, y: 0 },
                  point: { x: -120, y: -40 },
                  pointType: "corner",
                },
                {
                  handleIn: { x: 0, y: 0 },
                  handleOut: { x: 0, y: 0 },
                  point: { x: 0, y: 80 },
                  pointType: "corner",
                },
                {
                  handleIn: { x: 0, y: 0 },
                  handleOut: { x: 0, y: 0 },
                  point: { x: 120, y: -40 },
                  pointType: "corner",
                },
              ],
            },
          ],
          fill: null,
          fillRule: "nonzero",
          id: "vector-node",
          parentId: "root",
          stroke: "#000000",
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 320,
            y: 240,
          },
          type: "vector",
          visible: true,
        },
      ],
      version: "1.6",
    })
  );
};

test("shows shape controls for a single selected shape node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "properties-panel-selection.punch");
  await selectNodes(page, ["shape-node"]);

  await expect(getSection(page, "Shape")).toBeVisible();
  await expect(getFillSection(page)).toBeVisible();
  await expect(getStrokeSection(page)).toBeVisible();
  await expect(getSection(page, "Text")).toHaveCount(0);
});

test("shows only shared appearance controls for a mixed text and shape selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "properties-panel-selection.punch");
  await selectNodes(page, ["text-node", "shape-node"]);

  const fillSection = getFillSection(page);
  const fillInput = fillSection.getByRole("textbox").nth(0);

  await expect(getSection(page, "Shape")).toHaveCount(0);
  await expect(getSection(page, "Text")).toHaveCount(0);
  await expect(fillSection).toBeVisible();
  await expect(fillInput).toHaveAttribute("placeholder", "Mixed");
  await expect(page.getByText(LAYERS_SELECTED_TEXT)).toHaveCount(0);
  await expect(page.getByText(GROUP_SELECTED_TEXT)).toHaveCount(0);

  await fillInput.fill("#123456");
  await fillInput.blur();

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return state.nodes
        .filter((node) => {
          return node.id === "text-node" || node.id === "shape-node";
        })
        .map((node) => node.fill)
        .sort();
    })
    .toEqual(["#123456", "#123456"]);
});

test("shows bulk path corner controls for a selected vector outside path edit mode", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          contours: [
            {
              closed: true,
              segments: [
                {
                  cornerRadius: 18,
                  handleIn: { x: 0, y: 0 },
                  handleOut: { x: 0, y: 0 },
                  point: { x: -120, y: -90 },
                  pointType: "corner",
                },
                {
                  cornerRadius: 18,
                  handleIn: { x: 0, y: 0 },
                  handleOut: { x: 0, y: 0 },
                  point: { x: 120, y: -90 },
                  pointType: "corner",
                },
                {
                  cornerRadius: 18,
                  handleIn: { x: 0, y: 0 },
                  handleOut: { x: 0, y: 0 },
                  point: { x: 120, y: 90 },
                  pointType: "corner",
                },
                {
                  cornerRadius: 18,
                  handleIn: { x: 0, y: 0 },
                  handleOut: { x: 0, y: 0 },
                  point: { x: -120, y: 90 },
                  pointType: "corner",
                },
              ],
            },
          ],
          fill: "#ffffff",
          fillRule: "nonzero",
          id: "vector-node",
          parentId: "root",
          stroke: "#000000",
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 320,
            y: 240,
          },
          type: "vector",
          visible: true,
        },
      ],
      version: "1.5",
    })
  );
  await selectNodes(page, ["vector-node"]);

  await expect(
    page.getByRole("slider", { name: "Path corner radius" })
  ).toBeVisible();
});

test("shows bulk path corner controls while pen-authoring an open path with eligible corners", async ({
  page,
}) => {
  await gotoEditor(page);
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return false;
    }

    const clickPen = (point: { x: number; y: number }) => {
      const session = editor.dispatchCanvasPointerDown({ point });

      if (!session) {
        throw new Error("Expected pen placement session");
      }

      const completed = session.complete({
        dragDistancePx: 0,
        point,
      });

      if (completed !== true) {
        throw new Error("Expected pen placement to complete");
      }
    };

    editor.setActiveTool("pen");
    clickPen({ x: 220, y: 180 });
    clickPen({ x: 360, y: 180 });
    clickPen({ x: 360, y: 320 });

    return true;
  });

  await expect(
    page.getByRole("slider", { name: "Path corner radius" })
  ).toBeVisible();
});

test("applies vector stroke cap and join from the properties panel without clearing selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorStrokeStyleDocument(page);
  await selectNodes(page, ["vector-node"]);

  const fillSection = getStrokeSection(page);
  const getRow = (label) => {
    return fillSection
      .locator("label", { hasText: label })
      .locator("xpath=ancestor::div[contains(@class, 'grid')][1]");
  };
  const capTrigger = getRow("Cap").getByRole("combobox");
  const joinTrigger = getRow("Join").getByRole("combobox");
  const getVectorStrokeState = () =>
    page.evaluate(() => {
      const dump = window.__PUNCHPRESS_EDITOR__?.getDebugDump();
      const node = dump?.nodes?.find(
        (candidate) => candidate.id === "vector-node"
      );

      return {
        selectedNodeId: dump?.selection?.primaryId || null,
        selectedNodeIds: dump?.selection?.ids || [],
        strokeLineCap: node?.strokeLineCap || null,
        strokeLineJoin: node?.strokeLineJoin || null,
      };
    });

  await expect(capTrigger).toContainText("Round");
  await expect(joinTrigger).toContainText("Round");

  await capTrigger.click();
  await page
    .locator("[data-slot='select-item']")
    .filter({ hasText: "Square" })
    .click();

  await expect.poll(getVectorStrokeState).toMatchObject({
    selectedNodeId: "vector-node",
    selectedNodeIds: ["vector-node"],
    strokeLineCap: "square",
  });
  await expect(capTrigger).toContainText("Square");

  await joinTrigger.click();
  await page
    .locator("[data-slot='select-item']")
    .filter({ hasText: "Bevel" })
    .click();

  await expect.poll(getVectorStrokeState).toMatchObject({
    selectedNodeId: "vector-node",
    selectedNodeIds: ["vector-node"],
    strokeLineCap: "square",
    strokeLineJoin: "bevel",
  });
  await expect(joinTrigger).toContainText("Bevel");
});

test("keeps the miter scrub indicator aligned with pointer drag distance", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorStrokeStyleDocument(page);
  await selectNodes(page, ["vector-node"]);

  const miterSlider = page.getByRole("slider", { name: "Stroke miter limit" });
  const indicator = miterSlider.locator("[data-slot='scrub-slider-indicator']");

  await expect(miterSlider).toBeVisible();
  await expect(indicator).toBeVisible();

  const sliderBox = await miterSlider.boundingBox();
  const indicatorBefore = await indicator.boundingBox();

  expect(sliderBox).not.toBeNull();
  expect(indicatorBefore).not.toBeNull();

  if (!(sliderBox && indicatorBefore)) {
    return;
  }

  const dragDistance = 36;
  const startX = sliderBox.x + sliderBox.width * 0.65;
  const startY = sliderBox.y + sliderBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dragDistance, startY, { steps: 6 });

  const indicatorAfter = await indicator.boundingBox();

  await page.mouse.up();

  expect(indicatorAfter).not.toBeNull();

  if (!indicatorAfter) {
    return;
  }

  const indicatorDelta = indicatorAfter.x - indicatorBefore.x;

  expect(indicatorDelta).toBeGreaterThan(dragDistance - 4);
  expect(indicatorDelta).toBeLessThan(dragDistance + 4);
});
