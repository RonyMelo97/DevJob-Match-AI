import type { FastifyInstance } from 'fastify';
import type { JobsService } from './service.js';

export async function jobRoutes(app:FastifyInstance, options:{service:JobsService}):Promise<void> {
  app.get('/jobs',async()=>options.service.get());
  app.post('/jobs/refresh',async()=>options.service.get(true));
}
