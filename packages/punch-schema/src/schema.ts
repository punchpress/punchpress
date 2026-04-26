import { z } from "zod";
import { PUNCH_DOCUMENT_VERSION, ROOT_PARENT_ID } from "./constants";
import {
  VECTOR_STROKE_LINE_CAP_VALUES,
  VECTOR_STROKE_LINE_JOIN_VALUES,
} from "./vector-stroke-style";

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

export const shapeKindSchema = z.enum(["polygon", "ellipse", "star"]);

export const shapePointSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
  })
  .strict();

export const shapeNodeSchema = baseNodeSchema
  .extend({
    cornerRadii: z.array(finiteNumber).optional(),
    cornerRadius: finiteNumber.optional(),
    fill: z.string().min(1),
    height: finiteNumber,
    points: z.array(shapePointSchema).min(3).optional(),
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

export const vectorPointTypeSchema = z.enum(["corner", "smooth"]);

export const vectorSegmentSchema = z
  .object({
    handleIn: vectorHandleSchema,
    handleOut: vectorHandleSchema,
    point: vectorHandleSchema,
    pointType: vectorPointTypeSchema,
  })
  .strict();

export const vectorContourSchema = z
  .object({
    closed: z.boolean(),
    segments: z.array(vectorSegmentSchema).min(1),
  })
  .strict();

export const vectorFillRuleSchema = z.enum(["evenodd", "nonzero"]);
export const vectorPathCompositionSchema = z.enum([
  "independent",
  "compound-fill",
  "unite",
  "subtract",
  "intersect",
  "exclude",
]);
export const vectorStrokeLineCapSchema = z.enum(VECTOR_STROKE_LINE_CAP_VALUES);
export const vectorStrokeLineJoinSchema = z.enum(
  VECTOR_STROKE_LINE_JOIN_VALUES
);

export const vectorNodeSchema = baseNodeSchema
  .extend({
    compoundWrapper: z.boolean().optional(),
    name: z.string().min(1),
    pathComposition: vectorPathCompositionSchema.optional(),
    transform: transformSchema,
    type: z.literal("vector"),
  })
  .strict();

export const pathNodeSchema = baseNodeSchema
  .extend({
    closed: z.boolean(),
    fill: z.string().min(1).nullable(),
    fillRule: vectorFillRuleSchema,
    segments: z.array(vectorSegmentSchema).min(1),
    stroke: z.string().min(1).nullable(),
    strokeLineCap: vectorStrokeLineCapSchema,
    strokeLineJoin: vectorStrokeLineJoinSchema,
    strokeMiterLimit: finiteNumber,
    strokeWidth: finiteNumber,
    transform: transformSchema,
    type: z.literal("path"),
  })
  .strict();

export const nodeSchema = z.discriminatedUnion("type", [
  textNodeSchema,
  groupNodeSchema,
  shapeNodeSchema,
  vectorNodeSchema,
  pathNodeSchema,
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

      if (node.type === "path" && node.parentId !== ROOT_PARENT_ID) {
        const parentNode = document.nodes.find(
          (entry) => entry.id === node.parentId
        );

        if (parentNode?.type !== "vector") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Path nodes may only have vector parents or the root.",
            path: ["nodes", index, "parentId"],
          });
        }
      }

      if (node.type === "vector") {
        const childNodes = document.nodes.filter(
          (entry) => entry.parentId === node.id
        );

        if (childNodes.some((entry) => entry.type !== "path")) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Vector nodes may only contain path children.",
            path: ["nodes", index, "id"],
          });
        }
      }
    }
  });

export type DesignDocument = z.infer<typeof designDocumentSchema>;
export type GroupNodeDocument = z.infer<typeof groupNodeSchema>;
export type NodeDocument = z.infer<typeof nodeSchema>;
export type ShapeKindDocument = z.infer<typeof shapeKindSchema>;
export type ShapePointDocument = z.infer<typeof shapePointSchema>;
export type ShapeNodeDocument = z.infer<typeof shapeNodeSchema>;
export type TextNodeDocument = z.infer<typeof textNodeSchema>;
export type LocalFontDocument = z.infer<typeof localFontSchema>;
export type PathNodeDocument = z.infer<typeof pathNodeSchema>;
export type TransformDocument = z.infer<typeof transformSchema>;
export type WarpDocument = z.infer<typeof warpSchema>;
export type VectorContourDocument = z.infer<typeof vectorContourSchema>;
export type VectorFillRuleDocument = z.infer<typeof vectorFillRuleSchema>;
export type VectorHandleDocument = z.infer<typeof vectorHandleSchema>;
export type VectorNodeDocument = z.infer<typeof vectorNodeSchema>;
export type VectorPointTypeDocument = z.infer<typeof vectorPointTypeSchema>;
export type VectorSegmentDocument = z.infer<typeof vectorSegmentSchema>;
export type VectorStrokeLineCapDocument = z.infer<
  typeof vectorStrokeLineCapSchema
>;
export type VectorStrokeLineJoinDocument = z.infer<
  typeof vectorStrokeLineJoinSchema
>;
