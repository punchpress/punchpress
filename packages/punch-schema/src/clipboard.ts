import { z } from "zod";
import { PUNCH_DOCUMENT_VERSION } from "./constants";
import { upgradeNodesAppearance1_8 } from "./migrate";
import { normalizeNodesForSchema } from "./normalize";
import { addParentCycleIssues, nodeSchema } from "./schema";
import { canonicalizeTreeOrder } from "./tree-order";

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
  .strict()
  .superRefine((content, context) => {
    addParentCycleIssues(content.nodes, context);
  });

// Payloads copied from a 1.8 build upgrade the same way 1.8 documents do.
export const parseClipboardContent = (value) => {
  const content = JSON.parse(value);
  const nodes =
    content?.documentVersion === "1.8" && Array.isArray(content.nodes)
      ? upgradeNodesAppearance1_8(content.nodes)
      : content?.nodes;

  return clipboardContentSchema.parse({
    ...content,
    documentVersion:
      content?.documentVersion === "1.8"
        ? PUNCH_DOCUMENT_VERSION
        : content?.documentVersion,
    nodes: canonicalizeTreeOrder(
      normalizeNodesForSchema(nodes) as unknown as { id: string }[]
    ),
  });
};

export const serializeClipboardContent = (content) => {
  return JSON.stringify(
    clipboardContentSchema.parse({
      ...content,
      nodes: normalizeNodesForSchema(content.nodes),
    })
  );
};

export type ClipboardContent = z.infer<typeof clipboardContentSchema>;
