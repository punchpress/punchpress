import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument, setViewport } from "./helpers/editor";

const dropGeneratedJpeg = async (
  page: Page,
  {
    height,
    orientation = null,
    width,
  }: { height: number; orientation?: number | null; width: number }
) => {
  await page.evaluate(
    async (size) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = size.width;
      canvas.height = size.height;

      if (!context) {
        throw new Error("Expected a Canvas2D fixture context");
      }

      context.fillStyle = "#111111";
      context.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < canvas.height; y += 6) {
        context.fillStyle = y % 12 === 0 ? "#f7f7f7" : "#281058";
        context.fillRect(0, y, canvas.width, 3);
      }

      for (let x = 0; x < canvas.width; x += 17) {
        context.fillStyle = x % 34 === 0 ? "#f05a28" : "#25d9e8";
        context.fillRect(x, 0, 2, canvas.height);
      }

      context.lineWidth = 9;
      context.strokeStyle = "#ffffff";
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(canvas.width, canvas.height);
      context.stroke();

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
              return;
            }

            reject(new Error("Could not encode the JPEG fixture"));
          },
          "image/jpeg",
          0.94
        );
      });
      let fileBlob = blob;

      if (size.orientation) {
        const original = new Uint8Array(await blob.arrayBuffer());
        const exif = new Uint8Array([
          0xff,
          0xe1,
          0x00,
          0x22,
          0x45,
          0x78,
          0x69,
          0x66,
          0x00,
          0x00,
          0x49,
          0x49,
          0x2a,
          0x00,
          0x08,
          0x00,
          0x00,
          0x00,
          0x01,
          0x00,
          0x12,
          0x01,
          0x03,
          0x00,
          0x01,
          0x00,
          0x00,
          0x00,
          size.orientation,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
        ]);
        const oriented = new Uint8Array(original.length + exif.length);

        oriented.set(original.slice(0, 2), 0);
        oriented.set(exif, 2);
        oriented.set(original.slice(2), 2 + exif.length);
        fileBlob = new Blob([oriented], { type: "image/jpeg" });
      }

      const file = new File(
        [fileBlob],
        `import-${size.width}x${size.height}.jpg`,
        {
          type: "image/jpeg",
        }
      );
      const transfer = new DataTransfer();
      const host = document.querySelector(".canvas-host");

      if (!host) {
        throw new Error("Expected the canvas host");
      }

      transfer.items.add(file);
      const rect = host.getBoundingClientRect();
      const eventInit = {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        dataTransfer: transfer,
      };

      host.dispatchEvent(new DragEvent("dragover", eventInit));
      host.dispatchEvent(new DragEvent("drop", eventInit));
    },
    { height, orientation, width }
  );
};

const importGeneratedJpeg = async (
  page: Page,
  size: { height: number; orientation?: number | null; width: number }
) => {
  await dropGeneratedJpeg(page, size);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__PUNCHPRESS_EDITOR__?.nodes.find(
            (candidate) => candidate.type === "image"
          )?.id ?? null
      )
    )
    .not.toBeNull();
};

test("imports a small JPEG at one document unit per source pixel", async ({
  page,
}) => {
  await gotoEditor(page);
  await importGeneratedJpeg(page, { height: 180, width: 320 });

  const imported = await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.nodes.find((candidate) => candidate.type === "image");
    const presentation = node
      ? editor?.rasterSurface?.getPresentation?.(node.id)
      : null;

    return node && presentation
      ? {
          canvasHeight: presentation.canvas.height,
          canvasWidth: presentation.canvas.width,
          height: node.height,
          width: node.width,
        }
      : null;
  });

  expect(imported).toEqual({
    canvasHeight: 180,
    canvasWidth: 320,
    height: 180,
    width: 320,
  });
});

test("uses the browser-decoded dimensions for EXIF-oriented JPEG imports", async ({
  page,
}) => {
  await gotoEditor(page);
  await importGeneratedJpeg(page, {
    height: 20,
    orientation: 6,
    width: 40,
  });

  expect(
    await page.evaluate(() => {
      const node = window.__PUNCHPRESS_EDITOR__?.nodes.find(
        (candidate) => candidate.type === "image"
      );

      return node ? { height: node.height, width: node.width } : null;
    })
  ).toEqual({ height: 40, width: 20 });
});

