import { z } from "zod";
import { PUNCH_DOCUMENT_VERSION } from "./constants";
import { nodeSchema } from "./schema";

export const PUNCH_CLIPBOARD_MIME_TYPE =
  "application/vnd.punchpress-clipboard+json";
export const PUNCH_CLIPBOARD_HTML_ATTRIBUTE = "data-punchpress-clipboard";

export const clipboardContentSchema = z
  .object({
    documentVersion: z.literal(PUNCH_DOCUMENT_VERSION),
    nodes: z.array(nodeSchema),
    rootNodeIds: z.array(z.string().min(1)),
    type: z.literal(PUNCH_CLIPBOARD_MIME_TYPE),
    version: z.literal(1),
  })
  .strict();

export const parseClipboardContent = (value) => {
  return clipboardContentSchema.parse(JSON.parse(value));
};

export const serializeClipboardContent = (content) => {
  return JSON.stringify(clipboardContentSchema.parse(content));
};

export type ClipboardContent = z.infer<typeof clipboardContentSchema>;
