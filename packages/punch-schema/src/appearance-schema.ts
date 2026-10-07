import { z } from "zod";
import { isCanonicalColor } from "./color";
import {
  VECTOR_STROKE_LINE_CAP_VALUES,
  VECTOR_STROKE_LINE_JOIN_VALUES,
} from "./vector-stroke-style";

export const MAX_APPEARANCE_LAYERS = 8;

const finiteNumber = z.number().refine(Number.isFinite, {
  message: "Expected a finite number.",
});
const unitNumber = finiteNumber.refine((value) => value >= 0 && value <= 1, {
  message: "Expected a number between 0 and 1.",
});

export const colorSchema = z.string().refine(isCanonicalColor, {
  message: "Expected a canonical #rrggbb color.",
});

// Stage 1 ships solid paint only; gradients widen this union later.
export const paintSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("solid"), color: colorSchema }).strict(),
]);

const layerBase = {
  enabled: z.boolean(),
  id: z.string().min(1),
  opacity: unitNumber,
  paint: paintSchema,
};

export const fillLayerSchema = z.object(layerBase).strict();

export const strokeLayerSchema = z
  .object({
    ...layerBase,
    // Stage 1 renders center strokes only; stroke alignment widens this enum.
    align: z.enum(["center"]),
    cap: z.enum(VECTOR_STROKE_LINE_CAP_VALUES),
    join: z.enum(VECTOR_STROKE_LINE_JOIN_VALUES),
    miterLimit: finiteNumber.refine((value) => value >= 1, {
      message: "Expected a miter limit of at least 1.",
    }),
    width: finiteNumber.refine((value) => value >= 0, {
      message: "Expected a non-negative stroke width.",
    }),
  })
  .strict();

export const appearanceSchema = z
  .object({
    fills: z.array(fillLayerSchema).max(MAX_APPEARANCE_LAYERS),
    strokes: z.array(strokeLayerSchema).max(MAX_APPEARANCE_LAYERS),
  })
  .strict()
  .superRefine((appearance, context) => {
    const seen = new Set<string>();

    for (const layer of [...appearance.fills, ...appearance.strokes]) {
      if (seen.has(layer.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate appearance layer id: ${layer.id}`,
        });
      }

      seen.add(layer.id);
    }
  });

export type PaintDocument = z.infer<typeof paintSchema>;
export type FillLayerDocument = z.infer<typeof fillLayerSchema>;
export type StrokeLayerDocument = z.infer<typeof strokeLayerSchema>;
export type AppearanceDocument = z.infer<typeof appearanceSchema>;
