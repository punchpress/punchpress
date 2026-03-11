import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  exportDocument,
  getStateSnapshot,
  gotoEditor,
  loadDocument,
  serializeDocument,
} from "./editor-helpers";

const TEST_DOCUMENT = readFileSync(
  new URL("./fixtures/documents/document-io-roundtrip.punch", import.meta.url),
  "utf8"
);

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
  expect(exported).toContain('<punchpress-document version="1.0">');
  expect(exported).toContain('"version":"1.0"');
  expect(exported).toContain("TEST");
});
