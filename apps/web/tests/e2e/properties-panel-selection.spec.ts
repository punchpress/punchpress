import { expect, test } from "@playwright/test";
import {
  getStateSnapshot,
  gotoEditor,
  loadDocument,
  loadDocumentFixture,
} from "./helpers/editor";

const GROUP_SELECTED_TEXT = /Group selected/i;
const LAYERS_SELECTED_TEXT = /layers selected/i;
const MAX_VALUE_TEXT_REGEX = /Max$/;
const MAX_TEXT_PREFIX_REGEX = /^Max/;

const selectNodes = (page, nodeIds) => {
  return page.evaluate((nextNodeIds) => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes(nextNodeIds);
  }, nodeIds);
};

const getSection = (page, title) => {
  return page.locator("section").filter({ hasText: title });
};

const getFillSection = (page) => getSection(page, "Fill");
const getSelectionColorsSection = (page) =>
  getSection(page, "Selection colors");
const getStrokeSection = (page) => getSection(page, "Stroke");
const dragSliderToRightEdge = async (page, slider, steps = 12) => {
  const sliderBox = await slider.boundingBox();

  expect(sliderBox).not.toBeNull();

  if (!sliderBox) {
    return;
  }

  const y = sliderBox.y + sliderBox.height / 2;
  const startX = sliderBox.x + sliderBox.width * 0.04;
  const endX = sliderBox.x + sliderBox.width * 0.96;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps });
  await page.mouse.up();
};

const loadVectorStrokeStyleDocument = (page) => {
  return loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          id: "vector-container",
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
          closed: false,
          fill: null,
          fillRule: "nonzero",
          id: "vector-node",
          parentId: "vector-container",
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
          type: "path",
          visible: true,
        },
      ],
      version: "1.6",
    })
  );
};

const loadIrregularVectorCornerDocument = (page) => {
  return loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          id: "irregular-vector-container",
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
          fill: "#ffffff",
          fillRule: "nonzero",
          id: "irregular-vector-node",
          parentId: "irregular-vector-container",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -50, y: -10 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 10, y: -45 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 95, y: -5 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 75, y: 70 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -20, y: 85 },
              pointType: "corner",
            },
          ],
          stroke: "#000000",
          strokeLineCap: "butt",
          strokeLineJoin: "miter",
          strokeMiterLimit: 4,
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 320,
            y: 220,
          },
          type: "path",
          visible: true,
        },
      ],
      version: "1.6",
    })
  );
};

const loadClosedVectorCornerDocument = (page) => {
  return loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          id: "closed-vector-container",
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
          fill: "#ffffff",
          fillRule: "nonzero",
          id: "closed-vector-node",
          parentId: "closed-vector-container",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: 90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: 90 },
              pointType: "corner",
            },
          ],
          stroke: "#000000",
          strokeLineCap: "butt",
          strokeLineJoin: "miter",
          strokeMiterLimit: 4,
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 320,
            y: 220,
          },
          type: "path",
          visible: true,
        },
      ],
      version: "1.6",
    })
  );
};

const loadVectorSelectionColorsDocument = (page) => {
  return loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          id: "vector-container",
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
          fill: "#F63F3F",
          fillRule: "nonzero",
          id: "vector-path-1",
          parentId: "vector-container",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: 90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: 90 },
              pointType: "corner",
            },
          ],
          stroke: "#000000",
          strokeLineCap: "butt",
          strokeLineJoin: "miter",
          strokeMiterLimit: 4,
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 260,
            y: 240,
          },
          type: "path",
          visible: true,
        },
        {
          closed: true,
          fill: "#FFFFFF",
          fillRule: "nonzero",
          id: "vector-path-2",
          parentId: "vector-container",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -80, y: -40 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 80, y: -40 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 80, y: 40 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -80, y: 40 },
              pointType: "corner",
            },
          ],
          stroke: "#F63F3F",
          strokeLineCap: "butt",
          strokeLineJoin: "miter",
          strokeMiterLimit: 4,
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 260,
            y: 240,
          },
          type: "path",
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
          id: "vector-container",
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
          fill: "#ffffff",
          fillRule: "nonzero",
          id: "vector-node",
          parentId: "vector-container",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: 90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: 90 },
              pointType: "corner",
            },
          ],
          stroke: "#000000",
          strokeLineCap: "butt",
          strokeLineJoin: "miter",
          strokeMiterLimit: 4,
          strokeWidth: 12,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 320,
            y: 240,
          },
          type: "path",
          visible: true,
        },
      ],
      version: "1.6",
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

