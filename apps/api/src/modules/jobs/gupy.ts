import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { jobSchema, type Job } from '../../../../../packages/contracts/src/index.js';
import { plainText } from './providers.js';
import { relevant, normalized } from './rules.js';
const BOARDS = ['deliverit', 'tgid', 'fcamara', 'cadastra', 'webjump'];
const cacheSchema = z.object({ jobs: z.array(jobSchema), nextRefreshAt: z.iso.datetime(), checkedAt: z.iso.datetime(), failures: z.number().int() });
export function pageData(html: string): unknown {
    const script = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!script)
        throw new Error('Dados públicos da página não encontrados.');
    return JSON.parse(script[1] ?? '') as unknown;
}
export async function fetchGupyPage(url: string): Promise<string> {
    const parsed = new URL(url);
    const allowed = (BOARDS.some(board => parsed.hostname === `${board}.gupy.io`) && parsed.pathname === '/') || (/^[a-z0-9-]+\.gupy\.io$/.test(parsed.hostname) && /^\/jobs\/\d+$/.test(parsed.pathname)) || (parsed.hostname === 'portal.gupy.io' && parsed.pathname === '/job-search/term%3DReact');
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password || !allowed)
        throw new Error('Endereço fora das páginas públicas permitidas.');
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.body)
        throw new Error('Página indisponível.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const item = await reader.read();
            if (item.done)
                break;
            size += item.value.byteLength;
            if (size > 2000000)
                throw new Error('Página excede limite.');
            chunks.push(item.value);
        }
    }
    finally {
        await reader.cancel();
    }
    return Buffer.concat(chunks).toString('utf8');
}
const detail = z.object({ id: z.number(), name: z.string(), status: z.string(), description: z.string(), prerequisites: z.string(), responsibilities: z.string(), relevantExperiences: z.string().optional(), publishedAt: z.string().nullable().optional(), expiresAt: z.string().nullable().optional(), addressCity: z.string().optional(), addressStateShortName: z.string().optional(), addressCountry: z.string().optional(), workplaceType: z.string().optional(), jobType: z.string().optional() });
export function parseGupyJob(html: string, board: string, company: string, now: Date): Job | null {
    const data = z.object({ props: z.object({ pageProps: z.object({ job: detail }) }) }).parse(pageData(html));
    const item = data.props.pageProps.job;
    if (item.status !== 'published' || item.jobType === 'vacancy_type_talent_pool' || (item.expiresAt && item.expiresAt < now.toISOString().slice(0, 10)))
        return null;
    const clean = (html: string): string => html.replace(/<\/(?:p|li|h[1-6])>|<br\s*\/?\s*>/gi, '\n').split('\n').map(line => plainText(line)).join('\n');
    const description = clean(`Descrição\n${item.description}\nResponsabilidades\n${item.responsibilities}\nRequisitos\n${item.prerequisites}\nInformações adicionais\n${item.relevantExperiences ?? ''}`);
    if (!relevant(item.name, description))
        return null;
    const title = normalized(item.name);
    const seniority: Job['seniority'] = /\b(senior|sr|lead|staff)\b/.test(title) ? 'senior' : /\b(junior|jr)\b/.test(title) ? 'junior' : /\b(pleno|mid)\b/.test(title) ? 'mid' : 'unknown';
    const modality: Job['modality'] = item.workplaceType === 'remote' ? 'remote' : item.workplaceType === 'hybrid' ? 'hybrid' : item.workplaceType === 'on-site' ? 'onsite' : 'unknown';
    const publication = item.publishedAt && z.iso.datetime({ offset: true }).safeParse(item.publishedAt).success ? item.publishedAt : null;
    return jobSchema.parse({ id: `gupy:${board}:${item.id}`, source: 'gupy', sourceId: `${board}:${item.id}`, title: item.name, company, url: `https://${board}.gupy.io/jobs/${item.id}`, description, salary: null, candidateLocation: [item.addressCity, item.addressStateShortName, item.addressCountry].filter(Boolean).join(', ') || null, modality, seniority, publishedAt: publication, publicationRaw: publication, checkedAt: now.toISOString(), eligibility: 'unconfirmed', recency: 'unknown', reasons: [] });
}
export class GupyCatalog {
    private running: Promise<z.infer<typeof cacheSchema>> | null = null;
    constructor(private readonly path: string, private readonly fetcher: (url: string) => Promise<string> = fetchGupyPage, private readonly clock: () => Date = () => new Date(), private readonly portal = false) { }
    get(): Promise<z.infer<typeof cacheSchema>> {
        if (!this.running)
            this.running = this.readOrCollect().finally(() => { this.running = null; });
        return this.running;
    }
    private async readOrCollect(): Promise<z.infer<typeof cacheSchema>> {
        let cached: z.infer<typeof cacheSchema> | null = null;
        try {
            cached = cacheSchema.parse(JSON.parse(await readFile(this.path, 'utf8')) as unknown);
        }
        catch (error: unknown) {
            if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
                throw error;
        }
        if (cached && Date.parse(cached.nextRefreshAt) > this.clock().getTime())
            return cached;
        return this.collect(cached);
    }
    private async save(value: z.infer<typeof cacheSchema>): Promise<void> { await mkdir(dirname(this.path), { recursive: true }); await writeFile(`${this.path}.tmp`, JSON.stringify(value)); await rename(`${this.path}.tmp`, this.path); }
    private async collect(previous: z.infer<typeof cacheSchema> | null): Promise<z.infer<typeof cacheSchema>> {
        const now = this.clock();
        const next = { jobs: [] as Job[], checkedAt: now.toISOString(), nextRefreshAt: new Date(now.getTime() + 21600000).toISOString(), failures: 0 };
        await this.save({ ...next, jobs: previous?.jobs ?? [], failures: BOARDS.length });
        if (this.portal) {
            try {
                const data = z.object({ props: z.object({ pageProps: z.object({ initialJobList: z.object({ data: z.array(z.object({ id: z.number(), name: z.string(), careerPageName: z.string(), jobUrl: z.url() })).max(100) }) }) }) }).parse(pageData(await this.fetcher('https://portal.gupy.io/job-search/term%3DReact')));
                const candidates = data.props.pageProps.initialJobList.data.filter(job => /react/i.test(job.name) && !/react native|mobile|ios|android/i.test(job.name)).slice(0, 12);
                for (const candidate of candidates) {
                    try {
                        const source = new URL(candidate.jobUrl);
                        if (!/^[a-z0-9-]+\.gupy\.io$/.test(source.hostname) || source.protocol !== 'https:' || source.port || source.username || source.password)
                            throw new Error('Link fora da Gupy');
                        const board = source.hostname.split('.')[0]!;
                        const job = parseGupyJob(await this.fetcher(`https://${board}.gupy.io/jobs/${candidate.id}`), board, candidate.careerPageName, now);
                        if (job && job.sourceId === `${board}:${candidate.id}`)
                            next.jobs.push(job);
                    }
                    catch {
                        next.failures++;
                    }
                }
            }
            catch {
                next.failures++;
                next.jobs.push(...(previous?.jobs ?? []));
            }
        }
        for (const board of this.portal ? [] : BOARDS) {
            try {
                const data = z.object({ props: z.object({ pageProps: z.object({ careerPage: z.object({ name: z.string() }), jobs: z.array(z.object({ id: z.number(), title: z.string() })).max(5000) }) }) }).parse(pageData(await this.fetcher(`https://${board}.gupy.io/`)));
                const list = data.props.pageProps;
                const candidates = list.jobs.filter(job => relevant(job.title, '') && !/\b(mobile|ios|android|react native)\b/i.test(job.title)).sort((a, b) => Number(/react/i.test(b.title)) - Number(/react/i.test(a.title))).slice(0, 5);
                for (const candidate of candidates) {
                    try {
                        const job = parseGupyJob(await this.fetcher(`https://${board}.gupy.io/jobs/${candidate.id}`), board, list.careerPage.name, now);
                        if (job)
                            next.jobs.push(job);
                    }
                    catch {
                        next.failures++;
                    }
                }
            }
            catch {
                next.failures++;
                next.jobs.push(...(previous?.jobs.filter(job => job.sourceId.startsWith(`${board}:`)) ?? []));
            }
        }
        await this.save(next);
        return next;
    }
}
export class GupySources {
    private readonly boards: GupyCatalog;
    private readonly portal: GupyCatalog;
    constructor(path: string) { this.boards = new GupyCatalog(path); this.portal = new GupyCatalog(path.replace(/\.json$/, '-react.json'), undefined, undefined, true); }
    async get(): Promise<z.infer<typeof cacheSchema>> {
        const [a, b] = await Promise.all([this.boards.get(), this.portal.get()]);
        const map = new Map([...a.jobs, ...b.jobs].map(job => [job.id, job]));
        return { ...b, jobs: [...map.values()], failures: a.failures + b.failures };
    }
}
