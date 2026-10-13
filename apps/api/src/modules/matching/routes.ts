import type { FastifyInstance } from 'fastify';
import { matchRequestSchema, matchesResponseSchema } from '../../../../../packages/contracts/src/index.js';
import type { ProfileRepository } from '../resumes/repository.js';
import type { JobsService } from '../jobs/service.js';
import { analyzeMatch } from './engine.js';

export async function matchingRoutes(app:FastifyInstance,options:{repository:ProfileRepository;jobs:JobsService}):Promise<void> {
  app.post('/matches',async(request,reply)=> {
    const input=matchRequestSchema.safeParse(request.body??{});
    if(!input.success)return reply.code(400).send({message:'Informe pesos inteiros entre 0 e 100, com soma igual a 100.'});
    const saved=await options.repository.get();
    if(!saved)return reply.code(409).send({message:'Salve um perfil revisado antes de calcular compatibilidade.'});
    const jobs=await options.jobs.get();
    const rank=(list:typeof jobs.jobs)=>list.map((job)=>({job,analysis:analyzeMatch(job,saved.profile,input.data.weights)}))
      .sort((a,b)=>(b.analysis.score??-1)-(a.analysis.score??-1)||b.analysis.coverage-a.analysis.coverage||a.job.id.localeCompare(b.job.id));
    return matchesResponseSchema.parse({results:rank(jobs.jobs),unconfirmedDates:rank(jobs.unconfirmedDates),sources:jobs.sources,collectedAt:jobs.collectedAt,nextRefreshAt:jobs.nextRefreshAt,discarded:jobs.discarded,duplicates:jobs.duplicates,profileSavedAt:saved.savedAt});
  });
}
