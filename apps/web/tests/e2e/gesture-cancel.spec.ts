import { expect, test } from "@playwright/test";
import {
  getNodeSnapshot,
  gotoEditor,
  loadDocumentFixture,
  waitForNodeReady,
} from "./helpers/editor";

const prepareMove = async (page, testInfo) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "shape-node-transform.punch");
  await page.locator('[data-node-id="shape-node"]').click();
  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.resetHistory());
  const before = await waitForNodeReady(page, "shape-node");
  if (!before?.elementRect) {
    throw new Error("Expected a rendered shape");
  }

  await page.screenshot({ path: testInfo.outputPath("before.png") });
  const center = {
    x: before.elementRect.x + before.elementRect.width / 2,
    y: before.elementRect.y + before.elementRect.height / 2,
  };
  await page.evaluate(() => {
    window.addEventListener(
      "pointerdown",
      (event) => {
        document.body.dataset.b03PointerId = String(event.pointerId);
      },
      { capture: true, once: true }
    );
  });
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  const pointerId = Number(
    await page.locator("body").getAttribute("data-b03-pointer-id")
  );
  await page.mouse.move(center.x + 120, center.y + 80, { steps: 8 });
  await page.screenshot({ path: testInfo.outputPath("mid-gesture.png") });

  return { before, pointerId };
};

const expectMoveRolledBack = async (page, before, testInfo) => {
  await page.mouse.up();
  const after = await getNodeSnapshot(page, "shape-node");
  await page.screenshot({ path: testInfo.outputPath("after-cancel.png") });

  expect(after?.x).toBe(before.x);
  expect(after?.y).toBe(before.y);
  expect(after?.elementRect?.x).toBeCloseTo(before.elementRect.x, 1);
  expect(after?.elementRect?.y).toBeCloseTo(before.elementRect.y, 1);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.canUndo)).toBe(
    false
  );
};

test("Escape while moving restores the shape before pointer release", async ({
  page,
}, testInfo) => {
  const { before } = await prepareMove(page, testInfo);

  await page.keyboard.press("Escape");

  await expectMoveRolledBack(page, before, testInfo);
});

test("synthetic pointercancel while moving restores the shape", async ({
  page,
}, testInfo) => {
  const { before, pointerId } = await prepareMove(page, testInfo);

  await page.evaluate((activePointerId) => {
    window.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId: activePointerId,
      })
    );
  }, pointerId);

  await expectMoveRolledBack(page, before, testInfo);
});

test("pointer release commits the move as one Undo step", async ({
  page,
}, testInfo) => {
  const { before } = await prepareMove(page, testInfo);

  await page.mouse.up();
  const after = await getNodeSnapshot(page, "shape-node");
  await page.screenshot({ path: testInfo.outputPath("after-release.png") });

  expect(after?.x).toBeCloseTo(before.x + 120, 1);
  expect(after?.y).toBeCloseTo(before.y + 80, 1);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.canUndo)).toBe(
    true
  );

  await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.undo());
  const undone = await getNodeSnapshot(page, "shape-node");
  expect(undone?.x).toBe(before.x);
  expect(undone?.y).toBe(before.y);
  expect(await page.evaluate(() => window.__PUNCHPRESS_EDITOR__?.canUndo)).toBe(
    false
  );
});
