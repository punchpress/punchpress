import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "./helpers/editor";
import { decodePng } from "./helpers/png";

// Continuous zoom (pinch, ctrl-wheel, zoom scrub) hints the top-level art
// roots for raster reuse and removes the hints when it ends or is
// interrupted; after it settles, the canvas matches an exact render at the
// same camera.

const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };

const shape = (id: string, parentId: string, x: number, y: number, extra) => ({
  appearance: {
    fills: [
      {
        enabled: true,
        id: "fill",
        opacity: 1,
        paint: { color: "#1f6feb", kind: "solid" },
      },
    ],
    strokes: [
      {
        align: "center",
        cap: "butt",
        enabled: true,
        id: "stroke",
        join: "miter",
        miterLimit: 4,
        opacity: 1,
        paint: { color: "#111111", kind: "solid" },
        width: 1.5,
      },
    ],
  },
  cornerRadius: 0,
  height: 90,
  id,
  opacity: 1,
  parentId,
  shape: "polygon",
  transform: { ...IDENTITY, rotation: 17, x, y },
  type: "shape",
  visible: true,
  width: 140,
  ...extra,
});

const shadow = (blur: number) => ({
  blur,
  color: "#000000",
  enabled: true,
  id: `shadow-${blur}`,
  kind: "drop-shadow",
  opacity: 0.7,
  x: 12,
  y: 16,
});

const DOCUMENT = JSON.stringify({
  assets: {},
  nodes: [
    {
      background: "#ffffff",
      height: 800,
      id: "art",
      locked: false,
      name: "Art",
      opacity: 1,
      parentId: "root",
      transform: IDENTITY,
      type: "artboard",
      visible: true,
      width: 1200,
    },
    ...Array.from({ length: 12 }, (_, index) =>
      shape(
        `s${index}`,
        "art",
        120 + (index % 4) * 280,
        140 + Math.floor(index / 4) * 240,
        {
          effects: [shadow(index % 2 ? 24 : 0)],
        }
      )
    ),
    {
      effects: [shadow(8), { ...shadow(0), id: "group-second", x: -10 }],
      id: "g",
      name: "g",
      opacity: 0.8,
      parentId: "art",
      transform: IDENTITY,
      type: "group",
      visible: true,
    },
    shape("in-group", "g", 600, 700, {}),
    shape("loose", "root", 1500, 300, { effects: [shadow(24)] }),
  ],
  version: "1.12",
});

const frames = (page: Page, count = 2) => {
  return page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
};

const readReuse = (page: Page) => {
  return page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    return {
      hinted: [
        ...document.querySelectorAll<HTMLElement>(
          ".canvas-node-layer [data-presentation-node-id], .canvas-node-layer [data-node-shell]"
        ),
      ]
        .filter((element) => element.style.willChange === "transform")
        .map(
          (element) =>
            element.dataset.presentationNodeId ??
            element.querySelector<HTMLElement>("[data-node-id]")?.dataset.nodeId
        )
        .sort(),
      mode: editor?.hostRef?.dataset.zoomRasterMode ?? null,
      owner: editor?.continuousZoom?.owner ?? null,
    };
  });
};

const pinchTo = (page: Page, zooms: number[]) => {
  return page.evaluate(async (steps) => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const holder = window as never as { zoomSession: unknown };

    holder.zoomSession = editor?.beginContinuousZoom("pinch");

    for (const zoom of steps) {
      editor?.moveViewportTo({ x: -100, y: -60, zoom });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, zooms);
};

const endPinch = (page: Page) => {
  return page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.endContinuousZoom(
      (window as never as { zoomSession: never }).zoomSession,
      "end"
    );
  });
};

const captureHost = async (page: Page) => {
  const box = await page.locator(".canvas-host").boundingBox();

  if (!box) {
    throw new Error("Expected canvas host");
  }

  // Leave the overlay-free middle of the canvas.
  return decodePng(
    await page.screenshot({
      clip: {
        height: Math.floor(box.height * 0.6),
        width: Math.floor(box.width * 0.6),
        x: box.x + box.width * 0.2,
        y: box.y + box.height * 0.2,
      },
    })
  );
};

const countMismatches = (left, right) => {
  let mismatches = 0;

  for (let index = 0; index < left.data.length; index += 4) {
    const delta = Math.max(
      Math.abs(left.data[index] - right.data[index]),
      Math.abs(left.data[index + 1] - right.data[index + 1]),
      Math.abs(left.data[index + 2] - right.data[index + 2])
    );

    if (delta > 2) {
      mismatches += 1;
    }
  }

  return mismatches;
};

test.use({ channel: "chromium" });

test.beforeEach(async ({ page }) => {
  await gotoEditor(page);
  await loadDocument(page, DOCUMENT);
  await setViewport(page, { x: -100, y: -60, zoom: 1 });
  await frames(page, 3);
});

test("a pinch hints top-level art roots and settles exact", async ({
  page,
}) => {
  await pinchTo(page, [0.9, 0.7, 0.5]);

  expect(await readReuse(page)).toEqual({
    hinted: ["art", "loose"],
    mode: "reuse",
    owner: "pinch",
  });

  await endPinch(page);

  expect(await readReuse(page)).toEqual({
    hinted: [],
    mode: null,
    owner: null,
  });
});

