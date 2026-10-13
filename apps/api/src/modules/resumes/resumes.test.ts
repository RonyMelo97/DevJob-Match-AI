import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../app.js';
import { parseEnv } from '../../config/env.js';
import { extractProfile } from './extract-profile.js';
import { FileProfileRepository } from './repository.js';
import { extractPdf } from './pdf.js';
import { MAX_PDF_BYTES } from '../../../../../packages/contracts/src/index.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
async function repository(): Promise<FileProfileRepository> {
  const directory = await mkdtemp(join(tmpdir(), 'devjob-test-')); directories.push(directory);
  return new FileProfileRepository(directory);
}
function multipart(data: Buffer, filename = 'resume.pdf'): Buffer {
  return Buffer.concat([Buffer.from(`--test\r\nContent-Disposition: form-data; name="resume"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`), data, Buffer.from('\r\n--test--\r\n')]);
}
// A minimal real PDF generated in code using only synthetic text.
function pdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let content = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(content);
}

describe('resume processing', () => {
  it('extracts actual PDF text locally', async () => {
    const result = await extractPdf(pdf('Synthetic Front-end developer with React and TypeScript'));
    expect(result.pages).toBe(1); expect(result.text).toContain('React and TypeScript');
  }, 20_000);
  it('rejects corrupt PDFs', async () => { await expect(extractPdf(Buffer.from('%PDF-broken'))).rejects.toThrow('íntegro'); }, 20_000);
  it('rejects PDFs without useful text with an OCR explanation', async () => { await expect(extractPdf(pdf(''))).rejects.toThrow('OCR'); }, 20_000);
  it('preserves sections and evidence without inventing language or experience', () => {
    const result = extractProfile('OBJETIVO\nFront-end\nCOMPETÊNCIAS TÉCNICAS\nReact, TypeScript, HTML5\nEXPERIÊNCIA PROFISSIONAL\nEmpresa fictícia - HTML e CSS\nFORMAÇÃO\nCurso fictício', 1);
    expect(result.profile.skills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'HTML']));
    expect(result.profile.experience).toBe('Empresa fictícia - HTML e CSS');
    expect(result.profile.languages).toBe('');
    expect(result.evidence.every((item) => result.sourceText.includes(item.excerpt))).toBe(true);
  });
  it('does not mistake GitHub for Git', () => { expect(extractProfile('Portfolio GitHub somente', 1).profile.skills).not.toContain('Git'); });
  it('validates upload content, size and review before saving', async () => {
    const app = buildApp(parseEnv({}), false, { repository: await repository(), extract: async () => ({ text: 'OBJETIVO\nFront-end com React', pages: 1 }) });
    try {
      const headers = { 'content-type': 'multipart/form-data; boundary=test' };
      const invalid = await app.inject({ method: 'POST', url: '/resumes/extract', headers, payload: multipart(Buffer.from('not PDF')) });
      expect(invalid.statusCode).toBe(415);
      const large = await app.inject({ method: 'POST', url: '/resumes/extract', headers, payload: multipart(Buffer.alloc(MAX_PDF_BYTES + 1)) });
      expect(large.statusCode).toBe(413);
      const valid = await app.inject({ method: 'POST', url: '/resumes/extract', headers, payload: multipart(Buffer.from('%PDF-test')) });
      expect(valid.statusCode).toBe(200);
      const before = await app.inject('/profile'); expect(before.json()).toEqual({ saved: null });
      const missingReview = await app.inject({ method: 'PUT', url: '/profile', payload: { profile: valid.json().profile } });
      expect(missingReview.statusCode).toBe(400);
      const save = await app.inject({ method: 'PUT', url: '/profile', payload: { profile: valid.json().profile, reviewed: true } });
      expect(save.statusCode).toBe(200);
      const loaded = await app.inject('/profile'); expect(loaded.json().saved.profile.objective).toBe('Front-end com React');
      expect(JSON.stringify(loaded.json())).not.toContain('sourceText');
      expect((await app.inject({ method: 'DELETE', url: '/profile' })).statusCode).toBe(204);
      expect((await app.inject('/profile')).json()).toEqual({ saved: null });
    } finally { await app.close(); }
  });
  it('reloads the profile through a new repository instance', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devjob-test-')); directories.push(directory);
    const first = new FileProfileRepository(directory);
    const saved = { profile: extractProfile('OBJETIVO\nFront-end', 1).profile, savedAt: new Date().toISOString(), reviewed: true as const };
    await first.save(saved); expect(await new FileProfileRepository(directory).get()).toEqual(saved);
    await first.delete(); expect(await first.get()).toBeNull();
  });
  it('rejects untrusted browser origins without leaking stored data', async () => {
    const app = buildApp(parseEnv({}), false, { repository: await repository() });
    try {
      expect((await app.inject({ url: '/profile', headers: { origin: 'https://untrusted.example' } })).statusCode).toBe(403);
      expect((await app.inject({ url: '/profile', headers: { origin: 'http://127.0.0.1:5173' } })).headers['cache-control']).toBe('no-store');
    } finally { await app.close(); }
  });
});