test("rejects an imported JPEG beyond the finite Raster allocation limit", async ({
  page,
}) => {
  await gotoEditor(page);
  await dropGeneratedJpeg(page, { height: 1, width: 16_385 });

  await expect(
    page
      .getByRole("alert")
      .getByText(
        "Import image failed: Image dimensions exceed the 16,384px side or 100,000,000px area limit."
      )
      .first()
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        window.__PUNCHPRESS_EDITOR__?.nodes.filter(
          (candidate) => candidate.type === "image"
        ).length ?? 0
    )
  ).toBe(0);
});

test("imports a 2000px JPEG at its natural Raster geometry and pixel plane", async ({
  page,
}) => {
  await gotoEditor(page);
  await importGeneratedJpeg(page, { height: 2000, width: 2000 });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const node = editor?.nodes.find(
          (candidate) => candidate.type === "image"
        );
        const presentation = node
          ? editor?.rasterSurface?.getPresentation?.(node.id)
          : null;

        return node && presentation
          ? {
              canvasHeight: presentation.canvas.height,
              canvasWidth: presentation.canvas.width,
              height: node.height,
              width: node.width,
            }
          : null;
      })
    )
    .toEqual({
      canvasHeight: 2000,
      canvasWidth: 2000,
      height: 2000,
      width: 2000,
    });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__PUNCHPRESS_EDITOR__?.getState().viewport.zoom ?? 1
      )
    )
    .toBeLessThan(1);
});

test("does not refit the camera when importing beside existing document content", async ({
  page,
}) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: 600,
          id: "existing-artboard",
          locked: false,
          name: "Existing artboard",
          opacity: 1,
          parentId: "root",
          transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          type: "artboard",
          visible: true,
          width: 600,
        },
      ],
      version: "1.8",
    })
  );
  await setViewport(page, { x: 120, y: 160, zoom: 0.5 });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;

    editor?.setViewportInteracting(false);
    editor?.getState().setViewport({ x: 120, y: 160, zoom: 0.5 });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__PUNCHPRESS_EDITOR__?.getState().viewport.zoom ?? 0
      )
    )
    .toBe(0.5);
  await importGeneratedJpeg(page, { height: 2000, width: 2000 });

  await expect
    .poll(() =>
      page.evaluate(
        () => window.__PUNCHPRESS_EDITOR__?.getState().viewport.zoom ?? 0
      )
    )
    .toBe(0.5);
});

test("resizes an imported JPEG from its natural plane in one high-quality step", async ({
  page,
}) => {
  await gotoEditor(page);
  await importGeneratedJpeg(page, { height: 2000, width: 2000 });

  const fidelity = await page.evaluate(async () => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const node = editor?.nodes.find((candidate) => candidate.type === "image");

    if (!(editor && node?.type === "image")) {
      throw new Error("Expected an imported Raster");
    }

    const startingCanvas = editor.rasterSurface?.getPresentation?.(
      node.id
    )?.canvas;

    if (
      !(
        startingCanvas &&
        startingCanvas.width === 2000 &&
        startingCanvas.height === 2000
      )
    ) {
      throw new Error("Expected the natural imported Raster plane");
    }

    const reference = document.createElement("canvas");
    const referenceContext = reference.getContext("2d");

    reference.width = 1297;
    reference.height = 1297;

    if (!referenceContext) {
      throw new Error("Expected a reference Raster context");
    }

    referenceContext.imageSmoothingEnabled = true;
    referenceContext.imageSmoothingQuality = "high";
    referenceContext.drawImage(startingCanvas, 0, 0, 1297, 1297);

    await editor.resizeRaster(node.id, { width: 1297 });
    const resident = editor.rasterSurface?.getPresentation?.(node.id)?.canvas;

    if (!resident) {
      throw new Error("Expected the committed Raster canvas");
    }

    const actual = resident
      .getContext("2d")
      ?.getImageData(0, 0, 1297, 1297).data;
    const expected = referenceContext.getImageData(0, 0, 1297, 1297).data;

    if (!actual) {
      throw new Error("Expected committed Raster pixels");
    }

    let absoluteError = 0;

    for (let index = 0; index < actual.length; index += 4) {
      absoluteError += Math.abs(actual[index] - expected[index]);
      absoluteError += Math.abs(actual[index + 1] - expected[index + 1]);
      absoluteError += Math.abs(actual[index + 2] - expected[index + 2]);
    }

    return {
      canvasHeight: resident.height,
      canvasWidth: resident.width,
      meanAbsoluteError: absoluteError / ((actual.length / 4) * 3),
    };
  });

  expect(fidelity.canvasHeight).toBe(1297);
  expect(fidelity.canvasWidth).toBe(1297);
  expect(fidelity.meanAbsoluteError).toBeLessThan(1);
});
