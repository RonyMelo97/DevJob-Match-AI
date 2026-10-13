import { z } from 'zod';

export const jobSchema = z.object({
  id: z.string(), source: z.enum(['remotive', 'greenhouse', 'manual', 'gupy', 'linkedin']), sourceId: z.string(),
  title: z.string(), company: z.string(), url: z.url().refine((value) => new URL(value).protocol === 'https:'),
  checkedAt:z.iso.datetime().nullable().optional(), description: z.string(), salary: z.string().nullable(), candidateLocation: z.string().nullable(),
  modality: z.enum(['remote', 'hybrid', 'onsite', 'unknown']), seniority: z.enum(['junior', 'mid', 'senior', 'unknown']),
  publishedAt: z.string().nullable(), publicationRaw: z.string().nullable(),
  eligibility: z.enum(['eligible', 'unconfirmed', 'excluded']), reasons: z.array(z.string()),
  recency: z.enum(['recent', 'unknown', 'excluded']),
});
export type Job = z.infer<typeof jobSchema>;
export const jobsResponseSchema = z.object({
  jobs: z.array(jobSchema), unconfirmedDates: z.array(jobSchema),
  excludedJobs: z.array(jobSchema).default([]),
  collectedAt: z.iso.datetime().nullable(), nextRefreshAt: z.iso.datetime().nullable(),
  sources: z.array(z.object({ name: z.string(), status: z.enum(['ok', 'error', 'disabled']), message: z.string() })),
  discarded: z.number().int(), duplicates: z.number().int(),
});
export type JobsResponse = z.infer<typeof jobsResponseSchema>;
