import { get, set } from "idb-keyval";

const SCRATCHPAD_DOCUMENT_KEY = "punchpress:scratchpad-document";

/**
 * The scratchpad persists as .punch package bytes (not the serialized
 * document string): tile pixel bytes live in the editor's raster asset
 * store, so only the package format carries them across reloads. Plain
 * string values are legacy pre-package scratchpads and still load.
 */
export const loadScratchpadDocument = async (): Promise<
  Uint8Array | string | null
> => {
  const value = await get(SCRATCHPAD_DOCUMENT_KEY);

  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  return typeof value === "string" ? value : null;
};

export const saveScratchpadDocument = (contents: Uint8Array) => {
  return set(SCRATCHPAD_DOCUMENT_KEY, contents);
};
