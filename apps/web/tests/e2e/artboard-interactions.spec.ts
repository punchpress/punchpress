import { expect, test } from "@playwright/test";
import {
  getDebugDump,
  getSelectionSnapshot,
  gotoEditor,
  loadDocument,
  resetViewport,
} from "./helpers/editor";

const ARTBOARD_DOCUMENT = JSON.stringify({
  nodes: [
    {
      background: "#ffffff",
      height: 260,
      id: "artboard-1",
      locked: false,
      name: "Artboard 1",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 220,
        y: 160,
      },
      type: "artboard",
      visible: true,
      width: 340,
    },
    {
      cornerRadius: 0,
      fill: "#3366ff",
      height: 70,
      id: "shape-1",
      parentId: "artboard-1",
      shape: "polygon",
      stroke: null,
      strokeWidth: 0,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 330,
        y: 260,
      },
      type: "shape",
      visible: true,
      width: 90,
    },
  ],
  version: "1.7",
});

const getNode = async (page, nodeId) => {
  const dump = await getDebugDump(page);
  return dump?.nodes?.find((node) => node.id === nodeId) || null;
};

const getElementRect = (page, selector) => {
  return page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    const rect = element?.getBoundingClientRect?.();

    if (!rect) {
      return null;
    }

    return {
      height: rect.height,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    };
  }, selector);
};

test("artboard labels drag the artboard and the body allows marquee selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);

  const label = page.locator('button.canvas-node[data-node-id="artboard-1"]');
  await expect(label).toBeVisible();
  await expect(label).toContainText("Artboard 1");
  await expect(label).toContainText("340 x 260px");

  await label.click();

  await expect
    .poll(async () => {
      return (await getSelectionSnapshot(page)).selectedNodeId;
    })
    .toBe("artboard-1");

  const labelBox = await label.boundingBox();

  if (!labelBox) {
    throw new Error("Missing artboard label bounds");
  }

  await page.mouse.move(labelBox.x + labelBox.width / 2, labelBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(labelBox.x + labelBox.width / 2 + 42, labelBox.y + 42, {
    steps: 12,
  });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const artboard = await getNode(page, "artboard-1");
      const shape = await getNode(page, "shape-1");

      return {
        artboardX: artboard?.transform?.x ?? null,
        artboardY: artboard?.transform?.y ?? null,
        selectedNodeId: (await getSelectionSnapshot(page)).selectedNodeId,
        shapeX: shape?.transform?.x ?? null,
        shapeY: shape?.transform?.y ?? null,
      };
    })
    .toEqual({
      artboardX: 262,
      artboardY: 190,
      selectedNodeId: "artboard-1",
      shapeX: 372,
      shapeY: 290,
    });

  const body = page.locator('[data-artboard-body="artboard-1"]');
  await expect(body).toBeVisible();

  const bodyBox = await body.boundingBox();

  if (!bodyBox) {
    throw new Error("Missing artboard body bounds");
  }

  await page.mouse.move(bodyBox.x + 12, bodyBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(bodyBox.x + 190, bodyBox.y + 165, { steps: 12 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      return (await getSelectionSnapshot(page)).selectedNodeIds;
    })
    .toEqual(["shape-1"]);
});

