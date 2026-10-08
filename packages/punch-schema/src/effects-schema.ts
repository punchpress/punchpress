import { z } from "zod";
import { colorSchema } from "./appearance-schema";

export const MAX_EFFECTS = 4;

const finiteNumber = z.number().refine(Number.isFinite, {
  message: "Expected a finite number.",
});

// A drop shadow in its owner's local units: offsets and blur rotate and scale
// with the object. `blur` is a CSS box-shadow blur radius (stdDeviation =
// blur / 2); 0 is a hard shadow.
export const dropShadowSchema = z
  .object({
    blur: finiteNumber.refine((value) => value >= 0, {
      message: "Expected a non-negative blur.",
    }),
    color: colorSchema,
    enabled: z.boolean(),
    id: z.string().min(1),
    kind: z.literal("drop-shadow"),
    opacity: finiteNumber.refine((value) => value >= 0 && value <= 1, {
      message: "Expected a number between 0 and 1.",
    }),
    x: finiteNumber,
    y: finiteNumber,
  })
  .strict();

export const effectSchema = dropShadowSchema;

export const effectsSchema = z
  .array(effectSchema)
  .max(MAX_EFFECTS)
  .superRefine((effects, context) => {
    const ids = new Set<string>();

    for (const [index, effect] of effects.entries()) {
      if (ids.has(effect.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate effect id: ${effect.id}`,
          path: [index, "id"],
        });
      }

      ids.add(effect.id);
    }
  });

// A path inside a vector has no effects; the vector owns the object's shadow
// so overlapping children never shadow their siblings.
export const addVectorChildEffectIssues = (
  nodes: readonly {
    effects?: readonly unknown[];
    id: string;
    parentId: string;
    type: string;
  }[],
  context: z.RefinementCtx
) => {
  const vectorIds = new Set(
    nodes.filter((node) => node.type === "vector").map((node) => node.id)
  );

  for (const [index, node] of nodes.entries()) {
    if (vectorIds.has(node.parentId) && (node.effects?.length ?? 0) > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Paths inside a vector have no effects: ${node.id}`,
        path: ["nodes", index, "effects"],
      });
    }
  }
};

export type DropShadowDocument = z.infer<typeof dropShadowSchema>;
export type EffectDocument = z.infer<typeof effectSchema>;
