import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "./helpers/editor";
import { decodePng } from "./helpers/png";

// A 0.5-opacity group holding two overlapping opaque black squares must paint
// the overlap exactly like the non-overlapping parts (isolated compositing),
// on canvas in both the expanded and dense representations and in export.
const solid = (id: string, x: number, parentId = "g") => ({
  appearance: {
    fills: [
      {
        enabled: true,
        id: "fill-1",
        opacity: 1,
        paint: { color: "#000000", kind: "solid" },
      },
    ],
    strokes: [],
  },
  cornerRadius: 0,
  height: 200,
  id,
  opacity: 1,
  parentId,
  shape: "polygon",
  transform: { rotation: 0, scaleX: 1, scaleY: 1, x, y: 300 },
  type: "shape",
  visible: true,
  width: 200,
});

const createDocument = (fillerCount: number) => {
  return JSON.stringify({
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
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "artboard",
        visible: true,
        width: 1000,
      },
      {
        id: "g",
        name: "Group",
        opacity: 0.5,
        parentId: "art",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      solid("a", 300),
      solid("b", 400),
      // Tiny far-away fillers push the group over the dense threshold.
      ...Array.from({ length: fillerCount }, (_, index) => ({
        ...solid(`filler-${index}`, 950),
        height: 1,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 950, y: 790 },
        width: 1,
      })),
    ],
    version: "1.9",
  });
};

// Left-only, overlap, and right-only sample points in world space.
const SAMPLE_POINTS = [
  { name: "a only", x: 240, y: 300 },
  { name: "overlap", x: 350, y: 300 },
  { name: "b only", x: 460, y: 300 },
];

const sampleCanvas = async (page: Page, offset = { x: 0, y: 0 }) => {
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.evaluate(async () => {
    for (let index = 0; index < 3; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });

  const values: number[] = [];

  for (const point of SAMPLE_POINTS) {
    const screen = await page.evaluate(
      (world) => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const viewer = editor?.viewerRef;
        const host = editor?.hostRef?.getBoundingClientRect();

        return {
          x: (host?.left ?? 0) + (world.x - (viewer?.getScrollLeft() ?? 0)),
          y: (host?.top ?? 0) + (world.y - (viewer?.getScrollTop() ?? 0)),
        };
      },
      { x: point.x + offset.x, y: point.y + offset.y }
    );
    const image = decodePng(
      await page.screenshot({
        clip: { height: 1, width: 1, x: screen.x, y: screen.y },
      })
    );

    values.push(image.data[0]);
  }

  return values;
};

for (const [label, fillerCount] of [
  ["expanded", 0],
  ["dense", 301],
] as const) {
  test(`translucent group composites once (${label})`, async ({ page }) => {
    await gotoEditor(page);
    await loadDocument(page, createDocument(fillerCount));

    const placed = await page.evaluate(() => {
      return window.__PUNCHPRESS_EDITOR__?.getRenderTree().placedNodeIds;
    });

    expect(placed?.includes("g")).toBe(fillerCount > 0);

    const [left, overlap, right] = await sampleCanvas(page);

    // 50% black over white is ~128; a double-darkened overlap would be ~64.
    expect(Math.abs(left - 128)).toBeLessThanOrEqual(6);
    expect(Math.abs(overlap - left)).toBeLessThanOrEqual(3);
    expect(Math.abs(right - left)).toBeLessThanOrEqual(3);

    // Dragged as one presentation root by a fractional delta, the group
    // still composites once.
    const delta = { x: 40.5, y: 20.25 };

    await page.evaluate((step) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const holder = window as never as { dragSession: unknown };

      editor?.setSelectedNodes(["g"]);
      holder.dragSession = editor?.beginSelectionDrag({ nodeIds: ["g"] });
      editor?.updateSelectionDrag(holder.dragSession, { delta: step });
    }, delta);

    const [movedLeft, movedOverlap, movedRight] = await sampleCanvas(
      page,
      delta
    );

    expect(Math.abs(movedLeft - 128)).toBeLessThanOrEqual(6);
    expect(Math.abs(movedOverlap - movedLeft)).toBeLessThanOrEqual(3);
    expect(Math.abs(movedRight - movedLeft)).toBeLessThanOrEqual(3);
  });
}

test("exported artboard composites the translucent group once", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, createDocument(0));

  const values = await page.evaluate(async (points) => {
    const svg =
      await window.__PUNCHPRESS_EDITOR__?.exportSelectedArtboardSvg("art");
    const image = new Image();

    image.src = URL.createObjectURL(
      new Blob([svg ?? ""], { type: "image/svg+xml" })
    );
    await image.decode();

    const canvas = document.createElement("canvas");

    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });

    context?.drawImage(image, 0, 0);

    return points.map((point) => {
      return context?.getImageData(point.x, point.y, 1, 1).data[0] ?? -1;
    });
  }, SAMPLE_POINTS);

  expect(Math.abs(values[0] - 128)).toBeLessThanOrEqual(6);
  expect(Math.abs(values[1] - values[0])).toBeLessThanOrEqual(3);
  expect(Math.abs(values[2] - values[0])).toBeLessThanOrEqual(3);
});