test("artboard selection outline follows label drag preview", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);

  const label = page.locator('button.canvas-node[data-node-id="artboard-1"]');
  await expect(label).toBeVisible();
  await label.click();

  await expect
    .poll(async () => {
      return (await getSelectionSnapshot(page)).selectedNodeId;
    })
    .toBe("artboard-1");

  const labelBox = await label.boundingBox();

  if (!labelBox) {
    throw new Error("Missing artboard label bounds");
  }

  const beforeBodyRect = await getElementRect(
    page,
    '[data-artboard-body="artboard-1"]'
  );
  const beforeChildRect = await getElementRect(
    page,
    '[data-node-id="shape-1"]'
  );

  if (!(beforeBodyRect && beforeChildRect)) {
    throw new Error("Missing artboard preview bounds");
  }

  const childOffsetX = Math.round(beforeChildRect.x - beforeBodyRect.x);

  await page.mouse.move(labelBox.x + labelBox.width / 2, labelBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(labelBox.x + labelBox.width / 2 + 48, labelBox.y + 44, {
    steps: 12,
  });

  try {
    await expect
      .poll(async () => {
        const bodyRect = await getElementRect(
          page,
          '[data-artboard-body="artboard-1"]'
        );
        const outlineRect = await getElementRect(
          page,
          ".canvas-single-selection"
        );
        const childRect = await getElementRect(
          page,
          '[data-node-id="shape-1"]'
        );

        if (!(bodyRect && outlineRect && childRect)) {
          return null;
        }

        return {
          childOffsetX: Math.round(childRect.x - bodyRect.x),
          outlineHeight: Math.round(outlineRect.height),
          outlineOffsetX: Math.round(outlineRect.x - bodyRect.x),
          outlineOffsetY: Math.round(outlineRect.y - bodyRect.y),
          outlineWidth: Math.round(outlineRect.width),
        };
      })
      .toEqual({
        childOffsetX,
        outlineHeight: 260,
        outlineOffsetX: 0,
        outlineOffsetY: 0,
        outlineWidth: 340,
      });
  } finally {
    await page.mouse.up();
  }
});

test("shift-click on an artboard label or empty body adds it to the selection", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        ...JSON.parse(ARTBOARD_DOCUMENT).nodes,
        {
          cornerRadius: 0,
          fill: "#ef4444",
          height: 80,
          id: "shape-2",
          parentId: "root",
          shape: "polygon",
          stroke: null,
          strokeWidth: 0,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 680,
            y: 180,
          },
          type: "shape",
          visible: true,
          width: 80,
        },
      ],
      version: "1.7",
    })
  );
  await resetViewport(page);

  const rootShape = page.locator('[data-node-id="shape-2"]');
  const label = page.locator('button.canvas-node[data-node-id="artboard-1"]');
  const body = page.locator('[data-artboard-body="artboard-1"]');

  await rootShape.click();
  await page.keyboard.down("Shift");
  await label.click();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => {
      return [...(await getSelectionSnapshot(page)).selectedNodeIds].sort();
    })
    .toEqual(["artboard-1", "shape-2"]);

  await page.keyboard.press("Escape");
  await rootShape.click();

  await expect
    .poll(async () => {
      return (await getSelectionSnapshot(page)).selectedNodeIds;
    })
    .toEqual(["shape-2"]);

  const bodyBox = await body.boundingBox();

  if (!bodyBox) {
    throw new Error("Missing artboard body bounds");
  }

  await page.keyboard.down("Shift");
  await page.mouse.click(bodyBox.x + bodyBox.width - 20, bodyBox.y + 20);
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => {
      return [...(await getSelectionSnapshot(page)).selectedNodeIds].sort();
    })
    .toEqual(["artboard-1", "shape-2"]);
});

test("toolbar-created artboards use the production default and fit in view", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.getByRole("button", { name: "Add artboard" }).click();

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const artboard = dump?.nodes?.find((node) => node.type === "artboard");

      if (!artboard) {
        return null;
      }

      return {
        height: artboard.frame?.bounds?.height ?? null,
        selected: dump.selection.primaryId === artboard.id,
        type: artboard.type,
        width: artboard.frame?.bounds?.width ?? null,
      };
    })
    .toEqual({
      height: 5400,
      selected: true,
      type: "artboard",
      width: 4500,
    });

  await expect
    .poll(() => {
      return page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const host = editor?.hostRef;

        if (!(editor && host)) {
          return null;
        }

        const hostRect = host.getBoundingClientRect();

        return {
          height: Math.round(hostRect.height / editor.zoom),
          width: Math.round(hostRect.width / editor.zoom),
        };
      });
    })
    .toEqual({
      height: 6480,
      width: 11_520,
    });
});

test("toolbar-created artboards do not auto-fit after content exists", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          cornerRadius: 0,
          fill: "#3366ff",
          height: 200,
          id: "existing-shape",
          parentId: "root",
          shape: "polygon",
          stroke: null,
          strokeWidth: 0,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 400,
            y: 300,
          },
          type: "shape",
          visible: true,
          width: 300,
        },
      ],
      version: "1.7",
    })
  );
  await resetViewport(page);

  await page.getByRole("button", { name: "Add artboard" }).click();

  await expect
    .poll(async () => {
      return (await getDebugDump(page))?.viewport?.zoom ?? null;
    })
    .toBe(1);
});

