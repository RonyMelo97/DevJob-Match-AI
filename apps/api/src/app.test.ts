import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@devjob/contracts';
import { buildApp } from './app.js';
import { parseEnv } from './config/env.js';

describe('API foundation', () => {
  it('returns the validated health contract', async () => {
    const app = buildApp(parseEnv({}));
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(healthResponseSchema.parse(response.json())).toEqual({ status: 'ok', service: 'devjob-api', version: '0.5.0' });
    } finally { await app.close(); }
  });
  it.each(['0', '65536', 'abc'])('rejects invalid port %s', (PORT) => {
    expect(() => parseEnv({ PORT })).toThrow('Configuração inválida: PORT');
  });
  it('rejects invalid browser origin', () => {
    expect(() => parseEnv({ CORS_ORIGIN: 'invalid' })).toThrow('CORS_ORIGIN');
  });
  it('allows the configured browser origin', async () => {
    const app = buildApp(parseEnv({}));
    try {
      const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:5173' } });
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    } finally { await app.close(); }
  });
});
