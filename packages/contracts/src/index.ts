import { z } from 'zod';
export * from './jobs.js';
export * from './matching.js';
export * from './ai.js';
export * from './automation.js';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('devjob-api'),
  version: z.literal('0.7.0'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_TEXT = 100_000;
export const profileSchema = z.object({
  objective: z.string().trim().max(500),
  summary: z.string().trim().max(10_000),
  skills: z.array(z.string().trim().min(1).max(100)).max(100),
  experience: z.string().trim().max(30_000),
  education: z.string().trim().max(10_000),
  languages: z.string().trim().max(2000),
}).strict();
export type ResumeProfile = z.infer<typeof profileSchema>;
export const draftSchema = z.object({
  sourceText: z.string().max(MAX_RESUME_TEXT),
  pages: z.number().int().min(1).max(20),
  profile: profileSchema,
  evidence: z.array(z.object({ skill: z.string(), excerpt: z.string() })),
  warnings: z.array(z.string()),
});
export type ResumeDraft = z.infer<typeof draftSchema>;
export const savedProfileSchema = z.object({
  profile: profileSchema,
  reviewed: z.literal(true),
  savedAt: z.iso.datetime(),
});
export type SavedProfile = z.infer<typeof savedProfileSchema>;
export const saveProfileSchema = z.object({profile: profileSchema, reviewed: z.literal(true)}).strict();
