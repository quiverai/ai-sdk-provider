import { z } from "zod";

export const quiverLanguageModelOptionsSchema = z.object({
  operation: z.enum(["generate", "vectorize"]),
  autoCrop: z.boolean().optional(),
  targetSize: z.number().int().min(128).max(4096).optional(),
});

export type QuiverLanguageModelOptions = z.infer<
  typeof quiverLanguageModelOptionsSchema
>;

export type QuiverOperation = QuiverLanguageModelOptions["operation"];
