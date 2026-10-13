import { fork } from 'node:child_process';
import { z } from 'zod';
import { MAX_RESUME_TEXT } from '../../../../../packages/contracts/src/index.js';

export class ResumeError extends Error {
  constructor(message: string, public readonly statusCode = 422) { super(message); }
}
export type ExtractedPdf = { text: string; pages: number };
export async function extractPdf(data: Buffer): Promise<ExtractedPdf> {
  return new Promise((resolve, reject) => {
    const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
    const child = fork(new URL(`./pdf-worker.${extension}`, import.meta.url), [], {
      execArgv: ['--max-old-space-size=256'], stdio: ['ignore', 'ignore', 'ignore', 'ipc'], serialization: 'advanced',
    });
    const cleanup = (): void => { clearTimeout(timer); child.removeAllListeners(); child.kill(); };
    const fail = (message: string): void => { cleanup(); reject(new ResumeError(message)); };
    const timer = setTimeout(() => fail('O PDF excedeu o tempo de processamento de 15 segundos. Envie uma versão mais simples.'), 15_000);
    child.once('error', () => fail('Não foi possível iniciar a leitura local do PDF.'));
    child.once('exit', () => fail('Não foi possível ler o PDF. Verifique se está íntegro e sem senha.'));
    child.once('message', (message: unknown) => {
      const error = z.object({ error: z.string() }).safeParse(message);
      if (error.success) { fail(error.data.error); return; }
      const result = z.object({ text: z.string().min(20).max(MAX_RESUME_TEXT), pages: z.number().int().min(1).max(20) }).safeParse(message);
      if (!result.success) { fail('O PDF não contém um currículo válido dentro dos limites.'); return; }
      cleanup(); resolve(result.data);
    });
    child.send(data, (error) => { if (error) fail('Falha na leitura local do PDF.'); });
  });
}
