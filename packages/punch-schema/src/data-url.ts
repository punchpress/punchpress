const DATA_URL_PATTERN = /^data:([^;,]+)(;base64)?,(.*)$/;
const textEncoder = new TextEncoder();

type Base64Uint8ArrayConstructor = Uint8ArrayConstructor & {
  fromBase64?: (value: string) => Uint8Array;
};

type Base64Uint8Array = Uint8Array & {
  toBase64?: () => string;
};

const encodeBase64 = (bytes: Base64Uint8Array) => {
  // Native path: no intermediate binary string, far less GC garbage on the
  // stroke-commit and save paths.
  if (typeof bytes.toBase64 === "function") {
    return bytes.toBase64();
  }

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

const decodeBase64 = (value: string) => {
  const base64Uint8Array = Uint8Array as Base64Uint8ArrayConstructor;

  if (typeof base64Uint8Array.fromBase64 === "function") {
    return base64Uint8Array.fromBase64(value);
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

export const decodeDataUrl = (src: string) => {
  const match = DATA_URL_PATTERN.exec(src);

  if (!match) {
    throw new Error("Raster asset source is not a data URL.");
  }

  const mimeType = match[1];
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";

  return {
    bytes: isBase64
      ? decodeBase64(payload)
      : textEncoder.encode(decodeURIComponent(payload)),
    mimeType,
  };
};

export const encodeDataUrl = (bytes: Uint8Array, mimeType: string) => {
  return `data:${mimeType};base64,${encodeBase64(bytes)}`;
};
