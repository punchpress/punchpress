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

const PNG_DATA_URL_PATTERN = /^data:image\/png;base64,/;

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
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
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

test("pastes PNG clipboard bytes as a selected, undoable image", async ({
  page,
}) => {
  await grantClipboardPermissions(page);
  await gotoEditor(page);

  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 12;
    canvas.height = 8;
    const context = canvas.getContext("2d");
    context.fillStyle = "#e63946";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });

  await page.keyboard.press("ControlOrMeta+V");
  await expect
    .poll(async () => (await getStateSnapshot(page)).nodes.length)
    .toBe(1);

  const state = await getStateSnapshot(page);
  const image = await page.evaluate(
    () => window.__PUNCHPRESS_EDITOR__.nodes[0]
  );
  expect(image).toMatchObject({ height: 8, type: "image", width: 12 });
  expect(image.assetId).toBeTruthy();
  expect(image.src).toMatch(PNG_DATA_URL_PATTERN);
  expect(state.selectedNodeIds).toEqual([state.nodes[0].id]);
  await page.keyboard.press("ControlOrMeta+Z");
  await expect
    .poll(async () => (await getStateSnapshot(page)).nodes.length)
    .toBe(0);
});

test("native content wins over an accompanying image file", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocumentFixture(page, "layer-duplicate-shortcut.punch");
  await page.getByRole("button", { name: "Duplicate me" }).first().click();
  const copied = await dispatchClipboardEvent(page, "copy");

  await page.evaluate(
    ({ mimeType, punchpress }) => {
      const data = new DataTransfer();
      data.setData(mimeType, punchpress);
      data.items.add(
        new File(["not an image"], "image.png", { type: "image/png" })
      );
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "clipboardData", { value: data });
      document.dispatchEvent(event);
    },
    { mimeType: PUNCH_CLIPBOARD_MIME_TYPE, punchpress: copied.punchpress }
  );

  await expect
    .poll(async () => (await getStateSnapshot(page)).nodes.length)
    .toBe(2);
  const state = await getStateSnapshot(page);
  expect(state.nodes.every((node) => node.type === "text")).toBe(true);
});

test("leaves image paste to a focused text field", async ({ page }) => {
  await gotoEditor(page);

  const prevented = await page.evaluate(() => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const data = new DataTransfer();
    data.items.add(
      new File(["not an image"], "image.png", { type: "image/png" })
    );
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: data });
    input.dispatchEvent(event);
    input.remove();
    return event.defaultPrevented;
  });

  expect(prevented).toBe(false);
  expect((await getStateSnapshot(page)).nodes).toHaveLength(0);
});

test("reports an invalid image without changing the document", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(["not an image"], "broken.png", { type: "image/png" })
    );
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: data });
    document.dispatchEvent(event);
  });

  await expect(page.locator('[data-slot="toast-message"]')).toBeVisible();
  await expect(page.locator('[data-slot="toast-message"]')).toHaveText(
    "Import image failed: Could not load image dimensions."
  );
  expect((await getStateSnapshot(page)).nodes).toHaveLength(0);
});
