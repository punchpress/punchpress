import { expect, test } from "@playwright/test";
import { clickNodeCenter } from "./helpers/canvas";
import {
  getDebugDump,
  getSelectionSnapshot,
  gotoEditor,
  loadDocument,
  shiftClickLayer,
} from "./helpers/editor";

const BOOLEAN_VECTOR_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "vector-container",
      name: "Boolean Vector",
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
      fill: "#3366FF",
      fillRule: "nonzero",
      id: "path-back",
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
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 260,
        y: 260,
      },
      type: "path",
      visible: true,
    },
    {
      closed: true,
      fill: "#FF3366",
      fillRule: "nonzero",
      id: "path-front",
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
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 260,
        y: 260,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.7",
});

const TOP_LEVEL_BOOLEAN_VECTOR_DOCUMENT = JSON.stringify({
  nodes: [
    {
      id: "vector-back",
      name: "Back Vector",
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
      fill: "#3366FF",
      fillRule: "nonzero",
      id: "vector-back:path",
      parentId: "vector-back",
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
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 220,
        y: 260,
      },
      type: "path",
      visible: true,
    },
    {
      id: "vector-front",
      name: "Front Vector",
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
      fill: "#FF3366",
      fillRule: "nonzero",
      id: "vector-front:path",
      parentId: "vector-front",
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
      stroke: "#111111",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 6,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 300,
        y: 260,
      },
      type: "path",
      visible: true,
    },
  ],
  version: "1.7",
});

const BOOLEAN_ACTIONS = [
  {
    buttonName: "Unite selection",
    expectedPathCount: 1,
  },
  {
    buttonName: "Subtract selection",
    expectedPathCount: 2,
  },
  {
    buttonName: "Intersect selection",
    expectedPathCount: 1,
  },
  {
    buttonName: "Exclude selection",
    expectedPathCount: 2,
  },
] as const;

const expectVectorTransformOverlay = async (page) => {
  const singleSelection = page.locator(".canvas-single-selection");
  const multiSelection = page.locator(".canvas-multi-selection");
  const overlay =
    (await singleSelection.count()) > 0 ? singleSelection : multiSelection;
  const handle = overlay.locator(".moveable-control.moveable-ne");

  await expect(overlay).toBeVisible();
  await expect(handle).toBeVisible();
};

const selectSiblingPathsFromLayers = async (page) => {
  await page.getByRole("button", { name: "Path 1" }).first().click();
  await shiftClickLayer(page, "Path 2");
};

const selectTopLevelVectorsFromLayers = async (page) => {
  await page.getByRole("button", { name: "Back Vector" }).first().click();
  await shiftClickLayer(page, "Front Vector");
};

const getCanvasNodeBounds = async (page, nodeId) => {
  const node = page.locator(`.canvas-node[data-node-id="${nodeId}"]`);

  await node.waitFor({ state: "visible" });

  const box = await node.boundingBox();

  if (!box) {
    throw new Error(`Missing visible canvas node ${nodeId}`);
  }

  return box;
};

const selectTopLevelVectorsOnCanvas = async (page) => {
  await clickNodeCenter(page, "vector-front");
  const backBox = await getCanvasNodeBounds(page, "vector-back");

  await page.keyboard.down("Shift");
  try {
    await page.mouse.click(backBox.x + 24, backBox.y + backBox.height / 2);
  } finally {
    await page.keyboard.up("Shift");
  }
};

const getBooleanVectorSnapshot = async (page) => {
  const dump = await getDebugDump(page);
  const nodes = dump?.nodes || [];

  return {
    pathCount: nodes.filter((node) => node.parentId === "vector-container")
      .length,
    pathNodeIds: nodes
      .filter((node) => node.parentId === "vector-container")
      .map((node) => node.id)
      .sort(),
    selectedNodeId: dump?.selection?.primaryId || null,
    selectedNodeIds: dump?.selection?.ids || [],
    vectorCount: nodes.filter((node) => node.type === "vector").length,
  };
};

const getTopLevelBooleanVectorSnapshot = async (page) => {
  const dump = await getDebugDump(page);
  const nodes = dump?.nodes || [];
  const vectors = nodes.filter((node) => node.type === "vector");
  const pathNodes = nodes.filter((node) => node.type === "path");
  const resultVector = vectors.find(
    (node) => node.id !== "vector-back" && node.id !== "vector-front"
  );

  return {
    pathCount: resultVector
      ? pathNodes.filter((node) => node.parentId === resultVector.id).length
      : 0,
    selectedNodeId: dump?.selection?.primaryId || null,
    selectedNodeIds: dump?.selection?.ids || [],
    vectorCount: vectors.length,
  };
};

