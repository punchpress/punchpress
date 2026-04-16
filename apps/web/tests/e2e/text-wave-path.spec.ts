import { expect, test } from "@playwright/test";
import {
  getHandleIconRotationDeg,
  getStateSnapshot,
  gotoEditor,
  pauseForUi,
} from "./helpers/editor";

const TEST_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
};

const loadWaveDocument = async (page, rotation = 0) => {
  await page.evaluate(
    ({ font, rotation }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;

      if (!editor) {
        return false;
      }

      editor.loadDocument(
        JSON.stringify({
          nodes: [
            {
              fill: "#000000",
              font,
              fontSize: 120,
              id: "wave-node",
              parentId: "root",
              stroke: null,
              strokeWidth: 0,
              text: "FLAG",
              tracking: 0,
              transform: {
                rotation,
                scaleX: 1,
                scaleY: 1,
                x: 380,
                y: 260,
              },
              type: "text",
              visible: true,
              warp: {
                amplitude: 180,
                cycles: 2,
                kind: "wave",
              },
            },
          ],
          version: "1.6",
        })
      );

      return true;
    },
    { font: TEST_FONT, rotation }
  );
};

test("edits wave amplitude and cycles from inline handles", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadWaveDocument(page);
  await page.locator('.canvas-node[data-node-id="wave-node"]').click();
  await pauseForUi(page);

  await expect(page.getByRole("button", { name: "Edit path (E)" })).toHaveCount(
    0
  );

  const amplitudeHandle = page.getByTestId("text-path-handle-amplitude");
  const cyclesHandle = page.getByTestId("text-path-handle-cycles");

  await expect(amplitudeHandle).toBeVisible();
  await expect(cyclesHandle).toBeVisible();

  const before = await getStateSnapshot(page);
  const amplitudeBox = await amplitudeHandle.boundingBox();
  const cyclesBox = await cyclesHandle.boundingBox();
  const amplitudeRotationDeg = await getHandleIconRotationDeg(amplitudeHandle);
  const cyclesRotationDeg = await getHandleIconRotationDeg(cyclesHandle);

  expect(amplitudeBox).not.toBeNull();
  expect(cyclesBox).not.toBeNull();

  if (!(amplitudeBox && cyclesBox)) {
    return;
  }

  const amplitudeCenterX = amplitudeBox.x + amplitudeBox.width / 2;
  const cyclesCenterX = cyclesBox.x + cyclesBox.width / 2;
  const amplitudeCenterY = amplitudeBox.y + amplitudeBox.height / 2;
  const cyclesCenterY = cyclesBox.y + cyclesBox.height / 2;
  const pairCenterX = (amplitudeCenterX + cyclesCenterX) / 2;
  const nodeBox = await page
    .locator('.canvas-node[data-node-id="wave-node"]')
    .boundingBox();

  expect(Math.abs(amplitudeCenterY - cyclesCenterY)).toBeLessThanOrEqual(2);
  expect(amplitudeCenterX).toBeGreaterThan(cyclesCenterX);
  expect(amplitudeRotationDeg).toBe(-90);
  expect(cyclesRotationDeg).toBe(0);

  if (nodeBox) {
    expect(pairCenterX).toBeCloseTo(nodeBox.x + nodeBox.width / 2, 1);
    expect(amplitudeCenterY).toBeLessThan(nodeBox.y + nodeBox.height * 0.35);
  }

  await page.mouse.move(
    amplitudeBox.x + amplitudeBox.width / 2,
    amplitudeBox.y + amplitudeBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    amplitudeBox.x + amplitudeBox.width / 2,
    amplitudeBox.y + amplitudeBox.height / 2 - 80,
    {
      steps: 6,
    }
  );
  await page.mouse.up();
  await pauseForUi(page);

  const afterAmplitude = await getStateSnapshot(page);
  const updatedCyclesBox = await cyclesHandle.boundingBox();

  expect(updatedCyclesBox).not.toBeNull();

  if (!updatedCyclesBox) {
    return;
  }

  await page.mouse.move(
    updatedCyclesBox.x + updatedCyclesBox.width / 2,
    updatedCyclesBox.y + updatedCyclesBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    updatedCyclesBox.x + updatedCyclesBox.width / 2 - 80,
    updatedCyclesBox.y + updatedCyclesBox.height / 2,
    {
      steps: 6,
    }
  );
  await page.mouse.up();
  await pauseForUi(page);

  const afterCycles = await getStateSnapshot(page);
  const beforeNode = before.nodes.find((node) => node.id === "wave-node");
  const afterAmplitudeNode = afterAmplitude.nodes.find(
    (node) => node.id === "wave-node"
  );
  const afterCyclesNode = afterCycles.nodes.find(
    (node) => node.id === "wave-node"
  );

  expect(beforeNode?.warp?.kind).toBe("wave");
  expect(afterAmplitudeNode?.warp?.kind).toBe("wave");
  expect(afterCyclesNode?.warp?.kind).toBe("wave");

  if (
    !(
      beforeNode?.warp?.kind === "wave" &&
      afterAmplitudeNode?.warp?.kind === "wave" &&
      afterCyclesNode?.warp?.kind === "wave"
    )
  ) {
    return;
  }

  expect(afterAmplitudeNode.warp.amplitude).toBeLessThan(
    beforeNode.warp.amplitude
  );
  expect(afterCyclesNode.warp.cycles).toBeGreaterThan(
    afterAmplitudeNode.warp.cycles
  );
});

