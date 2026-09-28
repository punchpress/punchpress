import { inflateSync } from "node:zlib";

interface PngHeader {
  bytesPerPixel: number;
  height: number;
  width: number;
}

export const decodePng = (png: Buffer) => {
  const { header, imageData } = readPng(png);
  const decoded = unfilterPng(inflateSync(imageData), header);

  return {
    data:
      header.bytesPerPixel === 4
        ? decoded
        : expandRgbToRgba(decoded, header.width * header.height),
    height: header.height,
    width: header.width,
  };
};

const readPng = (png: Buffer) => {
  let offset = 8;
  let header: PngHeader | null = null;
  const imageDataChunks: Buffer[] = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      header = readHeader(data);
    } else if (type === "IDAT") {
      imageDataChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset += length + 12;
  }

  if (!header) {
    throw new Error("Missing screenshot PNG header");
  }

  return {
    header,
    imageData: Buffer.concat(imageDataChunks),
  };
};

const readHeader = (data: Buffer): PngHeader => {
  if (data[8] !== 8 || data[12] !== 0) {
    throw new Error("Expected an 8-bit non-interlaced screenshot");
  }

  let bytesPerPixel = 0;

  if (data[9] === 6) {
    bytesPerPixel = 4;
  } else if (data[9] === 2) {
    bytesPerPixel = 3;
  }

  if (bytesPerPixel === 0) {
    throw new Error(`Unsupported screenshot color type: ${data[9]}`);
  }

  return {
    bytesPerPixel,
    height: data.readUInt32BE(4),
    width: data.readUInt32BE(0),
  };
};

const unfilterPng = (filtered: Buffer, header: PngHeader) => {
  const stride = header.width * header.bytesPerPixel;
  const decoded = Buffer.alloc(stride * header.height);
  let sourceOffset = 0;

  for (let y = 0; y < header.height; y += 1) {
    const filter = filtered[sourceOffset];

    sourceOffset += 1;

    for (let x = 0; x < stride; x += 1) {
      const targetOffset = y * stride + x;
      const left =
        x >= header.bytesPerPixel
          ? decoded[targetOffset - header.bytesPerPixel]
          : 0;
      const above = y > 0 ? decoded[targetOffset - stride] : 0;
      const upperLeft =
        y > 0 && x >= header.bytesPerPixel
          ? decoded[targetOffset - stride - header.bytesPerPixel]
          : 0;

      decoded[targetOffset] = unfilterByte({
        above,
        filter,
        left,
        raw: filtered[sourceOffset + x],
        upperLeft,
      });
    }

    sourceOffset += stride;
  }

  return decoded;
};

const unfilterByte = ({
  above,
  filter,
  left,
  raw,
  upperLeft,
}: {
  above: number;
  filter: number;
  left: number;
  raw: number;
  upperLeft: number;
}) => {
  if (filter === 0) {
    return raw;
  }

  if (filter === 1) {
    return raw + left;
  }

  if (filter === 2) {
    return raw + above;
  }

  if (filter === 3) {
    return raw + Math.floor((left + above) / 2);
  }

  return raw + paeth(left, above, upperLeft);
};

const expandRgbToRgba = (rgb: Buffer, pixelCount: number) => {
  const rgba = Buffer.alloc(pixelCount * 4);

  for (let index = 0; index < pixelCount; index += 1) {
    rgba[index * 4] = rgb[index * 3];
    rgba[index * 4 + 1] = rgb[index * 3 + 1];
    rgba[index * 4 + 2] = rgb[index * 3 + 2];
    rgba[index * 4 + 3] = 255;
  }

  return rgba;
};

const paeth = (left: number, above: number, upperLeft: number) => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  return aboveDistance <= upperLeftDistance ? above : upperLeft;
};
