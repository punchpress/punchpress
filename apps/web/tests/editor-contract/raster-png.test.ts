import { describe, expect, test } from "bun:test";
import {
  decodePngRgba,
  encodePngRgba,
} from "../../../../packages/engine/src/raster/raster-png";

const createPatternPixels = (width: number, height: number) => {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const distance = Math.hypot(x - width / 2, y - height / 2);
      const alpha = Math.max(
        0,
        Math.min(255, Math.round(255 - distance * 2.5))
      );

      pixels[offset] = (x * 7) % 256;
      pixels[offset + 1] = (y * 13) % 256;
      pixels[offset + 2] = (x + y) % 256;
      pixels[offset + 3] = alpha;
    }
  }

  return pixels;
};

describe("raster PNG codec", () => {
  test("encode then decode is byte-identical, including semi-transparent pixels", async () => {
    const width = 261;
    const height = 133;
    const pixels = createPatternPixels(width, height);
    const bytes = await encodePngRgba(pixels, width, height);
    const decoded = await decodePngRgba(bytes);

    expect(decoded).not.toBeNull();
    expect(decoded?.width).toBe(width);
    expect(decoded?.height).toBe(height);
    // Byte identity is the eviction/rehydration contract: canvas decode
    // premultiplies alpha and wobbles RGB under low alpha, this codec must
    // not.
    expect(decoded?.pixels).toEqual(pixels);
  });

  test("fully transparent and fully opaque tiles round-trip", async () => {
    const size = 68;
    const transparent = new Uint8ClampedArray(size * size * 4);
    const opaque = new Uint8ClampedArray(size * size * 4).fill(203);
    const transparentBack = await decodePngRgba(
      await encodePngRgba(transparent, size, size)
    );
    const opaqueBack = await decodePngRgba(
      await encodePngRgba(opaque, size, size)
    );

    expect(transparentBack?.pixels).toEqual(transparent);
    expect(opaqueBack?.pixels).toEqual(opaque);
  });

  test("solid content compresses far below raw size", async () => {
    const size = 516;
    const solid = new Uint8ClampedArray(size * size * 4).fill(120);
    const bytes = await encodePngRgba(solid, size, size);

    expect(bytes.length).toBeLessThan((size * size * 4) / 100);
  });

  test("unsupported PNG shapes decode to null instead of wrong pixels", async () => {
    expect(await decodePngRgba(new Uint8Array([1, 2, 3]))).toBeNull();

    // Corrupt the IHDR color type of a valid PNG (palette-based = 3).
    const bytes = await encodePngRgba(new Uint8ClampedArray(16), 2, 2);
    const corrupted = bytes.slice();

    corrupted[8 + 8 + 9] = 3;
    expect(await decodePngRgba(corrupted)).toBeNull();
  });
});
