import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseGupyJob, GupyCatalog, fetchGupyPage } from './gupy.js';
const now = new Date('2026-10-13T12:00:00Z');
const job = { id: 1, name: 'Frontend React Pleno', status: 'published', description: 'Interfaces React', prerequisites: '<ul><li>React</li><li>TypeScript</li></ul>', responsibilities: 'Interfaces responsivas', publishedAt: '2026-10-10T12:00:00Z', expiresAt: '2026-11-01', addressCountry: 'Brasil', workplaceType: 'remote', jobType: 'vacancy_type_effective' };
function html(value: unknown): string { return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: value } })}</script>`; }
describe('public Gupy verification', () => {
    it('discovers portal results, verifies their original page and ignores mobile', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'gupy-portal-'));
        try {
            const fetcher = vi.fn(async (url: string) => url.includes('job-search') ? html({ initialJobList: { data: [{ id: 1, name: 'React PHP Frontend', careerPageName: 'Company', jobUrl: 'https://newcompany.gupy.io/job/public' }, { id: 2, name: 'React Native Mobile', careerPageName: 'Mobile', jobUrl: 'https://mobile.gupy.io/job/public' }] } }) : html({ job }));
            const data = await new GupyCatalog(join(dir, 'cache.json'), fetcher, () => now, true).get();
            expect(data.jobs).toHaveLength(1);
            expect(data.jobs[0]?.url).toBe('https://newcompany.gupy.io/jobs/1');
            expect(fetcher).toHaveBeenCalledTimes(2);
        }
        finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
    it('imports original requirements and real publication, never discovery time', () => {
        const result = parseGupyJob(html({ job }), 'deliverit', 'Company', now);
        expect(result?.publishedAt).toBe(job.publishedAt);
        expect(result?.checkedAt).toBe(now.toISOString());
        expect(result?.description).toContain('Requisitos\nReact\nTypeScript');
        expect(result?.source).toBe('gupy');
    });
    it.each(['canceled', 'closed', 'draft'])('discards %s rather than displaying an apply link', status => { expect(parseGupyJob(html({ job: { ...job, status } }), 'deliverit', 'Company', now)).toBeNull(); });
    it('discards expired and talent pool records', () => {
        expect(parseGupyJob(html({ job: { ...job, expiresAt: '2026-01-01' } }), 'deliverit', 'Company', now)).toBeNull();
        expect(parseGupyJob(html({ job: { ...job, jobType: 'vacancy_type_talent_pool' } }), 'deliverit', 'Company', now)).toBeNull();
    });
    it('rejects arbitrary hosts, ports, credentials and unrelated paths before networking', async () => {
        for (const url of ['https://example.org/', 'https://deliverit.gupy.io/other', 'https://deliverit.gupy.io:444/', 'https://user@deliverit.gupy.io/'])
            await expect(fetchGupyPage(url)).rejects.toThrow();
    });
    it('persists cooldown and shares a concurrent collection', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'gupy-test-'));
        try {
            const fetcher = vi.fn(async (url: string) => url.endsWith('/') ? html({ careerPage: { name: 'Company' }, jobs: [{ id: 1, title: 'Frontend React Pleno' }] }) : html({ job }));
            const catalog = new GupyCatalog(join(dir, 'cache.json'), fetcher, () => now);
            const [a, b] = await Promise.all([catalog.get(), catalog.get()]);
            expect(a.jobs).toHaveLength(5);
            expect(b.jobs).toEqual(a.jobs);
            expect(fetcher).toHaveBeenCalledTimes(10);
            await new GupyCatalog(join(dir, 'cache.json'), fetcher, () => now).get();
            expect(fetcher).toHaveBeenCalledTimes(10);
        }
        finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
