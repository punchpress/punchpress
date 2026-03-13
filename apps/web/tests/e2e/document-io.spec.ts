import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  exportDocument,
  getStateSnapshot,
  gotoEditor,
  loadDocument,
  scaleSelectedNodeBy,
  serializeDocument,
  waitForNodeReady,
} from "./editor-helpers";

const TEST_DOCUMENT = readFileSync(
  new URL("./fixtures/documents/document-io-roundtrip.punch", import.meta.url),
  "utf8"
);
const SCALED_TEXT_DOCUMENT = readFileSync(
  new URL("./fixtures/documents/scaled-text-node.punch", import.meta.url),
  "utf8"
);

const getNodeCorner = (snapshot, scaleX, scaleY, corner) => {
  const center = {
    x: (snapshot.bbox.minX + snapshot.bbox.maxX) / 2,
    y: (snapshot.bbox.minY + snapshot.bbox.maxY) / 2,
  };
  const point = {
    x: corner.endsWith("e") ? snapshot.bbox.maxX : snapshot.bbox.minX,
    y: corner.startsWith("s") ? snapshot.bbox.maxY : snapshot.bbox.minY,
  };
  const offset = {
    x: (point.x - center.x) * scaleX,
    y: (point.y - center.y) * scaleY,
  };
  const angle = (snapshot.rotation * Math.PI) / 180;

  return {
    x:
      snapshot.x +
      center.x +
      offset.x * Math.cos(angle) -
      offset.y * Math.sin(angle),
    y:
      snapshot.y +
      center.y +
      offset.x * Math.sin(angle) +
      offset.y * Math.cos(angle),
  };
};

test("loads a document and keeps it round-trippable", async ({ page }) => {
  await gotoEditor(page);

  await loadDocument(page, TEST_DOCUMENT);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.map((node) => ({
        id: node.id,
        text: node.text,
      }));
    })
    .toEqual([
      {
        id: "test-node",
        text: "TEST",
      },
    ]);

  await expect(
    page.getByRole("button", { name: "TEST" }).first()
  ).toBeVisible();

  const serialized = await serializeDocument(page);
  const exported = await exportDocument(page);

  expect(JSON.parse(serialized)).toEqual(JSON.parse(TEST_DOCUMENT));
  expect(exported).toContain("<metadata>");
  expect(exported).toContain('<punchpress-document version="1.1">');
  expect(exported).toContain('"version":"1.1"');
  expect(exported).toContain("TEST");
});

test("resizing a loaded scaled node keeps the fixed corner anchored", async ({
  page,
}) => {
  await gotoEditor(page);

  await loadDocument(page, SCALED_TEXT_DOCUMENT);

  await page.locator('[data-node-id="scaled-node"]').click();

  const beforeSnapshot = await waitForNodeReady(page, "scaled-node");
  const beforeDocument = JSON.parse(await serializeDocument(page));
  const beforeNode = beforeDocument.nodes[0];
  const fixedCornerBefore = getNodeCorner(
    beforeSnapshot,
    beforeNode.transform.scaleX,
    beforeNode.transform.scaleY,
    "nw"
  );

  await scaleSelectedNodeBy(page, { scale: 1.2 });
  const afterSnapshot = await waitForNodeReady(page, "scaled-node");
  const afterDocument = JSON.parse(await serializeDocument(page));
  const afterNode = afterDocument.nodes[0];
  const fixedCornerAfter = getNodeCorner(
    afterSnapshot,
    afterNode.transform.scaleX,
    afterNode.transform.scaleY,
    "nw"
  );

  expect(fixedCornerAfter.x).toBeCloseTo(fixedCornerBefore.x, 1);
  expect(fixedCornerAfter.y).toBeCloseTo(fixedCornerBefore.y, 1);
});
