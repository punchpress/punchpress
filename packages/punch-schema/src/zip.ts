const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const STORE_METHOD = 0;

export interface ZipEntry {
  data: Uint8Array;
  path: string;
}

const textEncoder = new TextEncoder();

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

const getCrc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const getUint16 = (data: Uint8Array, offset: number) => {
  return data[offset] | (data[offset + 1] << 8);
};

const getUint32 = (data: Uint8Array, offset: number) => {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
};

const setUint16 = (data: Uint8Array, offset: number, value: number) => {
  data[offset] = value & 255;
  data[offset + 1] = (value >>> 8) & 255;
};

const setUint32 = (data: Uint8Array, offset: number, value: number) => {
  data[offset] = value & 255;
  data[offset + 1] = (value >>> 8) & 255;
  data[offset + 2] = (value >>> 16) & 255;
  data[offset + 3] = (value >>> 24) & 255;
};

const concatChunks = (chunks: Uint8Array[]) => {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
};

export const createZipArchive = (entries: ZipEntry[]) => {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = textEncoder.encode(entry.path);
    const crc32 = getCrc32(entry.data);
    const localHeader = new Uint8Array(30 + name.length);

    setUint32(localHeader, 0, LOCAL_FILE_HEADER_SIGNATURE);
    setUint16(localHeader, 4, 20);
    setUint16(localHeader, 8, STORE_METHOD);
    setUint32(localHeader, 14, crc32);
    setUint32(localHeader, 18, entry.data.length);
    setUint32(localHeader, 22, entry.data.length);
    setUint16(localHeader, 26, name.length);
    localHeader.set(name, 30);

    localChunks.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + name.length);

    setUint32(centralHeader, 0, CENTRAL_DIRECTORY_SIGNATURE);
    setUint16(centralHeader, 4, 20);
    setUint16(centralHeader, 6, 20);
    setUint16(centralHeader, 10, STORE_METHOD);
    setUint32(centralHeader, 16, crc32);
    setUint32(centralHeader, 20, entry.data.length);
    setUint32(centralHeader, 24, entry.data.length);
    setUint16(centralHeader, 28, name.length);
    setUint32(centralHeader, 42, localOffset);
    centralHeader.set(name, 46);
    centralChunks.push(centralHeader);

    localOffset += localHeader.length + entry.data.length;
  }

  const centralDirectoryOffset = localOffset;
  const centralDirectory = concatChunks(centralChunks);
  const endRecord = new Uint8Array(22);

  setUint32(endRecord, 0, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  setUint16(endRecord, 8, entries.length);
  setUint16(endRecord, 10, entries.length);
  setUint32(endRecord, 12, centralDirectory.length);
  setUint32(endRecord, 16, centralDirectoryOffset);

  return concatChunks([...localChunks, centralDirectory, endRecord]);
};

const findEndOfCentralDirectory = (data: Uint8Array) => {
  const minimumOffset = Math.max(0, data.length - 65_557);

  for (let offset = data.length - 22; offset >= minimumOffset; offset -= 1) {
    if (getUint32(data, offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  return -1;
};

export const readZipArchive = (data: Uint8Array) => {
  const endOffset = findEndOfCentralDirectory(data);

  if (endOffset < 0) {
    throw new Error("Punch package is missing a ZIP central directory.");
  }

  const entryCount = getUint16(data, endOffset + 10);
  const centralDirectoryOffset = getUint32(data, endOffset + 16);
  const entries = new Map<string, Uint8Array>();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (getUint32(data, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Punch package has an invalid ZIP directory entry.");
    }

    const method = getUint16(data, offset + 10);
    const compressedSize = getUint32(data, offset + 20);
    const fileNameLength = getUint16(data, offset + 28);
    const extraLength = getUint16(data, offset + 30);
    const commentLength = getUint16(data, offset + 32);
    const localHeaderOffset = getUint32(data, offset + 42);
    const path = new TextDecoder().decode(
      data.slice(offset + 46, offset + 46 + fileNameLength)
    );

    if (method !== STORE_METHOD) {
      throw new Error("Punch package uses unsupported ZIP compression.");
    }

    if (getUint32(data, localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error("Punch package has an invalid ZIP file entry.");
    }

    const localNameLength = getUint16(data, localHeaderOffset + 26);
    const localExtraLength = getUint16(data, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;

    entries.set(path, data.slice(dataOffset, dataOffset + compressedSize));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
};
