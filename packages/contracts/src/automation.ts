import { z } from 'zod';
export const jobRunSchema=z.object({id:z.string(),trigger:z.enum(['manual','scheduled']),startedAt:z.iso.datetime(),finishedAt:z.iso.datetime().nullable(),status:z.enum(['running','success','partial','failed','interrupted']),added:z.number().int().nonnegative(),updated:z.number().int().nonnegative(),removed:z.number().int().nonnegative(),unchanged:z.number().int().nonnegative(),message:z.string().nullable()});
export type JobRun=z.infer<typeof jobRunSchema>;
export const automationStatusSchema=z.object({enabled:z.boolean(),running:z.boolean(),nextCheckAt:z.iso.datetime().nullable(),lastError:z.string().nullable(),runs:z.array(jobRunSchema).max(20)});
export type AutomationStatus=z.infer<typeof automationStatusSchema>;
