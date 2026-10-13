import { z } from 'zod';

export const aiExtractionSchema=z.object({requirements:z.array(z.object({category:z.enum(['required','experience','seniority','desired','responsibilities','language']),quote:z.string().min(4).max(1200)}).strict()).max(20)}).strict();
export type AiExtraction=z.infer<typeof aiExtractionSchema>;
export const aiPreviewSchema=z.object({jobId:z.string(),provider:z.literal('openai'),model:z.literal('gpt-4.1-mini'),text:z.string(),hash:z.string(),truncated:z.boolean(),maxEstimatedUsd:z.number(),dailyRemainingUsd:z.number(),enabled:z.boolean(),cached:z.boolean()});
export type AiPreview=z.infer<typeof aiPreviewSchema>;
export const aiResultSchema=z.object({extraction:aiExtractionSchema,cached:z.boolean(),reservedUsd:z.number(),warning:z.string()});
export type AiResult=z.infer<typeof aiResultSchema>;
