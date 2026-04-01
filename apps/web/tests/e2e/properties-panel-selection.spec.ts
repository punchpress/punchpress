import { expect, test } from "@playwright/test";
import {
  getStateSnapshot,
  loadDocument,
  gotoEditor,
  loadDocumentFixture,
} from "./helpers/editor";

const selectNodes = (page, nodeIds) => {
  return page.evaluate((nextNodeIds) => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes(nextNodeIds);
  }, nodeIds);
};

const getSection = (page, title) => {
  return page.locator("section").filter({ hasText: title });
};

test("shows shape controls for a single selected shape node", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "properties-panel-selection.punch");
  await selectNodes(page, ["shape-node"]);

  await expect(getSection(page, "Shape")).toBeVisible();
  await expect(getSection(page, "Fill & Stroke")).toBeVisible();
  await expect(getSection(page, "Text")).toHaveCount(0);
});

test("shows only shared appearance controls for a mixed text and shape selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "properties-panel-selection.punch");
  await selectNodes(page, ["text-node", "shape-node"]);

  const fillSection = getSection(page, "Fill & Stroke");
  const fillInput = fillSection.getByRole("textbox").nth(0);

  await expect(getSection(page, "Shape")).toHaveCount(0);
  await expect(getSection(page, "Text")).toHaveCount(0);
  await expect(fillSection).toBeVisible();
  await expect(fillInput).toHaveAttribute("placeholder", "Mixed");
  await expect(page.getByText(/layers selected/i)).toHaveCount(0);
  await expect(page.getByText(/Group selected/i)).toHaveCount(0);

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
