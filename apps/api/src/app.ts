import Fastify, { LogController, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { AppConfig } from './config/env.js';
import { healthRoutes } from './modules/health/routes.js';
import multipart from '@fastify/multipart';
import { fileURLToPath } from 'node:url';
import { MAX_PDF_BYTES } from '../../../packages/contracts/src/index.js';
import { resumeRoutes } from './modules/resumes/routes.js';
import { FileProfileRepository, type ProfileRepository } from './modules/resumes/repository.js';
import { ResumeError, type ExtractedPdf } from './modules/resumes/pdf.js';
import { FileJobsCache, JobsService } from './modules/jobs/service.js';
import { jobRoutes } from './modules/jobs/routes.js';
import { matchingRoutes } from './modules/matching/routes.js';

export type AppDependencies = { repository?: ProfileRepository; extract?: (data: Buffer) => Promise<ExtractedPdf>; jobsService?: JobsService };

export function buildApp(config: AppConfig, logger = false, dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({ logger, bodyLimit: 200_000, logController: new LogController({ disableRequestLogging: true }) });
  const origins = [config.CORS_ORIGIN];
  const configured = new URL(config.CORS_ORIGIN);
  if (['localhost', '127.0.0.1'].includes(configured.hostname)) {
    configured.hostname = configured.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    origins.push(configured.origin);
  }
  app.register(cors, { origin: origins });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (request.url !== '/health' && request.headers.origin && !origins.includes(request.headers.origin)) {
      return reply.code(403).send({ message: 'Origem não autorizada.' });
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ResumeError) return reply.code(error.statusCode).send({ message: error.message });
    const code = error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    return reply.code(code >= 400 && code < 500 ? code : 500).send({ message: code === 413 ? 'O PDF deve ter até 5 MB; envie apenas um arquivo.' : code >= 400 && code < 500 ? 'Requisição inválida. Envie um único PDF de até 5 MB.' : 'Não foi possível concluir a operação. Tente novamente.' });
  });
  app.register(multipart, { limits: { files: 1, fields: 0, parts: 1, fileSize: MAX_PDF_BYTES, headerPairs: 100 } });
  const sourceRoot = import.meta.url.includes('/dist/') ? '../../../../../../private/resumes/' : '../../../private/resumes/';
  const repository = dependencies.repository ?? new FileProfileRepository(fileURLToPath(new URL(sourceRoot, import.meta.url)));
  app.register(resumeRoutes, { repository, ...(dependencies.extract ? { extract: dependencies.extract } : {}) });
  app.register(healthRoutes);
  const jobsPath = fileURLToPath(new URL('../jobs/cache.json', new URL(sourceRoot,import.meta.url)));
  const jobsService=dependencies.jobsService??new JobsService(new FileJobsCache(jobsPath),config.GREENHOUSE_BOARDS);
  app.register(jobRoutes,{service:jobsService});
  app.register(matchingRoutes,{repository,jobs:jobsService});
  return app;
}
