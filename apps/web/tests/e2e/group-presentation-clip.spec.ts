import { expect, type Page, test } from "@playwright/test";
import {
  centerOn,
  expectColor,
  readPixel,
  toScreen,
} from "./helpers/appearance-sweep";
import { gotoEditor, loadDocument } from "./helpers/editor";

// Artboard clips stay stationary while a group's presentation root moves
// beneath them, and move with an artboard drag. Content outside an artboard
// is clipped at its edge, a rotated child is clipped along the artboard rect
// (not its own frame), and a shadow cast inward from off-artboard content
// stays visible. The artboard sits at negative coordinates.

const IDENTITY = { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 };
const BLUE = [31, 111, 235];
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

const square = (
  id: string,
  parentId: string,
  box: { rotation?: number; size: number; x: number; y: number }
) => ({
  appearance: {
    fills: [
      {
        enabled: true,
        id: "fill",
        opacity: 1,
        paint: { color: "#1f6feb", kind: "solid" },
      },
    ],
    strokes: [],
  },
  cornerRadius: 0,
  height: box.size,
  id,
  opacity: 1,
  parentId,
  shape: "polygon",
  transform: { ...IDENTITY, rotation: box.rotation ?? 0, x: box.x, y: box.y },
  type: "shape",
  visible: true,
  width: box.size,
});

const group = (id: string, parentId: string, extra = {}) => ({
  id,
  name: id,
  opacity: 1,
  parentId,
  transform: IDENTITY,
  type: "group",
  visible: true,
  ...extra,
});

// Artboard spans -400..400 × -300..300.
const DOCUMENT = JSON.stringify({
  assets: {},
  nodes: [
    {
      background: "#ffffff",
      height: 600,
      id: "art",
      locked: false,
      name: "Art",
      opacity: 1,
      parentId: "root",
      transform: { ...IDENTITY, x: -400, y: -300 },
      type: "artboard",
      visible: true,
      width: 800,
    },
    group("g", "art"),
    // Spans 250..350 × -50..50, inside the right edge.
    square("edge", "g", { size: 100, x: 300, y: 0 }),
    // A 45° square centered at (0, 260): its corner reaches y ≈ 331, past
    // the bottom edge at 300.
    square("rotated", "g", { rotation: 45, size: 100, x: 0, y: 260 }),
    // A square at -520..-440 (outside the left edge) shadows 120 inward to
    // -400..-320.
    group("caster", "art", {
      effects: [
        {
          blur: 0,
          color: "#000000",
          enabled: true,
          id: "shadow",
          kind: "drop-shadow",
          opacity: 1,
          x: 120,
          y: 0,
        },
      ],
    }),
    square("outside", "caster", { size: 80, x: -480, y: -200 }),
  ],
  version: "1.12",
});

const frames = (page: Page, count = 3) => {
  return page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
};

const pixelAt = async (page: Page, point: { x: number; y: number }) => {
  return readPixel(page, await toScreen(page, point));
};

const drag = (page: Page, nodeIds: string[], delta) => {
  return page.evaluate(
    ({ ids, step }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const holder = window as never as { dragSession: unknown };

      editor?.setSelectedNodes(ids);
      holder.dragSession = editor?.beginSelectionDrag({ nodeIds: ids });
      editor?.updateSelectionDrag(holder.dragSession, { delta: step });
    },
    { ids: nodeIds, step: delta }
  );
};

const release = async (page: Page, cancel = false) => {
  await page.evaluate((isCancel) => {
    window.__PUNCHPRESS_EDITOR__?.endSelectionDrag(
      (window as never as { dragSession: unknown }).dragSession,
      isCancel ? { cancel: true } : {}
    );
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes([]);
  }, cancel);
  await frames(page);
};

test.use({ channel: "chromium" });

for (const dpr of [1, 2]) {
  test.describe(`group presentation clips @ DPR ${dpr}`, () => {
    test.use({
      deviceScaleFactor: dpr,
      viewport: { height: 900, width: 1400 },
    });

    test("clips stay at artboard edges while groups move and follow artboard drags", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await gotoEditor(page);
      await loadDocument(page, DOCUMENT);
      await centerOn(page, { x: 0, y: 0 }, 1);

      const outsideBackground = await pixelAt(page, { x: 600, y: 0 });

      // Idle: the off-artboard square is clipped, its shadow shows inside;
      // the rotated corner stops at the bottom edge.
      expectColor(
        await pixelAt(page, { x: -480, y: -200 }),
        outsideBackground,
        "caster clipped"
      );
      expectColor(
        await pixelAt(page, { x: -360, y: -200 }),
        BLACK,
        "inward shadow"
      );
      expectColor(
        await pixelAt(page, { x: 0, y: 290 }),
        BLUE,
        "rotated inside"
      );
      expectColor(
        await pixelAt(page, { x: 0, y: 320 }),
        outsideBackground,
        "rotated clipped"
      );

      // Drag the group 100.5 right: the edge square straddles x = 400.
      await drag(page, ["g"], { x: 100.5, y: 0 });
      await frames(page);
      expectColor(
        await pixelAt(page, { x: 390, y: 0 }),
        BLUE,
        "moving inside edge"
      );
      expectColor(
        await pixelAt(page, { x: 420, y: 0 }),
        outsideBackground,
        "moving past edge"
      );
      expectColor(
        await pixelAt(page, { x: 100, y: 320 }),
        outsideBackground,
        "moving rotated clipped"
      );
      expectColor(
        await pixelAt(page, { x: 100, y: 290 }),
        BLUE,
        "moving rotated inside"
      );
      await release(page);
      expectColor(
        await pixelAt(page, { x: 390, y: 0 }),
        BLUE,
        "committed inside edge"
      );
      expectColor(
        await pixelAt(page, { x: 420, y: 0 }),
        outsideBackground,
        "committed past edge"
      );

      // Drag the shadow caster 60 right: more of its shadow lands inside.
      await drag(page, ["caster"], { x: 60, y: 0 });
      await frames(page);
      expectColor(
        await pixelAt(page, { x: -300, y: -200 }),
        BLACK,
        "moving inward shadow"
      );
      expectColor(
        await pixelAt(page, { x: -410, y: -200 }),
        outsideBackground,
        "moving caster clipped"
      );
      await release(page, true);

      // Drag the artboard 200 down: its clip moves with it.
      await centerOn(page, { x: 0, y: 200 }, 1);
      await drag(page, ["art"], { x: 0, y: 200 });
      await frames(page);
      expectColor(
        await pixelAt(page, { x: 0, y: 320 }),
        WHITE,
        "moved artboard background"
      );
      expectColor(
        await pixelAt(page, { x: 100, y: 490 }),
        BLUE,
        "moved rotated inside"
      );
      expectColor(
        await pixelAt(page, { x: 100, y: 520 }),
        outsideBackground,
        "moved rotated clipped"
      );
      expectColor(
        await pixelAt(page, { x: -360, y: 0 }),
        BLACK,
        "moved inward shadow"
      );
      await release(page);
      expectColor(
        await pixelAt(page, { x: 100, y: 490 }),
        BLUE,
        "committed artboard drag"
      );
      expectColor(
        await pixelAt(page, { x: 100, y: 520 }),
        outsideBackground,
        "committed artboard clip"
      );
      expect(
        await page.evaluate(() => {
          return [
            ...document.querySelectorAll<HTMLElement>(
              "[data-presentation-node-id]"
            ),
          ].filter((element) => element.style.transform).length;
        })
      ).toBe(0);
    });
  });
}
