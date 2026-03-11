import { z } from "zod";
import { PUNCH_DOCUMENT_VERSION } from "./constants";

const finiteNumber = z.number().refine(Number.isFinite, {
  message: "Expected a finite number.",
});

export const transformSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
    rotation: finiteNumber,
    scaleX: finiteNumber,
    scaleY: finiteNumber,
  })
  .strict();

export const warpSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z
    .object({
      kind: z.literal("arch"),
      bend: finiteNumber,
    })
    .strict(),
  z
    .object({
      kind: z.literal("wave"),
      amplitude: finiteNumber,
      cycles: finiteNumber,
    })
    .strict(),
  z
    .object({
      kind: z.literal("circle"),
      radius: finiteNumber,
      sweepDeg: finiteNumber,
    })
    .strict(),
]);

export const textNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("text"),
    text: z.string(),
    fontUrl: z.string().min(1),
    transform: transformSchema,
    fontSize: finiteNumber,
    tracking: finiteNumber,
    fill: z.string().min(1),
    stroke: z.string().min(1).nullable(),
    strokeWidth: finiteNumber,
    visible: z.boolean(),
    warp: warpSchema,
  })
  .strict();

export const designDocumentSchema = z
  .object({
    version: z.literal(PUNCH_DOCUMENT_VERSION),
    nodes: z.array(textNodeSchema),
  })
  .strict()
  .superRefine((document, context) => {
    const seenNodeIds = new Set<string>();

    for (const [index, node] of document.nodes.entries()) {
      if (seenNodeIds.has(node.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate node id: ${node.id}`,
          path: ["nodes", index, "id"],
        });
        continue;
      }

      seenNodeIds.add(node.id);
    }
  });

export type DesignDocument = z.infer<typeof designDocumentSchema>;
export type TextNodeDocument = z.infer<typeof textNodeSchema>;
export type TransformDocument = z.infer<typeof transformSchema>;
export type WarpDocument = z.infer<typeof warpSchema>;
