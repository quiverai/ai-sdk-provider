import { z } from "zod";

export const svgUsageSchema = z.object({
  total_tokens: z.number().int().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
});

export type SvgUsage = z.infer<typeof svgUsageSchema>;

export const svgDocumentSchema = z.object({
  svg: z.string().min(1),
  mime_type: z.literal("image/svg+xml"),
});

export const svgResponseSchema = z.object({
  id: z.string().min(1),
  created: z.number().int().nonnegative(),
  data: z.array(svgDocumentSchema).min(1),
  usage: svgUsageSchema.optional(),
});

export type SvgResponse = z.infer<typeof svgResponseSchema>;

export const svgStreamChunkSchema = z.object({
  type: z.enum(["reasoning", "draft", "content"]),
  id: z.string().min(1),
  svg: z.string().default(""),
  text: z.string().optional(),
  usage: svgUsageSchema.optional(),
});

export type SvgStreamChunk = z.infer<typeof svgStreamChunkSchema>;

export const publicErrorEnvelopeSchema = z.object({
  status: z.number().int(),
  code: z.string().min(1),
  message: z.string().min(1),
  request_id: z.string().min(1),
});

export type PublicErrorEnvelope = z.infer<typeof publicErrorEnvelopeSchema>;
