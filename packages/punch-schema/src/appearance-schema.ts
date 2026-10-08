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

export const MAX_GRADIENT_STOPS = 8;

const pointSchema = z.object({ x: finiteNumber, y: finiteNumber }).strict();

export const gradientStopSchema = z
  .object({
    color: colorSchema,
    id: z.string().min(1),
    offset: unitNumber,
    opacity: unitNumber,
  })
  .strict();

// Start and end are normalized to the paint box: (0, 0) is its top-left and
// (1, 1) its bottom-right; values outside 0..1 are allowed.
export const linearGradientPaintSchema = z
  .object({
    end: pointSchema,
    kind: z.literal("linear-gradient"),
    start: pointSchema,
    stops: z.array(gradientStopSchema).min(2).max(MAX_GRADIENT_STOPS),
  })
  .strict()
  .superRefine((paint, context) => {
    const ids = new Set<string>();

    for (const [index, stop] of paint.stops.entries()) {
      if (ids.has(stop.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate gradient stop id: ${stop.id}`,
          path: ["stops", index, "id"],
        });
      }

      ids.add(stop.id);

      if (index > 0 && stop.offset < paint.stops[index - 1].offset) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Gradient stops must be sorted by offset.",
          path: ["stops", index, "offset"],
        });
      }
    }
  });

export const paintSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("solid"), color: colorSchema }).strict(),
  linearGradientPaintSchema,
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
export type GradientStopDocument = z.infer<typeof gradientStopSchema>;
export type LinearGradientPaintDocument = z.infer<
  typeof linearGradientPaintSchema
>;
export type FillLayerDocument = z.infer<typeof fillLayerSchema>;
export type StrokeLayerDocument = z.infer<typeof strokeLayerSchema>;
export type AppearanceDocument = z.infer<typeof appearanceSchema>;
