import type { FastifyInstance } from 'fastify';
import { MAX_PDF_BYTES, draftSchema, saveProfileSchema } from '../../../../../packages/contracts/src/index.js';
import { extractProfile } from './extract-profile.js';
import { extractPdf, ResumeError, type ExtractedPdf } from './pdf.js';
import type { ProfileRepository } from './repository.js';

export async function resumeRoutes(app: FastifyInstance, options: { repository: ProfileRepository; extract?: (data: Buffer) => Promise<ExtractedPdf> }): Promise<void> {
  let extracting = false;
  app.post('/resumes/extract', async (request, reply) => {
    if (extracting) return reply.code(429).send({ message: 'Há um PDF em processamento. Tente novamente em alguns instantes.' });
    extracting = true;
    try {
      let data: Buffer | undefined;
      for await (const part of request.parts()) {
        if (part.type !== 'file' || part.fieldname !== 'resume') throw new ResumeError('Envie um único arquivo no campo resume.', 400);
        if (part.mimetype !== 'application/pdf' || !part.filename.toLowerCase().endsWith('.pdf')) throw new ResumeError('Somente arquivos PDF são aceitos.', 415);
        data = await part.toBuffer();
        if (data.length > MAX_PDF_BYTES) throw new ResumeError('O PDF deve ter até 5 MB.', 413);
        if (data.subarray(0, 5).toString('ascii') !== '%PDF-') throw new ResumeError('O conteúdo enviado não é um PDF válido.', 415);
      }
      if (!data) throw new ResumeError('Selecione um PDF para continuar.', 400);
      const result = await (options.extract ?? extractPdf)(data);
      return draftSchema.parse(extractProfile(result.text, result.pages));
    } finally { extracting = false; }
  });
  app.get('/profile', async () => ({ saved: await options.repository.get() }));
  app.put('/profile', async (request, reply) => {
    const result = saveProfileSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ message: 'Revise os campos e confirme a revisão do perfil antes de salvar.' });
    const saved = { ...result.data, savedAt: new Date().toISOString() };
    await options.repository.save(saved);
    return { saved };
  });
  app.delete('/profile', async (_request, reply) => {
    await options.repository.delete();
    return reply.code(204).send();
  });
}
