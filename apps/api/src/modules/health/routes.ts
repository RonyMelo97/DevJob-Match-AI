import type { FastifyInstance } from 'fastify';
import { healthResponseSchema, type HealthResponse } from '../../../../../packages/contracts/src/index.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (): Promise<HealthResponse> => {
    return healthResponseSchema.parse({ status: 'ok', service: 'devjob-api', version: '1.0.0' });
  });
}