test("a pinch over an empty document clears the reuse mode on settle", async ({
  page,
}) => {
  await loadDocument(
    page,
    JSON.stringify({ ...JSON.parse(DOCUMENT), nodes: [] })
  );
  await frames(page, 3);
  await pinchTo(page, [0.9, 0.7]);

  expect((await readReuse(page)).mode).toBe("reuse");

  await endPinch(page);

  expect(await readReuse(page)).toEqual({
    hinted: [],
    mode: null,
    owner: null,
  });
});

for (const dpr of [1, 2]) {
  test.describe(`settled pixels @ DPR ${dpr}`, () => {
    test.use({
      deviceScaleFactor: dpr,
      viewport: { height: 800, width: 1200 },
    });

    test("match an exact render at the same camera", async ({
      page,
      browser,
    }) => {
      // Zoom in past the start and out again, releasing at a fractional zoom.
      await pinchTo(page, [1.2, 1.6, 1.1, 0.8, 0.6173]);
      await endPinch(page);
      await frames(page, 2);

      const settled = await captureHost(page);
      const exactPage = await browser.newPage({
        deviceScaleFactor: dpr,
        viewport: { height: 800, width: 1200 },
      });

      await gotoEditor(exactPage);
      await loadDocument(exactPage, DOCUMENT);
      await setViewport(exactPage, { x: -100, y: -60, zoom: 0.6173 });
      await frames(exactPage, 3);

      const exact = await captureHost(exactPage);

      await exactPage.close();

      expect(settled.width).toBe(exact.width);
      expect(countMismatches(settled, exact)).toBe(0);
    });
  });
}

test("ctrl-wheel zoom reuses raster and settles within a few frames", async ({
  page,
}) => {
  const box = await page.locator(".canvas-host").boundingBox();

  // Wheel events at a 60 Hz cadence, then count frames from the last one
  // until reuse ends (no gesture-end event exists for wheels).
  const { framesToSettle, ownerDuringWheel } = await page.evaluate(
    async (point) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const target = document.elementFromPoint(point.x, point.y);
      const nextFrame = () =>
        new Promise((resolve) => requestAnimationFrame(resolve));
      let owner: string | null = null;

      for (let index = 0; index < 6; index += 1) {
        target?.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: point.x,
            clientY: point.y,
            ctrlKey: true,
            deltaY: -8,
          })
        );
        owner ??= editor?.continuousZoom?.owner ?? null;
        await nextFrame();
        await nextFrame();
      }

      for (let frame = 1; frame <= 30; frame += 1) {
        await nextFrame();

        if (!editor?.continuousZoom) {
          return { framesToSettle: frame, ownerDuringWheel: owner };
        }
      }

      return { framesToSettle: 99, ownerDuringWheel: owner };
    },
    { x: (box?.x ?? 0) + 300, y: (box?.y ?? 0) + 300 }
  );

  expect(ownerDuringWheel).toBe("wheel");
  // The loop already waited two quiet frames after the last wheel event;
  // reuse ends on the next one (the third frame after the last event).
  expect(framesToSettle).toBe(1);
  expect(await readReuse(page)).toEqual({
    hinted: [],
    mode: null,
    owner: null,
  });
});

test("the zoom scrub reuses raster until release", async ({ page }) => {
  const control = page.getByRole("slider", { name: "Canvas zoom" });
  const box = await control.boundingBox();
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y, { steps: 4 });

  expect((await readReuse(page)).owner).toBe("scrub");

  await page.mouse.up();

  expect(await readReuse(page)).toEqual({
    hinted: [],
    mode: null,
    owner: null,
  });
});

const INTERRUPTIONS: [string, (page: Page) => Promise<unknown>][] = [
  [
    "window blur",
    (page) => page.evaluate(() => window.dispatchEvent(new Event("blur"))),
  ],
  [
    "tab hide",
    (page) =>
      page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      }),
  ],
  [
    "pointer-down",
    async (page) => {
      const box = await page.locator(".canvas-host").boundingBox();

      await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 40);
      await page.mouse.down();
      await page.mouse.up();
    },
  ],
  [
    "edit",
    (page) =>
      page.evaluate(() =>
        window.__PUNCHPRESS_EDITOR__?.updateNode("s0", { opacity: 0.5 })
      ),
  ],
  [
    "discrete zoom",
    (page) => page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.zoomIn()),
  ],
  [
    "unmount",
    (page) =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;

        editor?.detachViewport(editor.viewerRef);
      }),
  ],
];

for (const [label, interrupt] of INTERRUPTIONS) {
  test(`${label} mid-zoom settles immediately`, async ({ page }) => {
    await pinchTo(page, [0.9, 0.8]);

    expect((await readReuse(page)).mode).toBe("reuse");

    await interrupt(page);

    expect(await readReuse(page)).toEqual({
      hinted: [],
      mode: null,
      owner: null,
    });
  });
}
