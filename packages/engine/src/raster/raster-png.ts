/**
 * Pure-TS PNG codec for raster tile payloads: 8-bit RGBA, non-interlaced,
 * zlib via the platform's CompressionStream/DecompressionStream. No canvas
 * APIs anywhere — canvas encode premultiplies alpha (lossy for
 * semi-transparent pixels) and the async toBlob family intermittently kills
 * the Chromium renderer under concurrent large-commit load. This codec is
 * byte-exact: decode(encode(pixels)) === pixels, which is what makes
 * evict-then-rehydrate pixel identity possible.
 *
 * The encoder uses a fixed Paeth filter on every scanline. Measured on
 * representative tile content (solid, gradient, brush dab, photo-noise),
 * Paeth lands within ~1% of the adaptive min-SAD pick's output size at about
 * half the filter cost (~5 ms vs ~10 ms per 516 px tile), while filter 0
 * balloons gradient/photo tiles 30-300x — so Paeth everywhere, no adaptive
 * pass.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

const getCrc32 = (bytes: Uint8Array, start: number, end: number) => {
  let crc = 0xff_ff_ff_ff;

  for (let index = start; index < end; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xff_ff_ff_ff) >>> 0;
};

export const hasRasterPngCodec = () =>
  typeof CompressionStream !== "undefined" &&
  typeof DecompressionStream !== "undefined";

const pumpStream = async (
  transform: { readable: ReadableStream; writable: WritableStream },
  input: Uint8Array
) => {
  const writer = transform.writable.getWriter();
  const done = (async () => {
    const chunks: Uint8Array[] = [];
    const reader = transform.readable.getReader();

    while (true) {
      const { done: readDone, value } = await reader.read();

      if (readDone) {
        break;
      }

      chunks.push(value as Uint8Array);
    }

    return chunks;
  })();

  // The input buffer may be shared with caller state; copy so the platform
  // stream cannot detach it.
  await writer.write(input.slice());
  await writer.close();

  const chunks = await done;
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return bytes;
};

const zlibDeflate = (bytes: Uint8Array) =>
  pumpStream(new CompressionStream("deflate"), bytes);

const zlibInflate = (bytes: Uint8Array) =>
  pumpStream(new DecompressionStream("deflate"), bytes);

const paethPredictor = (left: number, up: number, upLeft: number) => {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    return left;
  }

  return distanceUp <= distanceUpLeft ? up : upLeft;
};

/** Paeth-filter one scanline into the filtered buffer (filter byte + data). */
const filterScanline = ({
  bytesPerPixel,
  previousRow,
  row,
  target,
  targetOffset,
}: {
  bytesPerPixel: number;
  previousRow: Uint8Array | null;
  row: Uint8Array;
  target: Uint8Array;
  targetOffset: number;
}) => {
  const rowLength = row.length;

  target[targetOffset] = 4;

  for (let index = 0; index < rowLength; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previousRow ? previousRow[index] : 0;
    const upLeft =
      previousRow && index >= bytesPerPixel
        ? previousRow[index - bytesPerPixel]
        : 0;

    target[targetOffset + 1 + index] =
      (row[index] - paethPredictor(left, up, upLeft)) & 0xff;
  }
};

const writeChunk = (
  target: Uint8Array,
  offset: number,
  type: string,
  data: Uint8Array
) => {
  const view = new DataView(target.buffer, target.byteOffset);

  view.setUint32(offset, data.length);

  for (let index = 0; index < 4; index += 1) {
    target[offset + 4 + index] = type.charCodeAt(index);
  }

  target.set(data, offset + 8);

  const crc = getCrc32(target, offset + 4, offset + 8 + data.length);

  view.setUint32(offset + 8 + data.length, crc);
  return offset + 12 + data.length;
};

/** Encode straight-alpha RGBA pixels as a PNG. Byte-exact and canvas-free. */
export const encodePngRgba = async (
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> => {
  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const raw = new Uint8Array(
    pixels.buffer,
    pixels.byteOffset,
    pixels.byteLength
  );
  const filtered = new Uint8Array((rowLength + 1) * height);
  let previousRow: Uint8Array | null = null;

  for (let y = 0; y < height; y += 1) {
    const row = raw.subarray(y * rowLength, (y + 1) * rowLength);

    filterScanline({
      bytesPerPixel,
      previousRow,
      row,
      target: filtered,
      targetOffset: y * (rowLength + 1),
    });
    previousRow = row;
  }

  const compressed = await zlibDeflate(filtered);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);

  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none

  const bytes = new Uint8Array(
    PNG_SIGNATURE.length + 12 + ihdr.length + 12 + compressed.length + 12
  );

  bytes.set(PNG_SIGNATURE, 0);

  let offset = PNG_SIGNATURE.length;

  offset = writeChunk(bytes, offset, "IHDR", ihdr);
  offset = writeChunk(bytes, offset, "IDAT", compressed);
  writeChunk(bytes, offset, "IEND", new Uint8Array(0));
  return bytes;
};

