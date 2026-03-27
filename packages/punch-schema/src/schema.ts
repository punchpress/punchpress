import { z } from "zod";
import { PUNCH_DOCUMENT_VERSION, ROOT_PARENT_ID } from "./constants";

const finiteNumber = z.number().refine(Number.isFinite, {
  message: "Expected a finite number.",
});

const parentIdSchema = z.string().min(1);

const baseNodeSchema = z
  .object({
    id: z.string().min(1),
    parentId: parentIdSchema,
    visible: z.boolean(),
  })
  .strict();

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
      kind: z.literal("slant"),
      rise: finiteNumber,
    })
    .strict(),
  z
    .object({
      kind: z.literal("circle"),
      pathPosition: finiteNumber.default(0),
      radius: finiteNumber,
      sweepDeg: finiteNumber,
    })
    .strict(),
]);

export const localFontSchema = z
  .object({
    family: z.string().min(1),
    fullName: z.string().min(1),
    postscriptName: z.string().min(1),
    style: z.string().min(1),
  })
  .strict();

export const textNodeSchema = baseNodeSchema
  .extend({
    type: z.literal("text"),
    text: z.string(),
    font: localFontSchema,
    transform: transformSchema,
    fontSize: finiteNumber,
    tracking: finiteNumber,
    fill: z.string().min(1),
    stroke: z.string().min(1).nullable(),
    strokeWidth: finiteNumber,
    warp: warpSchema,
  })
  .strict();

export const groupNodeSchema = baseNodeSchema
  .extend({
    name: z.string().min(1),
    type: z.literal("group"),
    transform: transformSchema,
  })
  .strict();

export const shapeKindSchema = z.enum(["rectangle", "ellipse", "star"]);

export const shapeNodeSchema = baseNodeSchema
  .extend({
    fill: z.string().min(1),
    height: finiteNumber,
    shape: shapeKindSchema,
    stroke: z.string().min(1).nullable(),
    strokeWidth: finiteNumber,
    transform: transformSchema,
    type: z.literal("shape"),
    width: finiteNumber,
  })
  .strict();

export const vectorHandleSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
  })
  .strict();

export const vectorSegmentSchema = z
  .object({
    handleIn: vectorHandleSchema,
    handleOut: vectorHandleSchema,
    point: vectorHandleSchema,
  })
  .strict();

export const vectorContourSchema = z
  .object({
    closed: z.boolean(),
    segments: z.array(vectorSegmentSchema).min(1),
  })
  .strict();

export const vectorFillRuleSchema = z.enum(["evenodd", "nonzero"]);

export const vectorNodeSchema = baseNodeSchema
  .extend({
    contours: z.array(vectorContourSchema).min(1),
    fill: z.string().min(1).nullable(),
    fillRule: vectorFillRuleSchema,
    stroke: z.string().min(1).nullable(),
    strokeWidth: finiteNumber,
    transform: transformSchema,
    type: z.literal("vector"),
  })
  .strict();

export const nodeSchema = z.discriminatedUnion("type", [
  textNodeSchema,
  groupNodeSchema,
  shapeNodeSchema,
  vectorNodeSchema,
]);

export const designDocumentSchema = z
  .object({
    version: z.literal(PUNCH_DOCUMENT_VERSION),
    nodes: z.array(nodeSchema),
  })
  .strict()
  .superRefine((document, context) => {
    const seenNodeIds = new Set<string>();
    const nodeIds = new Set(document.nodes.map((node) => node.id));

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

      if (node.parentId === node.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Node cannot be its own parent.",
          path: ["nodes", index, "parentId"],
        });
      }

      if (node.parentId !== ROOT_PARENT_ID && !nodeIds.has(node.parentId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown parent id: ${node.parentId}`,
          path: ["nodes", index, "parentId"],
        });
      }
    }
  });

export type DesignDocument = z.infer<typeof designDocumentSchema>;
export type GroupNodeDocument = z.infer<typeof groupNodeSchema>;
export type NodeDocument = z.infer<typeof nodeSchema>;
export type ShapeKindDocument = z.infer<typeof shapeKindSchema>;
export type ShapeNodeDocument = z.infer<typeof shapeNodeSchema>;
export type TextNodeDocument = z.infer<typeof textNodeSchema>;
export type LocalFontDocument = z.infer<typeof localFontSchema>;
export type TransformDocument = z.infer<typeof transformSchema>;
export type WarpDocument = z.infer<typeof warpSchema>;
export type VectorContourDocument = z.infer<typeof vectorContourSchema>;
export type VectorFillRuleDocument = z.infer<typeof vectorFillRuleSchema>;
export type VectorHandleDocument = z.infer<typeof vectorHandleSchema>;
export type VectorNodeDocument = z.infer<typeof vectorNodeSchema>;
export type VectorSegmentDocument = z.infer<typeof vectorSegmentSchema>;
