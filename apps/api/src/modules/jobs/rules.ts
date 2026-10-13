import type { Job } from '../../../../../packages/contracts/src/index.js';
import { z } from 'zod';

export function normalized(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
export function relevant(title: string, description: string): boolean {
  const value = normalized(title);
  return /front[ -]?end|react|typescript|javascript|desenvolvedor web|web developer|wordpress|programador web/.test(value)
    || (/software engineer|engenheiro de software/.test(value) && /front[ -]?end|react/.test(normalized(description)));
}
export function classify(job: Job, now: Date): Job {
  const reasons: string[] = [];
  let eligibility: Job['eligibility'] = 'unconfirmed';
  const location = normalized(job.candidateLocation ?? '').trim();
  // Candidate location only: never use company offices as candidate requirements.
  if (job.modality === 'remote') {
    if (/\b(except|excluding|not|exceto)\s+(?:candidates?\s+from\s+)?(?:brazil|brasil)\b/.test(location)) {
      eligibility = 'excluded'; reasons.push('A fonte exclui explicitamente profissionais no Brasil.');
    } else if (/\b(brasil|brazil|worldwide|anywhere|global|latin america|latam|south america)\b/.test(location)) {
      eligibility = 'eligible'; reasons.push('A fonte inclui o Brasil ou uma região que abrange o Brasil.');
    } else if (location.split(/[,;|/]/).every((region) => /^(us|usa|united states|united kingdom|uk|canada|europe|eu|emea|apac|germany|portugal)( only)?$/.test(region.trim()))) {
      eligibility = 'excluded'; reasons.push('Restrição geográfica da vaga não inclui o Brasil.');
    } else reasons.push('Elegibilidade para trabalhar do Brasil não confirmada.');
    if (/\b(?:must|only|obrigatorio)\b.{0,35}\b(?:us citizen|us citizenship|reside in the us|residir nos estados unidos)\b|\b(?:remote|candidates?|applicants?)\b.{0,25}\b(?:us|usa|united states) only\b/i.test(job.description)) {
      eligibility = 'excluded'; reasons.push('A descrição contém restrição explícita incompatível com o Brasil.');
    }
  } else if (job.modality === 'onsite' || job.modality === 'hybrid') {
    const city = location.replace(/\b(onsite|on-site|presencial|hybrid|hibrido)\b/g, '').replace(/[()]/g, '').trim().replace(/^(brazil|brasil)\s*,\s*/, '');
    if (/^sao paulo(?:\s*[,/-]\s*(?:sp|sao paulo|brazil|brasil|br)\b.*)?$/.test(city) && !/state|estado/.test(city)) {
      eligibility = 'eligible'; reasons.push('Local de trabalho informado como São Paulo.');
    } else if (location && !/^(brazil|brasil|sp)$/.test(location) && !/sao paulo.*state|state.*sao paulo|estado.*sao paulo/.test(location)) {
      eligibility = 'excluded'; reasons.push('Local presencial ou híbrido não identificado como São Paulo.');
    } else reasons.push('Cidade de trabalho não confirmada.');
  } else reasons.push('Modalidade não informada; verificar localização e elegibilidade.');
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  let recency: Job['recency'] = 'unknown';
  if (job.publishedAt) {
    const timestamp = Date.parse(job.publishedAt);
    if (Number.isFinite(timestamp)) recency = timestamp >= cutoff && timestamp <= now.getTime() ? 'recent' : 'excluded';
  } else if (job.publicationRaw && (z.iso.date().safeParse(job.publicationRaw).success || z.iso.datetime({local:true}).safeParse(job.publicationRaw).success)) {
    const day = job.publicationRaw.slice(0, 10);
    const start = Date.parse(`${day}T00:00:00+14:00`);
    const end = Date.parse(`${day}T23:59:59-12:00`);
    if (Number.isFinite(start) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day) {
      if (start >= cutoff && end <= now.getTime()) recency = 'recent';
      else if (end < cutoff || start > now.getTime()) recency = 'excluded';
      reasons.push('Fuso não informado: recência avaliada de forma conservadora por intervalo de datas.');
    }
  }
  if (recency === 'unknown') reasons.push('Data de publicação ou recência não confirmada.');
  return { ...job, eligibility, recency, reasons };
}
export function canonicalUrl(value: string): string {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(ref|source)$/i.test(key)) url.searchParams.delete(key);
  url.hash = ''; url.searchParams.sort();
  return url.toString().replace(/\/$/, '');
}
export function deduplicate(jobs: Job[]): { jobs: Job[]; duplicates: number } {
  const seen = new Set<string>(); const result: Job[] = []; let duplicates = 0;
  for (const job of jobs) {
    const keys = [`${job.source}:${job.sourceId}`, canonicalUrl(job.url)];
    if (keys.some((key) => seen.has(key))) { duplicates++; continue; }
    keys.forEach((key) => seen.add(key)); result.push(job);
  }
  return { jobs: result, duplicates };
}
