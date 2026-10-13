import { z } from 'zod';
import { jobSchema, type Job } from '../../../../../packages/contracts/src/index.js';
import { normalized, relevant } from './rules.js';

export type FetchJson = (url: string) => Promise<unknown>;
export async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'error', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error('Resposta vazia');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 10 * 1024 * 1024) throw new Error('Resposta excede limite');
      chunks.push(part.value);
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export function plainText(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|nbsp);/g, (entity) => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&nbsp;':' '}[entity] ?? ' ')).replace(/\s+/g, ' ').trim().slice(0, 50_000);
}
function seniority(title: string): Job['seniority'] {
  const value = normalized(title);
  if (/\b(senior|sr|lead|staff|principal)\b/.test(value)) return 'senior';
  if (/\b(junior|jr|entry)\b/.test(value)) return 'junior';
  if (/\b(pleno|mid|mid-level|intermediate)\b/.test(value)) return 'mid';
  return 'unknown';
}
function publishedAt(value: string | null): string | null {
  return value && z.iso.datetime({offset:true}).safeParse(value).success && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}
const remotiveJob = z.object({ id: z.number(), title: z.string(), company_name: z.string(), url: z.url(), description: z.string(), publication_date: z.string().optional(), candidate_required_location: z.string().optional(), salary: z.string().optional() });
export async function collectRemotive(fetcher: FetchJson): Promise<Job[]> {
  const result = z.object({jobs: z.array(z.unknown()).max(10_000)}).parse(await fetcher('https://remotive.com/api/remote-jobs?category=software-dev'));
  const jobs: Job[] = [];
  for (const raw of result.jobs) {
    const parsed = remotiveJob.safeParse(raw); if (!parsed.success) continue;
    const item = parsed.data; const description = plainText(item.description);
    if (!relevant(item.title, description)) continue;
    const value = jobSchema.safeParse({ id: `remotive:${item.id}`, source: 'remotive', sourceId: String(item.id), title: item.title, company: item.company_name, url: item.url, description, salary: item.salary || null, candidateLocation: item.candidate_required_location || null, modality: 'remote', seniority: seniority(item.title), publicationRaw: item.publication_date ?? null, publishedAt: publishedAt(item.publication_date ?? null), eligibility:'unconfirmed', recency:'unknown', reasons:[] });
    if (value.success && new URL(value.data.url).hostname === 'remotive.com') jobs.push(value.data);
  }
  return jobs;
}
const greenhouseJob = z.object({ id: z.number(), title: z.string(), absolute_url: z.url(), location: z.object({name:z.string()}), content: z.string().optional() });
const greenhouseDetail = z.object({first_published: z.string().nullable().optional(), company_name: z.string().optional(), content:z.string().optional()});
export async function collectGreenhouse(board: string, fetcher: FetchJson): Promise<Job[]> {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(board)) throw new Error('Quadro inválido');
  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`;
  const result = z.object({jobs:z.array(z.unknown()).max(10_000)}).parse(await fetcher(`${endpoint}?content=true`));
  const jobs: Job[] = [];
  const started = Date.now();
  for (const raw of result.jobs) {
    const parsed = greenhouseJob.safeParse(raw); if (!parsed.success) continue;
    const item = parsed.data; const description = plainText(item.content ?? '');
    if (!relevant(item.title, description)) continue;
    // Cap details to avoid unbounded requests per company; report this limit in the source status.
    if (jobs.length >= 30 || Date.now() - started > 30_000) break;
    let detail: z.infer<typeof greenhouseDetail> = {};
    try { detail = greenhouseDetail.parse(await fetcher(`${endpoint}/${item.id}`)); } catch { /* Listing stays usable with unknown publication. */ }
    const location = item.location.name;
    const mode = normalized(location);
    const modality: Job['modality'] = /hybrid|hibrido/.test(mode) ? 'hybrid' : /remote|remoto/.test(mode) ? 'remote' : /onsite|on-site|presencial/.test(mode) ? 'onsite' : 'unknown';
    const value = jobSchema.safeParse({id:`greenhouse:${board}:${item.id}`,source:'greenhouse',sourceId:`${board}:${item.id}`,title:item.title,company:detail.company_name ?? board,url:item.absolute_url,description:plainText(detail.content ?? item.content ?? ''),salary:null,candidateLocation:location || null,modality,seniority:seniority(item.title),publicationRaw:detail.first_published ?? null,publishedAt:publishedAt(detail.first_published ?? null),eligibility:'unconfirmed',recency:'unknown',reasons:[]});
    if (value.success) jobs.push(value.data);
  }
  return jobs;
}
