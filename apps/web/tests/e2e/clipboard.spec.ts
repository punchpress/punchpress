import { expect, test } from "@playwright/test";
import { PUNCH_CLIPBOARD_MIME_TYPE } from "@punchpress/punch-schema";
import {
  getSelectionSnapshot,
  getStateSnapshot,
  gotoEditor,
  loadDocumentFixture,
  pauseForUi,
  waitForNodeReady,
} from "./helpers/editor";

const dispatchClipboardEvent = (page, type, data) => {
  return page.evaluate(
    ({ eventType, eventData, mimeType }) => {
      const clipboardData = new DataTransfer();

      for (const [key, value] of Object.entries(eventData || {})) {
        if (typeof value === "string" && value.length > 0) {
          clipboardData.setData(key, value);
        }
      }

      const event = new ClipboardEvent(eventType, {
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, "clipboardData", {
        configurable: true,
        value: clipboardData,
      });

      document.dispatchEvent(event);

      return {
        html: clipboardData.getData("text/html"),
        plainText: clipboardData.getData("text/plain"),
        punchpress: clipboardData.getData(mimeType),
      };
    },
    {
      eventData: data,
      eventType: type,
      mimeType: PUNCH_CLIPBOARD_MIME_TYPE,
    }
  );
};

const grantClipboardPermissions = async (page) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4173",
  });
};

test("copies and pastes the selected node with keyboard shortcuts", async ({
  page,
}) => {
  await grantClipboardPermissions(page);
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-duplicate-shortcut.punch");
  const originalNodeId = "duplicate-shortcut-node";

  await page.getByRole("button", { name: "Duplicate me" }).first().click();

  const original = await waitForNodeReady(page, originalNodeId);
  await page.keyboard.press("ControlOrMeta+C");
  await page.keyboard.press("ControlOrMeta+V");
  await pauseForUi(page);

  const selection = await getSelectionSnapshot(page);
  const duplicateNodeId = selection.selectedNodeId;

  expect(duplicateNodeId).not.toBe(originalNodeId);

  const duplicate = await waitForNodeReady(page, duplicateNodeId);
  const state = await getStateSnapshot(page);

  expect(state.nodes).toHaveLength(2);
  expect(duplicate.text).toBe(original.text);
  expect(duplicate.x).toBe(original.x + 120);
  expect(duplicate.y).toBe(original.y + 120);
});

test("copies and pastes the selected node through clipboard events", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-duplicate-shortcut.punch");
  const originalNodeId = "duplicate-shortcut-node";

  await page.getByRole("button", { name: "Duplicate me" }).first().click();

  const original = await waitForNodeReady(page, originalNodeId);
  const copied = await dispatchClipboardEvent(page, "copy");

  await dispatchClipboardEvent(page, "paste", {
    [PUNCH_CLIPBOARD_MIME_TYPE]: copied.punchpress,
    "text/html": copied.html,
    "text/plain": copied.plainText,
  });
  await pauseForUi(page);

  const selection = await getSelectionSnapshot(page);
  const duplicateNodeId = selection.selectedNodeId;

  expect(duplicateNodeId).not.toBe(originalNodeId);

  const duplicate = await waitForNodeReady(page, duplicateNodeId);
  const state = await getStateSnapshot(page);

  expect(state.nodes).toHaveLength(2);
  expect(duplicate.text).toBe(original.text);
  expect(duplicate.x).toBe(original.x + 120);
  expect(duplicate.y).toBe(original.y + 120);
});

test("pastes external plain text with keyboard shortcuts", async ({ page }) => {
  await grantClipboardPermissions(page);
  await gotoEditor(page);

  await page.evaluate(async () => {
    await window.navigator.clipboard.writeText("hello");
  });
  await page.keyboard.press("ControlOrMeta+V");
  await pauseForUi(page);

  const state = await getStateSnapshot(page);

  expect(state.nodes).toHaveLength(1);
  expect(state.nodes[0].text).toBe("hello");
  expect(state.selectedNodeIds).toEqual([state.nodes[0].id]);
});

test("pastes external plain text as a new text node", async ({ page }) => {
  await gotoEditor(page);

  await dispatchClipboardEvent(page, "paste", {
    "text/plain": "hello",
  });
  await pauseForUi(page);

  const state = await getStateSnapshot(page);

  expect(state.nodes).toHaveLength(1);
  expect(state.nodes[0].text).toBe("hello");
  expect(state.selectedNodeIds).toEqual([state.nodes[0].id]);
});