export type DecodedPng = {
  height: number;
  pixels: Uint8ClampedArray;
  width: number;
};

/**
 * Read a PNG's dimensions from its IHDR without inflating anything. Lets
 * callers reject scaled payloads before paying for a full decode.
 */
export const peekPngDimensions = (bytes: Uint8Array) => {
  if (bytes.length < 8 + 25) {
    return null;
  }

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      return null;
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    height: view.getUint32(PNG_SIGNATURE.length + 8 + 4),
    width: view.getUint32(PNG_SIGNATURE.length + 8),
  };
};

const unfilterScanlines = (
  filtered: Uint8Array,
  width: number,
  height: number,
  bytesPerPixel: number
) => {
  const rowLength = width * bytesPerPixel;
  const pixels = new Uint8Array(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const filter = filtered[y * (rowLength + 1)];
    const sourceOffset = y * (rowLength + 1) + 1;
    const targetOffset = y * rowLength;

    for (let index = 0; index < rowLength; index += 1) {
      const raw = filtered[sourceOffset + index];
      const left =
        index >= bytesPerPixel ? pixels[targetOffset + index - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[targetOffset + index - rowLength] : 0;
      const upLeft =
        y > 0 && index >= bytesPerPixel
          ? pixels[targetOffset + index - rowLength - bytesPerPixel]
          : 0;
      let value = raw;

      if (filter === 1) {
        value = raw + left;
      } else if (filter === 2) {
        value = raw + up;
      } else if (filter === 3) {
        value = raw + ((left + up) >> 1);
      } else if (filter === 4) {
        value = raw + paethPredictor(left, up, upLeft);
      }

      pixels[targetOffset + index] = value & 0xff;
    }
  }

  return pixels;
};

/**
 * Decode a PNG to straight-alpha RGBA. Supports the subset this engine (and
 * Chromium's canvas encoder) emits: 8-bit RGB/RGBA, non-interlaced. Returns
 * null for anything else so callers can fall back to browser image decode.
 */
export const decodePngRgba = async (
  bytes: Uint8Array
): Promise<DecodedPng | null> => {
  if (bytes.length < 8 + 25) {
    return null;
  }

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      return null;
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idatChunks: Uint8Array[] = [];
  let width = 0;
  let height = 0;
  let colorType = -1;
  let offset = PNG_SIGNATURE.length;

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    const dataStart = offset + 8;

    if (dataStart + length > bytes.length) {
      return null;
    }

    if (type === "IHDR") {
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      colorType = bytes[dataStart + 8 + 1];

      const bitDepth = bytes[dataStart + 8];
      const interlace = bytes[dataStart + 12];

      if (
        bitDepth !== 8 ||
        interlace !== 0 ||
        (colorType !== 2 && colorType !== 6)
      ) {
        return null;
      }
    } else if (type === "IDAT") {
      idatChunks.push(bytes.subarray(dataStart, dataStart + length));
    } else if (type === "IEND") {
      break;
    }

    offset = dataStart + length + 4;
  }

  if (!(width && height && idatChunks.length)) {
    return null;
  }

  const compressedLength = idatChunks.reduce(
    (sum, chunk) => sum + chunk.length,
    0
  );
  const compressed = new Uint8Array(compressedLength);
  let compressedOffset = 0;

  for (const chunk of idatChunks) {
    compressed.set(chunk, compressedOffset);
    compressedOffset += chunk.length;
  }

  const filtered = await zlibInflate(compressed);
  const bytesPerPixel = colorType === 6 ? 4 : 3;

  if (filtered.length < (width * bytesPerPixel + 1) * height) {
    return null;
  }

  const raw = unfilterScanlines(filtered, width, height, bytesPerPixel);

  if (colorType === 6) {
    return { height, pixels: new Uint8ClampedArray(raw.buffer), width };
  }

  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = raw[index * 3];
    pixels[index * 4 + 1] = raw[index * 3 + 1];
    pixels[index * 4 + 2] = raw[index * 3 + 2];
    pixels[index * 4 + 3] = 255;
  }

  return { height, pixels, width };
};
