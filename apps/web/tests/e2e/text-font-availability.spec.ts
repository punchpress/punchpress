import { expect, test } from "@playwright/test";

const MISSING_FONT = {
  family: "Missing Font",
  fullName: "Missing Font Regular",
  postscriptName: "MissingFont-Regular",
  style: "Regular",
};

const loadDocument = async (page, document) => {
  await page.evaluate((contents) => {
    window.__PUNCHPRESS_EDITOR__?.loadDocument(JSON.stringify(contents));
  }, document);
};

test("renders and warps new text without local font permission", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Text (T)" })).toBeVisible();

  await page.getByRole("button", { name: "Text (T)" }).click();
  await page
    .getByTestId("canvas-stage")
    .click({ position: { x: 400, y: 300 } });

  const textInput = page.getByTestId("canvas-text-input");
  await textInput.fill("PRINT");
  await textInput.press("Enter");

  const node = page.locator("[data-node-id]").first();
  await expect(node).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Source Sans Pro" })
  ).toBeVisible();
  await expect(
    page.getByText(
      "The saved font must be loaded to preview or edit warp controls."
    )
  ).toHaveCount(0);

  const geometryReady = () =>
    page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const nodeId = editor?.selectedNodeId;

      return nodeId ? editor.getNodeRenderGeometry(nodeId)?.ready : false;
    });

  await expect.poll(geometryReady).toBe(true);

  const pathBeforeWarp = await node.locator("path").first().getAttribute("d");
  await page.getByRole("button", { name: "Arch", exact: true }).click();

  await expect(page.getByRole("slider", { name: "Bend" })).toHaveAttribute(
    "aria-valuenow",
    "0.4"
  );
  await expect
    .poll(async () => await node.locator("path").first().getAttribute("d"))
    .not.toBe(pathBeforeWarp);
});

test("keeps warp editing disabled for an unresolved saved font", async ({
  page,
}) => {
  await page.goto("/");
  await loadDocument(page, {
    nodes: [
      {
        fill: "#000000",
        font: MISSING_FONT,
        fontSize: 100,
        id: "missing-font-node",
        parentId: "root",
        stroke: null,
        strokeWidth: 0,
        text: "PRINT",
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 400,
          y: 300,
        },
        type: "text",
        visible: true,
        warp: {
          bend: 0.4,
          kind: "arch",
        },
      },
    ],
    version: "1.8",
  });

  const node = page.locator('[data-node-id="missing-font-node"]');
  await expect(node).toBeVisible();
  await node.click();

  await expect(
    page.getByText(
      "The saved font must be loaded to preview or edit warp controls."
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Arch", exact: true })
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Clear warp", exact: true })
  ).toBeEnabled();
});
