import { expect, test } from "@playwright/test";
import { readPixel, toScreen } from "./helpers/appearance-sweep";
import { gotoEditor, pauseForUi, resetViewport } from "./helpers/editor";

const loadClipDocument = (page) => {
  return page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            background: "#ffffff",
            height: 600,
            id: "artboard-1",
            locked: false,
            name: "Frame",
            opacity: 1,
            parentId: "root",
            transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
            type: "artboard",
            visible: true,
            width: 600,
          },
          {
            cornerRadius: 0,
            fill: "#3366ff",
            height: 60,
            id: "rotated-shape",
            opacity: 1,
            parentId: "artboard-1",
            shape: "ellipse",
            stroke: null,
            strokeWidth: 0,
            // Transforms are center-based: a 300x60 box centered at (300, 300)
            // rotated 60deg paints far outside its unrotated 270..330 y-band
            // while staying well inside the 600x600 artboard.
            transform: { rotation: 60, scaleX: 1, scaleY: 1, x: 300, y: 300 },
            type: "shape",
            visible: true,
            width: 300,
          },
          {
            cornerRadius: 0,
            fill: "#ff6633",
            height: 60,
            id: "edge-shape",
            opacity: 1,
            parentId: "artboard-1",
            shape: "ellipse",
            stroke: null,
            strokeWidth: 0,
            // center (600, 500): box spans x 450..750 against the 600-wide
            // artboard, straddling its right edge.
            transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 600, y: 500 },
            type: "shape",
            visible: true,
            width: 300,
          },
        ],
        version: "1.8",
      })
    );
    return true;
  });
};

// Artboards clip once, on their render layer, in stage coordinates. Shells
// never carry their own artboard clip, so a rotated child is cut by the
// artboard rect itself rather than by an inset of its unrotated frame.
const readClipState = (page) => {
  return page.evaluate(() => {
    const shellClips = [
      ...document.querySelectorAll<HTMLElement>('[data-node-shell="true"]'),
    ].map((shell) => getComputedStyle(shell).clipPath);
    const box = document
      .querySelector('[data-render-layer="artboard-1"]')
      ?.closest<HTMLElement>("[data-render-clip]");

    return {
      clipBox: box
        ? {
            height: box.offsetHeight,
            left: box.offsetLeft,
            overflow: getComputedStyle(box).overflow,
            top: box.offsetTop,
            width: box.offsetWidth,
          }
        : null,
      shellClips,
    };
  });
};

const pixelAt = async (page, point) => {
  return readPixel(page, await toScreen(page, point));
};

test("artboard clip region extends past a rotated child's unrotated frame", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadClipDocument(page);
  await resetViewport(page);
  await pauseForUi(page, 600);

  const { clipBox, shellClips } = await readClipState(page);

  expect(clipBox).toEqual({
    height: 600,
    left: 0,
    overflow: "clip",
    top: 0,
    width: 600,
  });
  expect(shellClips.every((clip) => clip === "none")).toBe(true);

  // 120 units along the rotated major axis: far outside the unrotated
  // 270..330 band, inside the artboard, so it must paint.
  const [r, g, b] = await pixelAt(page, { x: 360, y: 404 });

  expect(b).toBeGreaterThan(200);
  expect(r).toBeLessThan(120);
  expect(g).toBeLessThan(160);
});

test("artboard still clips children at its own edges", async ({ page }) => {
  await gotoEditor(page);
  await loadClipDocument(page);
  await resetViewport(page);
  await pauseForUi(page, 600);

  // The edge shape spans x 450..750 against a 600-wide artboard.
  const inside = await pixelAt(page, { x: 590, y: 500 });
  const outside = await pixelAt(page, { x: 615, y: 500 });

  expect(inside[0]).toBeGreaterThan(200);
  expect(inside[2]).toBeLessThan(120);
  // Orange would keep red high and blue low past the edge.
  expect(outside[0] - outside[2]).toBeLessThan(40);
});