test("shows selection colors for a selected multi-path vector and applies one swatch across matching fills and strokes", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorSelectionColorsDocument(page);
  await selectNodes(page, ["vector-container"]);

  const selectionColorsSection = getSelectionColorsSection(page);
  const selectionColorInputs = selectionColorsSection.getByRole("textbox");
  const redSelectionColorInput = selectionColorInputs.nth(0);

  await expect(selectionColorsSection).toBeVisible();
  await expect(selectionColorInputs).toHaveCount(3);
  await expect(redSelectionColorInput).toHaveValue("#F63F3F");

  await redSelectionColorInput.fill("#112233");
  await page.locator("body").click();

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return state.nodes
        .filter((node) => {
          return node.id === "vector-path-1" || node.id === "vector-path-2";
        })
        .map((node) => ({
          fill: node.fill,
          id: node.id,
          stroke: node.stroke,
        }))
        .sort((left, right) => left.id.localeCompare(right.id));
    })
    .toEqual([
      {
        fill: "#112233",
        id: "vector-path-1",
        stroke: "#000000",
      },
      {
        fill: "#FFFFFF",
        id: "vector-path-2",
        stroke: "#112233",
      },
    ]);
});

test("shows aggregate stroke controls for a selected multi-path vector and applies them to each child path", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadVectorSelectionColorsDocument(page);
  await selectNodes(page, ["vector-container"]);

  const strokeSection = getStrokeSection(page);
  const getRow = (label) => {
    return strokeSection
      .locator("label", { hasText: label })
      .locator("xpath=ancestor::div[contains(@class, 'grid')][1]");
  };
  const capTrigger = getRow("Cap").getByRole("combobox");
  const joinTrigger = getRow("Join").getByRole("combobox");

  await expect(strokeSection).toBeVisible();
  await expect(capTrigger).toContainText("Butt");
  await expect(joinTrigger).toContainText("Miter");

  await capTrigger.click();
  await page
    .locator("[data-slot='select-item']")
    .filter({ hasText: "Square" })
    .click();

  await joinTrigger.click();
  await page
    .locator("[data-slot='select-item']")
    .filter({ hasText: "Bevel" })
    .click();

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);

      return state.nodes
        .filter((node) => {
          return node.id === "vector-path-1" || node.id === "vector-path-2";
        })
        .map((node) => ({
          id: node.id,
          strokeLineCap: node.strokeLineCap,
          strokeLineJoin: node.strokeLineJoin,
        }))
        .sort((left, right) => left.id.localeCompare(right.id));
    })
    .toEqual([
      {
        id: "vector-path-1",
        strokeLineCap: "square",
        strokeLineJoin: "bevel",
      },
      {
        id: "vector-path-2",
        strokeLineCap: "square",
        strokeLineJoin: "bevel",
      },
    ]);
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
    selectedNodeId: "vector-container",
    selectedNodeIds: ["vector-container"],
    strokeLineCap: "square",
  });
  await expect(capTrigger).toContainText("Square");

  await joinTrigger.click();
  await page
    .locator("[data-slot='select-item']")
    .filter({ hasText: "Bevel" })
    .click();

  await expect.poll(getVectorStrokeState).toMatchObject({
    selectedNodeId: "vector-container",
    selectedNodeIds: ["vector-container"],
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

test("keeps the path corner scrub indicator aligned with pointer drag distance", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadIrregularVectorCornerDocument(page);
  await selectNodes(page, ["irregular-vector-node"]);

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setPathCornerRadius(
      12,
      "irregular-vector-node"
    );
  });

  const cornerSlider = page.getByRole("slider", { name: "Path corner radius" });
  const indicator = cornerSlider.locator(
    "[data-slot='scrub-slider-indicator']"
  );

  await expect(cornerSlider).toBeVisible();
  await expect(indicator).toBeVisible();
  await expect(cornerSlider).toHaveAttribute("aria-valuetext", "12");

  const indicatorBefore = await indicator.boundingBox();

  expect(indicatorBefore).not.toBeNull();

  if (!indicatorBefore) {
    return;
  }

  const dragDistance = 28;
  const startX = indicatorBefore.x + indicatorBefore.width / 2;
  const startY = indicatorBefore.y + indicatorBefore.height / 2;

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

test("shows capped path corner sliders as maxed", async ({ page }) => {
  await gotoEditor(page);
  await loadClosedVectorCornerDocument(page);
  await selectNodes(page, ["closed-vector-node"]);

  const cappedValue = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    if (!editor) {
      return null;
    }

    editor.setPathCornerRadius(999, "closed-vector-node");

    return {
      value:
        editor.getPathCornerRadiusSummary("closed-vector-node")?.value ?? 0,
    };
  });

  expect(cappedValue).not.toBeNull();

  if (!cappedValue) {
    return;
  }

  const cornerSlider = page.getByRole("slider", { name: "Path corner radius" });
  const indicator = cornerSlider.locator(
    "[data-slot='scrub-slider-indicator']"
  );
  const sliderBox = await cornerSlider.boundingBox();
  const indicatorBox = await indicator.boundingBox();
  const sliderVisualMax = Number(
    (await cornerSlider.getAttribute("aria-valuemax")) || "0"
  );

  await expect(cornerSlider).toBeVisible();
  await expect(cornerSlider).toHaveAttribute(
    "aria-valuetext",
    MAX_VALUE_TEXT_REGEX
  );
  await expect(cornerSlider).toContainText(MAX_TEXT_PREFIX_REGEX);

  expect(sliderBox).not.toBeNull();
  expect(indicatorBox).not.toBeNull();
  expect(sliderVisualMax).toBeCloseTo(cappedValue.value, 2);

  if (!(sliderBox && indicatorBox)) {
    return;
  }

  const indicatorCenterX = indicatorBox.x + indicatorBox.width / 2;
  const sliderMaxX = sliderBox.x + sliderBox.width * 0.96;

  expect(indicatorCenterX).toBeGreaterThan(sliderMaxX - 6);
});

test("dragging the path corner slider to the edge uses a stable source shape", async ({
  page,
}) => {
  await gotoEditor(page);

  const observedValueTexts: Array<string | null> = [];

  for (const steps of [2, 4, 10]) {
    await loadClosedVectorCornerDocument(page);
    await selectNodes(page, ["closed-vector-node"]);

    const expectedMax = await page.evaluate(() => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      if (!editor) {
        return null;
      }

      return Math.round(
        editor.getPathCornerRadiusStableMax("closed-vector-node")
      );
    });

    expect(expectedMax).not.toBeNull();

    if (expectedMax === null) {
      return;
    }

    const cornerSlider = page.getByRole("slider", {
      name: "Path corner radius",
    });

    await expect(cornerSlider).toBeVisible();
    await dragSliderToRightEdge(page, cornerSlider, steps);

    const valueText = await cornerSlider.getAttribute("aria-valuetext");

    observedValueTexts.push(valueText);

    await expect(cornerSlider).toHaveAttribute(
      "aria-valuetext",
      `${expectedMax} Max`
    );
  }

  expect(new Set(observedValueTexts).size).toBe(1);
});
