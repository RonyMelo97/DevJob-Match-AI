import { describe, it, expect, vi } from 'vitest';
import { createPublicApi } from './public-api';
import { type Job } from '@devjob/contracts';
const profile = { objective: 'Front-end junior', summary: '', skills: ['React'], experience: '', education: '', languages: '' };
const job: Job = { id: 'fixture', source: 'remotive', sourceId: 'fixture', title: 'Frontend Developer', company: 'Synthetic test only', url: 'https://example.org/job', description: 'Requisitos obrigatórios\nReact', salary: null, candidateLocation: 'Worldwide', modality: 'remote', seniority: 'junior', publishedAt: new Date(Date.now() - 3600000).toISOString(), publicationRaw: null, eligibility: 'eligible', recency: 'recent', reasons: [] };
const snapshot = { jobs: [job], unconfirmedDates: [], collectedAt: new Date().toISOString(), nextRefreshAt: null, sources: [], discarded: 0, duplicates: 0 };
describe('public browser privacy boundary', () => {
    it('reviews, scores and deletes in memory, sending no profile to the snapshot loader', async () => {
        const load = vi.fn(async () => snapshot);
        const extract = vi.fn();
        const api = createPublicApi(load, extract);
        expect((await api('/api/matches', { method: 'POST', body: '{}' })).status).toBe(409);
        const rejected = await api('/api/profile', { method: 'PUT', body: JSON.stringify({ profile, reviewed: false }) });
        expect(rejected.status).toBe(400);
        expect((await api('/api/profile', { method: 'PUT', body: JSON.stringify({ profile, reviewed: true }) })).ok).toBe(true);
        const result = await (await api('/api/matches', { method: 'POST', body: '{}' })).json();
        expect(result.results[0].analysis.score).toBeGreaterThan(0);
        expect(result.results[0].analysis.criteria.find((criterion:{key:string})=>criterion.key==='required').items).toHaveLength(1);
        expect(load.mock.calls).toEqual([[]]);
        expect(extract).not.toHaveBeenCalled();
        expect((await api('/api/ai/analyze', { method: 'POST', body: '{}' })).status).toBe(503);
        await api('/api/profile', { method: 'DELETE' });
        expect(await (await api('/api/profile')).json()).toEqual({ saved: null });
        const second = createPublicApi(load, extract);
        expect(await (await second('/api/profile')).json()).toEqual({ saved: null });
    });
    it('rechecks recency at reading time and keeps unknown dates separate', async () => {
        const api = createPublicApi(async () => ({ ...snapshot, jobs: [{ ...job, publishedAt: '2000-01-01T00:00:00Z' }], unconfirmedDates: [{ ...job, id: 'unknown', publishedAt: null }] }), vi.fn());
        const data = await (await api('/api/jobs')).json();
        expect(data.jobs).toEqual([]);
        expect(data.excludedJobs).toHaveLength(1);
        expect(data.excludedJobs[0].recency).toBe('excluded');
        expect(data.unconfirmedDates).toHaveLength(1);
    });
    it('rejects aborted operations without reading any public data', async () => {
        const load = vi.fn();
        const api = createPublicApi(load, vi.fn());
        const controller = new AbortController();
        controller.abort();
        await expect(api('/api/jobs', { signal: controller.signal })).rejects.toThrow();
        expect(load).not.toHaveBeenCalled();
    });
});
