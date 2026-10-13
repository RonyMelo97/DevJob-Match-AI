import { z } from 'zod';

const envSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  GREENHOUSE_BOARDS: z.string().default('').transform((value) => value.split(',').map((board) => board.trim()).filter(Boolean)).pipe(z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/)).max(5)),
  AI_ENABLED:z.enum(['true','false']).default('false').transform((value)=>value==='true'),
  OPENAI_API_KEY:z.string().default(''),
  AI_MAX_REQUEST_USD:z.coerce.number().positive().max(1).default(0.01),
  AI_DAILY_BUDGET_USD:z.coerce.number().positive().max(10).default(0.10),
  JOBS_AUTO_REFRESH:z.enum(['true','false']).default('true').transform((value)=>value==='true'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): AppConfig {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Configuração inválida: ${fields}`);
  }
  return result.data;
}
