import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { aiResultSchema } from '../../../../../packages/contracts/src/index.js';
import type { JobsService } from '../jobs/service.js';
import { AiError,type AiService } from './service.js';

export async function aiRoutes(app:FastifyInstance,options:{jobs:JobsService;ai:AiService}):Promise<void>{
  const find=async(id:string)=>{const data=await options.jobs.get();const job=[...data.jobs,...data.unconfirmedDates].find((item)=>item.id===id);if(!job)throw new AiError('Vaga não disponível no cache filtrado. Atualize a lista.',404);return job;};
  app.post('/ai/preview',async(request,reply)=>{const input=z.object({jobId:z.string().min(1).max(200)}).strict().safeParse(request.body);if(!input.success)return reply.code(400).send({message:'Informe o identificador da vaga.'});return options.ai.preview(await find(input.data.jobId));});
  app.post('/ai/analyze',async(request,reply)=>{const input=z.object({jobId:z.string().min(1).max(200),hash:z.string().regex(/^[a-f0-9]{64}$/),confirmed:z.literal(true)}).strict().safeParse(request.body);if(!input.success)return reply.code(400).send({message:'Confirme a prévia antes de solicitar a análise.'});return aiResultSchema.parse(await options.ai.analyze(await find(input.data.jobId),input.data.hash,input.data.confirmed));});
}
