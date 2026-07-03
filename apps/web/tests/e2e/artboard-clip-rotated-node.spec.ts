import { expect, test } from "@playwright/test";
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

const getClipInsets = (page, nodeId) => {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    const shell =
      el?.parentElement?.dataset?.nodeShell === "true" ? el.parentElement : el;
    const clip = shell ? getComputedStyle(shell).clipPath : "";
    const start = clip.indexOf("inset(");
    const end = clip.indexOf(")", start);
    if (start < 0 || end < 0) {
      return { clip, insets: null };
    }
    // Computed clip-path normalizes whitespace to single spaces.
    const parts = clip
      .slice(start + "inset(".length, end)
      .trim()
      .split(" ")
      .map((value) => Number.parseFloat(value));
    if (parts.some((value) => Number.isNaN(value))) {
      return { clip, insets: null };
    }
    // Expand the CSS 1/2/3/4-value shorthand.
    const [top, right = top, bottom = top, left = right] = parts;
    return { clip, insets: { bottom, left, right, top } };
  }, nodeId);
};

test("artboard clip region extends past a rotated child's unrotated frame", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadClipDocument(page);
  await resetViewport(page);
  await pauseForUi(page, 600);

  // The rotated shape sits fully inside the artboard, so the clip region (the
  // artboard rect expressed relative to the node's unrotated shell box) must
  // extend beyond the box on every side: all insets negative. The old code
  // clamped these at 0, shearing rotated content along its own frame edges.
  const rotated = await getClipInsets(page, "rotated-shape");
  expect(rotated.insets).not.toBeNull();
  expect(rotated.insets.top).toBeLessThan(0);
  expect(rotated.insets.right).toBeLessThan(0);
  expect(rotated.insets.bottom).toBeLessThan(0);
  expect(rotated.insets.left).toBeLessThan(0);
});

test("artboard still clips children at its own edges", async ({ page }) => {
  await gotoEditor(page);
  await loadClipDocument(page);
  await resetViewport(page);
  await pauseForUi(page, 600);

  // The edge shape spans x 450..750 against a 600-wide artboard: the clip
  // must cut exactly 150px from its right side and stay open elsewhere.
  const edge = await getClipInsets(page, "edge-shape");
  expect(edge.insets).not.toBeNull();
  expect(edge.insets.right).toBeCloseTo(150, 0);
  expect(edge.insets.top).toBeLessThan(0);
  expect(edge.insets.bottom).toBeLessThan(0);
  expect(edge.insets.left).toBeLessThan(0);
});
