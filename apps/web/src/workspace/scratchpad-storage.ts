import { get, set } from "idb-keyval";

const SCRATCHPAD_DOCUMENT_KEY = "punchpress:scratchpad-document";

export const loadScratchpadDocument = async () => {
  const value = await get(SCRATCHPAD_DOCUMENT_KEY);
  return typeof value === "string" ? value : null;
};

export const saveScratchpadDocument = (contents: string) => {
  return set(SCRATCHPAD_DOCUMENT_KEY, contents);
};