for (const booleanAction of BOOLEAN_ACTIONS) {
  test(`layers-panel sibling path selection keeps the result visible for ${booleanAction.buttonName}`, async ({
    page,
  }) => {
    await gotoEditor(page);
    await loadDocument(page, BOOLEAN_VECTOR_DOCUMENT);

    await selectSiblingPathsFromLayers(page);
    await expect(
      page.getByRole("button", { name: booleanAction.buttonName })
    ).toBeVisible();

    await page.getByRole("button", { name: booleanAction.buttonName }).click();

    await expect
      .poll(() => {
        return getBooleanVectorSnapshot(page);
      })
      .toEqual({
        pathCount: booleanAction.expectedPathCount,
        pathNodeIds: expect.any(Array),
        selectedNodeId: "vector-container",
        selectedNodeIds: ["vector-container"],
        vectorCount: 1,
      });

    await expectVectorTransformOverlay(page);
  });
}

test("undo and redo keyboard shortcuts restore a boolean result created from sibling path layer rows", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, BOOLEAN_VECTOR_DOCUMENT);

  await selectSiblingPathsFromLayers(page);
  await page.getByRole("button", { name: "Unite selection" }).click();

  await expect
    .poll(() => {
      return getBooleanVectorSnapshot(page);
    })
    .toEqual({
      pathCount: 1,
      pathNodeIds: expect.any(Array),
      selectedNodeId: "vector-container",
      selectedNodeIds: ["vector-container"],
      vectorCount: 1,
    });

  await page.keyboard.press("ControlOrMeta+Z");

  await expect
    .poll(() => {
      return getBooleanVectorSnapshot(page);
    })
    .toEqual({
      pathCount: 2,
      pathNodeIds: ["path-back", "path-front"],
      selectedNodeId: "vector-container",
      selectedNodeIds: ["vector-container"],
      vectorCount: 1,
    });

  await expectVectorTransformOverlay(page);

  await page.keyboard.press("ControlOrMeta+Shift+Z");

  await expect
    .poll(() => {
      return getBooleanVectorSnapshot(page);
    })
    .toEqual({
      pathCount: 1,
      pathNodeIds: expect.any(Array),
      selectedNodeId: "vector-container",
      selectedNodeIds: ["vector-container"],
      vectorCount: 1,
    });

  await expectVectorTransformOverlay(page);
});

test("selecting a hidden subtract operand shows a ghost path on canvas", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, BOOLEAN_VECTOR_DOCUMENT);

  await selectSiblingPathsFromLayers(page);
  await page.getByRole("button", { name: "Subtract selection" }).click();

  await expect
    .poll(() => {
      return getBooleanVectorSnapshot(page);
    })
    .toEqual({
      pathCount: 2,
      pathNodeIds: expect.any(Array),
      selectedNodeId: "vector-container",
      selectedNodeIds: ["vector-container"],
      vectorCount: 1,
    });

  await page.getByRole("button", { name: "Path 2" }).first().click();

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const selectedNodeId = dump?.selection?.primaryId || null;
      const selectedNode = dump?.nodes?.find(
        (node) => node.id === selectedNodeId
      );

      return selectedNode?.type === "path" &&
        selectedNode.parentId === "vector-container"
        ? selectedNode.id
        : null;
    })
    .not.toBeNull();

  await expect(
    page.locator('[data-testid="canvas-selection-path-ghost"] path')
  ).toHaveCount(1);
});

for (const booleanAction of BOOLEAN_ACTIONS) {
  test(`layers-panel top-level vector selection keeps the result visible for ${booleanAction.buttonName}`, async ({
    page,
  }) => {
    await gotoEditor(page);
    await loadDocument(page, TOP_LEVEL_BOOLEAN_VECTOR_DOCUMENT);

    await selectTopLevelVectorsFromLayers(page);
    await expect(
      page.getByRole("button", { name: booleanAction.buttonName })
    ).toBeVisible();

    await page.getByRole("button", { name: booleanAction.buttonName }).click();

    await expect
      .poll(() => {
        return getTopLevelBooleanVectorSnapshot(page);
      })
      .toEqual({
        pathCount:
          booleanAction.buttonName === "Subtract selection"
            ? 1
            : booleanAction.expectedPathCount,
        selectedNodeId: expect.any(String),
        selectedNodeIds: expect.any(Array),
        vectorCount: 1,
      });

    await expectVectorTransformOverlay(page);
  });
}

