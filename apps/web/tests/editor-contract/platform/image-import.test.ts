import { afterEach, describe, expect, test } from "bun:test";

const originalImage = globalThis.Image;

const importImageImport = () => {
  return import(
    `../../../src/platform/image-import.ts?test=${crypto.randomUUID()}`
  );
};

const useImageDimensions = ({ height, width }) => {
  globalThis.Image = class {
    naturalHeight = height;
    naturalWidth = width;
    private loadListener: (() => void) | null = null;

    addEventListener(eventName: string, listener: () => void) {
      if (eventName === "load") {
        this.loadListener = listener;
      }
    }

    set src(_src: string) {
      queueMicrotask(() => {
        this.loadListener?.();
      });
    }
  } as unknown as typeof Image;
};

describe("image import", () => {
  afterEach(() => {
    globalThis.Image = originalImage;
  });

  test("normalizes supported image MIME types from file extensions", async () => {
    const { getSupportedImageMimeType } = await importImageImport();

    expect(
      getSupportedImageMimeType(
        new File(["jpg"], "photo.jpg", { type: "application/octet-stream" })
      )
    ).toBe("image/jpeg");
    expect(
      getSupportedImageMimeType(
        new File(["jpeg"], "photo.jpeg", { type: "image/jpg" })
      )
    ).toBe("image/jpeg");
    expect(
      getSupportedImageMimeType(new File(["png"], "photo.png", { type: "" }))
    ).toBe("image/png");
    expect(
      getSupportedImageMimeType(
        new File(["gif"], "photo.gif", { type: "image/gif" })
      )
    ).toBeNull();
  });

  test("rewrites data URL MIME type to the supported image type", async () => {
    const { normalizeImageDataUrlMimeType } = await importImageImport();

    expect(
      normalizeImageDataUrlMimeType({
        mimeType: "image/jpeg",
        src: "data:application/octet-stream;base64,abc123",
      })
    ).toBe("data:image/jpeg;base64,abc123");

    expect(
      normalizeImageDataUrlMimeType({
        mimeType: "image/png",
        src: "data:image/jpg;base64,abc123",
      })
    ).toBe("data:image/png;base64,abc123");

    expect(
      normalizeImageDataUrlMimeType({
        mimeType: "image/png",
        src: "data:;base64,abc123",
      })
    ).toBe("data:image/png;base64,abc123");
  });

  test("creates imported Raster geometry at decoded natural dimensions", async () => {
    const { createImageNodeFromDataUrl } = await importImageImport();

    useImageDimensions({ height: 2000, width: 2000 });
    const node = await createImageNodeFromDataUrl({
      mimeType: "image/jpeg",
      name: "natural.jpg",
      src: "data:image/jpeg;base64,natural",
      targetCenter: { x: 1000, y: 1000 },
    });

    expect(node).toMatchObject({
      baseHeight: 2000,
      baseWidth: 2000,
      height: 2000,
      pixelHeight: 2000,
      pixelWidth: 2000,
      transform: { x: 0, y: 0 },
      width: 2000,
    });
  });

  test("rejects decoded images beyond the finite Raster allocation limit", async () => {
    const { createImageNodeFromDataUrl } = await importImageImport();

    useImageDimensions({ height: 1, width: 16_385 });

    await expect(
      createImageNodeFromDataUrl({
        mimeType: "image/jpeg",
        name: "too-wide.jpg",
        src: "data:image/jpeg;base64,too-wide",
        targetCenter: { x: 0, y: 0 },
      })
    ).rejects.toThrow(
      "Image dimensions exceed the 16,384px side or 100,000,000px area limit."
    );
  });

  test("rejects image data URLs that cannot be decoded", async () => {
    const { createImageNodeFromDataUrl } = await importImageImport();

    globalThis.Image = class {
      private errorListener: (() => void) | null = null;

      addEventListener(eventName: string, listener: () => void) {
        if (eventName === "error") {
          this.errorListener = listener;
        }
      }

      set src(_src: string) {
        queueMicrotask(() => {
          this.errorListener?.();
        });
      }
    } as unknown as typeof Image;

    await expect(
      createImageNodeFromDataUrl({
        mimeType: "image/png",
        name: "broken.png",
        src: "data:image/png;base64,broken",
        targetCenter: { x: 100, y: 100 },
      })
    ).rejects.toThrow("Could not load image dimensions.");
  });
});