test("moves a wave node by dragging the visible text with inline warp controls", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadWaveDocument(page);

  const node = page.locator('.canvas-node[data-node-id="wave-node"]');

  await node.click();
  await pauseForUi(page);

  const before = await getStateSnapshot(page);
  const nodeBox = await node.boundingBox();

  expect(nodeBox).not.toBeNull();

  if (!nodeBox) {
    return;
  }

  const startX = nodeBox.x + nodeBox.width / 2;
  const startY = nodeBox.y + nodeBox.height * 0.72;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });
  await page.mouse.up();
  await pauseForUi(page);

  const after = await getStateSnapshot(page);
  const movedNode = after.nodes.find((entry) => entry.id === "wave-node");
  const beforeNode = before.nodes.find((entry) => entry.id === "wave-node");

  expect(movedNode?.x).toBeGreaterThan((beforeNode?.x || 0) + 50);
  expect(movedNode?.y).toBeGreaterThan((beforeNode?.y || 0) + 20);
});

test("rotates wave handle icons with the node while keeping circle tangent behavior separate", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadWaveDocument(page, 35);
  await page.locator('.canvas-node[data-node-id="wave-node"]').click();
  await pauseForUi(page);

  const amplitudeHandle = page.getByTestId("text-path-handle-amplitude");
  const cyclesHandle = page.getByTestId("text-path-handle-cycles");

  await expect(amplitudeHandle).toBeVisible();
  await expect(cyclesHandle).toBeVisible();

  const amplitudeRotationDeg = await getHandleIconRotationDeg(amplitudeHandle);
  const cyclesRotationDeg = await getHandleIconRotationDeg(cyclesHandle);

  expect(amplitudeRotationDeg).toBe(-55);
  expect(cyclesRotationDeg).toBe(35);
});

test("keeps the spring motion aligned with node rotation for wave cycles", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadWaveDocument(page, 35);
  await page.locator('.canvas-node[data-node-id="wave-node"]').click();
  await pauseForUi(page);

  const cyclesHandle = page.getByTestId("text-path-handle-cycles");

  await expect(cyclesHandle).toBeVisible();

  const initialBox = await cyclesHandle.boundingBox();

  expect(initialBox).not.toBeNull();

  if (!initialBox) {
    return;
  }

  const startX = initialBox.x + initialBox.width / 2;
  const startY = initialBox.y + initialBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 80, startY, { steps: 6 });
  await pauseForUi(page);

  const activeBox = await cyclesHandle.boundingBox();

  await page.mouse.up();

  expect(activeBox).not.toBeNull();

  if (!activeBox) {
    return;
  }

  const activeCenterX = activeBox.x + activeBox.width / 2;
  const activeCenterY = activeBox.y + activeBox.height / 2;

  expect(Math.abs(activeCenterX - startX)).toBeGreaterThan(1);
  expect(Math.abs(activeCenterY - startY)).toBeGreaterThan(1);
});
