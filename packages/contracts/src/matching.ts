import { z } from 'zod';
import { jobsResponseSchema, jobSchema } from './jobs.js';

export const weightsSchema = z.object({required:z.number().int().min(0).max(100),experience:z.number().int().min(0).max(100),seniority:z.number().int().min(0).max(100),desired:z.number().int().min(0).max(100),responsibilities:z.number().int().min(0).max(100),language:z.number().int().min(0).max(100)}).strict().refine((value)=>Object.values(value).reduce((sum,weight)=>sum+weight,0)===100,{message:'Os pesos devem somar 100.'});
export type MatchWeights = z.infer<typeof weightsSchema>;
export type Criterion = keyof MatchWeights;
export const DEFAULT_WEIGHTS:MatchWeights = {required:35,experience:20,seniority:15,desired:15,responsibilities:10,language:5};
export const matchItemSchema = z.object({requirement:z.string(),status:z.enum(['met','partial','not_met','insufficient']),jobEvidence:z.string().nullable(),profileEvidence:z.string().nullable(),explanation:z.string()});
export type MatchItem = z.infer<typeof matchItemSchema>;
export const analysisSchema = z.object({engineVersion:z.literal('0.4.0'),score:z.number().min(0).max(100).nullable(),coverage:z.number().min(0).max(100),weights:weightsSchema,criteria:z.array(z.object({key:z.enum(['required','experience','seniority','desired','responsibilities','language']),weight:z.number(),contribution:z.number(),items:z.array(matchItemSchema)})),warnings:z.array(z.string())});
export type MatchAnalysis = z.infer<typeof analysisSchema>;
export const matchRequestSchema = z.object({weights:weightsSchema.optional()}).strict();
export const matchesResponseSchema = z.object({results:z.array(z.object({job:jobSchema,analysis:analysisSchema})),unconfirmedDates:z.array(z.object({job:jobSchema,analysis:analysisSchema})),sources:jobsResponseSchema.shape.sources,collectedAt:z.string().nullable(),nextRefreshAt:z.string().nullable(),discarded:z.number(),duplicates:z.number(),profileSavedAt:z.string()});
export type MatchesResponse = z.infer<typeof matchesResponseSchema>;