test("canvas shift-selection of top-level vectors exposes boolean ops and keeps the result selected", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, TOP_LEVEL_BOOLEAN_VECTOR_DOCUMENT);

  await selectTopLevelVectorsOnCanvas(page);

  await expect
    .poll(async () => {
      return (await getSelectionSnapshot(page)).selectedNodeIds;
    })
    .toHaveLength(2);

  await expect(
    page.getByRole("button", { name: "Unite selection" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Unite selection" }).click();

  await expect
    .poll(() => {
      return getTopLevelBooleanVectorSnapshot(page);
    })
    .toEqual({
      pathCount: 1,
      selectedNodeId: expect.any(String),
      selectedNodeIds: expect.any(Array),
      vectorCount: 1,
    });

  await expectVectorTransformOverlay(page);
});

test("clicking a compound layer icon opens the operation menu and updates the vector op", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, BOOLEAN_VECTOR_DOCUMENT);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setVectorPathComposition("vector-container", "unite");
  });

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.nodes.find((node) => node.id === "vector-container")
        ?.pathComposition;
    })
    .toBe("unite");

  const trigger = page.locator(
    '[data-layer-compound-operation-node-id="vector-container"]'
  );

  await expect(
    page.locator("[data-layer-compound-operation-node-id]")
  ).toHaveCount(1);
  await expect(trigger).toBeVisible();
  await trigger.click();

  await expect(
    page.getByRole("menuitemradio", { name: "Unite" })
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Subtract" }).click();

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.nodes.find((node) => node.id === "vector-container")
        ?.pathComposition;
    })
    .toBe("subtract");

  await expect
    .poll(async () => {
      return (await getSelectionSnapshot(page)).selectedNodeIds;
    })
    .toEqual(["vector-container"]);
});

test("layer context menu swaps make and release compound path actions", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, BOOLEAN_VECTOR_DOCUMENT);

  const layerRow = page.getByRole("button", {
    exact: true,
    name: "Boolean Vector",
  });

  await layerRow.click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Make Compound Path" })
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Release Compound Path" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "Compound Operation" })
  ).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Make Compound Path" }).click();

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.nodes.find((node) => node.id === "vector-container")
        ?.pathComposition;
    })
    .toBe("unite");

  await layerRow.click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Release Compound Path" })
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Make Compound Path" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "Compound Operation" })
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Release Compound Path" }).click();

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.nodes.find((node) => node.id === "vector-container")
        ?.pathComposition;
    })
    .toBe("independent");
});

test("layer context menu exposes compound operations for a compound vector", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, BOOLEAN_VECTOR_DOCUMENT);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setVectorPathComposition("vector-container", "unite");
  });

  await page
    .getByRole("button", { exact: true, name: "Boolean Vector" })
    .click({
      button: "right",
    });

  const duplicateItem = page.getByRole("menuitem", { name: "Duplicate" });
  const compoundItem = page.getByRole("menuitem", {
    name: "Compound Operation",
  });

  await expect(compoundItem).toBeVisible();

  const iconOffsets = await Promise.all(
    [duplicateItem, compoundItem].map((locator) =>
      locator.evaluate((element) => {
        const itemRect = element.getBoundingClientRect();
        const iconRect = element.querySelector("svg")?.getBoundingClientRect();

        if (!iconRect) {
          throw new Error("Missing context menu icon");
        }

        return {
          iconLeft: iconRect.left,
          itemLeft: itemRect.left,
        };
      })
    )
  );

  expect(
    Math.abs((iconOffsets[0]?.iconLeft || 0) - (iconOffsets[1]?.iconLeft || 0))
  ).toBeLessThanOrEqual(1);

  await compoundItem.hover();
  await expect(
    page.getByRole("menuitemradio", { name: "Unite" })
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Exclude" }).click();

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);

      return dump?.nodes.find((node) => node.id === "vector-container")
        ?.pathComposition;
    })
    .toBe("exclude");
});
