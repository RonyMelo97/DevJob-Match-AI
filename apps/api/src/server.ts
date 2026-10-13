import { buildApp } from './app.js';
import { parseEnv } from './config/env.js';

async function start(): Promise<void> {
  const config = parseEnv(process.env);
  const app = buildApp(config, true);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void app.close(); });
  }
  await app.listen({ host: config.HOST, port: config.PORT });
}

start().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao iniciar API');
  process.exitCode = 1;
});
