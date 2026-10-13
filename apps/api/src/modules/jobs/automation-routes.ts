import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { automationStatusSchema } from '../../../../../packages/contracts/src/index.js';
import type { JobsScheduler } from './scheduler.js';
export async function automationRoutes(app: FastifyInstance, options: {
    scheduler: JobsScheduler;
}): Promise<void> { app.get('/jobs/automation', async () => automationStatusSchema.parse(await options.scheduler.status())); app.put('/jobs/automation', async (request, reply) => { const input = z.object({ enabled: z.boolean() }).strict().safeParse(request.body); if (!input.success)
    return reply.code(400).send({ message: 'Informe enabled como true ou false.' }); if (input.data.enabled)
    await options.scheduler.start();
else
    await options.scheduler.stop(); return automationStatusSchema.parse(await options.scheduler.status()); }); }
