import { expect, test } from "@playwright/test";
import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultPathNode,
  createDefaultShapeNode,
} from "@punchpress/engine";
import { saveDesignDocument } from "@punchpress/punch-schema";
import {
  expectCoordinateShift,
  expectRectShift,
  getNodeSnapshot,
  gotoEditor,
  loadDocument,
  setViewport,
  waitForNodeReady,
} from "./helpers/editor";

const shape = (id: string, parentId: string, x: number, y: number) => {
  const node = createDefaultShapeNode("polygon");

  return {
    ...node,
    height: 60,
    id,
    parentId,
    transform: { ...node.transform, x, y },
    width: 60,
  };
};

const group = (id: string, parentId: string, opacity = 1) => ({
  ...createDefaultGroupNode(),
  id,
  name: id,
  opacity,
  parentId,
});

const path = createDefaultPathNode("v");

// A three-deep translucent stack and a group holding a leaf and a vector inside
// an artboard, plus a selected loose leaf and an unselected bystander.
const SCENE = saveDesignDocument([
  {
    ...createDefaultArtboardNode("Print"),
    height: 900,
    id: "art",
    width: 1200,
  },
  group("s0", "art", 0.6),
  group("s0-1", "s0", 0.6),
  group("s0-2", "s0-1", 0.6),
  shape("a", "s0-2", 120, 120),
  shape("b", "s0-2", 240, 120),
  shape("c", "s0-1", 360, 120),
  group("s1", "art"),
  shape("d", "s1", 120, 420),
  {
    id: "v",
    name: "Vector",
    opacity: 1,
    parentId: "s1",
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
    type: "vector",
    visible: true,
  },
  { ...path, id: "p", transform: { ...path.transform, x: 260, y: 440 } },
  shape("f", "art", 600, 300),
  shape("u", "art", 480, 420),
] as never).contents;

// Placed shells that must follow the gesture, and the leaves it commits.
const MOVED_SHELLS = ["a", "b", "c", "d", "v", "f"];
const MOVED_LEAVES = ["a", "b", "c", "d", "p", "f"];
const DELTA = { x: 120, y: 80 };

test("dragging nested groups with a leaf previews every shell and commits one undo step", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(page, SCENE);
  // Keep the scene clear of the layers and properties panels.
  await setViewport(page, { x: -400, y: -60, zoom: 1 });

  const before = {};

  for (const nodeId of ["a", "b", "c", "d", "f", "u"]) {
    before[nodeId] = await waitForNodeReady(page, nodeId);
  }

  // The vector shell paints its child path, which has no shell of its own.
  await expect
    .poll(async () => Boolean((await getNodeSnapshot(page, "v"))?.elementRect))
    .toBe(true);
  before.v = await getNodeSnapshot(page, "v");
  before.p = await getNodeSnapshot(page, "p");

  await page.evaluate(() => {
    window.__PUNCHPRESS_EDITOR__?.setSelectedNodes(["s0", "s1", "f"]);
  });

  const start = {
    x: before.a.elementRect.x + before.a.elementRect.width / 2,
    y: before.a.elementRect.y + before.a.elementRect.height / 2,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + DELTA.x, start.y + DELTA.y, { steps: 10 });

  // Mid-gesture: every selected shell moved on screen; the document did not.
  for (const nodeId of MOVED_SHELLS) {
    await expect
      .poll(async () => {
        const rect = (await getNodeSnapshot(page, nodeId))?.elementRect;

        return Math.round((rect?.x ?? 0) - before[nodeId].elementRect.x);
      })
      .toBe(DELTA.x);

    const live = await getNodeSnapshot(page, nodeId);

    expectRectShift(before[nodeId].elementRect, live.elementRect, DELTA, 2);
  }

  for (const nodeId of MOVED_LEAVES) {
    expect((await getNodeSnapshot(page, nodeId))?.x).toBe(before[nodeId].x);
  }

  expectRectShift(
    before.u.elementRect,
    (await getNodeSnapshot(page, "u")).elementRect,
    { x: 0, y: 0 },
    1
  );

  await page.mouse.up();

  for (const nodeId of MOVED_LEAVES) {
    expectCoordinateShift(
      before[nodeId],
      await getNodeSnapshot(page, nodeId),
      DELTA,
      1
    );
  }

  // No jump after commit: shells stay where the preview left them.
  for (const nodeId of MOVED_SHELLS) {
    await expect
      .poll(async () => {
        const rect = (await getNodeSnapshot(page, nodeId))?.elementRect;

        return Math.round((rect?.y ?? 0) - before[nodeId].elementRect.y);
      })
      .toBe(DELTA.y);
  }

  expectCoordinateShift(
    before.u,
    await getNodeSnapshot(page, "u"),
    { x: 0, y: 0 },
    0
  );

  await page.keyboard.press("ControlOrMeta+z");

  for (const nodeId of MOVED_LEAVES) {
    await expect
      .poll(async () => (await getNodeSnapshot(page, nodeId))?.x)
      .toBe(before[nodeId].x);
  }
});
