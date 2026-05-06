import { z } from "zod";

export const SUPPORTED_ORGAN_TARGETS = [
  "spleen",
  "kidney_right",
  "kidney_left",
  "gall_bladder",
  "liver",
  "stomach",
  "aorta",
  "postcava",
  "pancreas",
] as const;

export const organTargetSchema = z.enum(SUPPORTED_ORGAN_TARGETS);

export const inferenceOrganSchema = z.object({
  content: z.string().min(1),
  volume_cm: z.union([z.string(), z.number()]),
  mean_hu: z.union([z.string(), z.number()]),
});

export const inferenceResultSchema = z.record(
  organTargetSchema,
  inferenceOrganSchema
);

export type InferenceResult = z.infer<typeof inferenceResultSchema>;

export function parseInferenceResult(value: unknown): InferenceResult {
  const parsed = inferenceResultSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Malformed inference result: ${parsed.error.message}`);
  }

  return parsed.data;
}