test("artboard children stay clipped while drag preview crosses the artboard edge", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);

  const shape = page.locator('[data-node-id="shape-1"]');
  await expect(shape).toBeVisible();

  const shapeBox = await shape.boundingBox();

  if (!shapeBox) {
    throw new Error("Missing shape bounds");
  }

  await page.mouse.move(
    shapeBox.x + shapeBox.width / 2,
    shapeBox.y + shapeBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(shapeBox.x - 180, shapeBox.y + shapeBox.height / 2, {
    steps: 12,
  });

  try {
    await expect
      .poll(() => {
        return shape.evaluate((element) => {
          const shell =
            element.parentElement instanceof HTMLElement
              ? element.parentElement
              : element;

          return shell.style.clipPath;
        });
      })
      .toContain("inset(");
  } finally {
    await page.mouse.up();
  }
});

test("rotated artboard children are not selectable outside the artboard edge", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 260,
          id: "artboard-1",
          locked: false,
          name: "Artboard 1",
          parentId: "root",
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 220,
            y: 160,
          },
          type: "artboard",
          visible: true,
          width: 340,
        },
        {
          closed: true,
          fill: "#ef4444",
          fillRule: "nonzero",
          id: "path-1",
          parentId: "artboard-1",
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -70, y: -20 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 70, y: -20 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 70, y: 20 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -70, y: 20 },
              pointType: "corner",
            },
          ],
          stroke: null,
          strokeLineCap: "butt",
          strokeLineJoin: "miter",
          strokeMiterLimit: 4,
          strokeWidth: 0,
          transform: {
            rotation: 45,
            scaleX: 1,
            scaleY: 1,
            x: 540,
            y: 300,
          },
          type: "path",
          visible: true,
        },
      ],
      version: "1.7",
    })
  );
  await resetViewport(page);

  const body = page.locator('[data-artboard-body="artboard-1"]');
  await expect(body).toBeVisible();

  const bodyBox = await body.boundingBox();

  if (!bodyBox) {
    throw new Error("Missing artboard body bounds");
  }

  await page.mouse.click(bodyBox.x + bodyBox.width + 7, bodyBox.y + 140);

  await expect
    .poll(async () => {
      return (await getSelectionSnapshot(page)).selectedNodeIds;
    })
    .toEqual([]);
});

test("text tool click inside an artboard creates selected artboard content", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);

  const body = page.locator('[data-artboard-body="artboard-1"]');
  await expect(body).toBeVisible();

  const bodyBox = await body.boundingBox();

  if (!bodyBox) {
    throw new Error("Missing artboard body bounds");
  }

  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(bodyBox.x + bodyBox.width / 2, bodyBox.y + 70);

  await expect
    .poll(async () => {
      const dump = await getDebugDump(page);
      const textNode =
        dump?.nodes?.find((node) => node.type === "text") || null;
      const textNodeId = textNode?.id || null;

      return {
        editingText: Boolean(
          textNodeId && dump?.editing?.nodeId === textNodeId
        ),
        parentId: textNode?.parentId || null,
        selectedText: Boolean(
          textNodeId && dump?.selection?.primaryId === textNodeId
        ),
        textNodeExists: Boolean(textNodeId),
      };
    })
    .toEqual({
      editingText: true,
      parentId: "artboard-1",
      selectedText: true,
      textNodeExists: true,
    });
});

test("artboard labels keep a readable screen size when zoomed out", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, ARTBOARD_DOCUMENT);
  await resetViewport(page);

  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const viewer = editor?.viewerRef;

    viewer?.setTo?.({
      x: 0,
      y: 0,
      zoom: 0.12,
    });
    editor?.setViewportZoom?.(0.12);
    editor?.onViewportChange?.();
  });

  const label = page.locator('button.canvas-node[data-node-id="artboard-1"]');
  await expect(label).toBeVisible();

  await expect
    .poll(async () => {
      const box = await label.boundingBox();

      return box ? Math.round(box.height) : null;
    })
    .toBe(24);
});
