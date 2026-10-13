import { linkedinImportSchema,importedLinkedinJob,jobsResponseSchema, saveProfileSchema, matchRequestSchema, type SavedProfile, type ResumeDraft } from '@devjob/contracts';
import { analyzeMatch } from '../../../api/src/modules/matching/engine';
import { classify } from '../../../api/src/modules/jobs/rules';
export function createPublicApi(loadJobs: () => Promise<unknown>, extract: (file: File) => Promise<ResumeDraft>) {
    let imported:ReturnType<typeof importedLinkedinJob>[]=[];
    let saved: SavedProfile | null = null;
    const json = (body: unknown, status = 200): Response => Response.json(body, { status });
    async function jobs() {
        const data = jobsResponseSchema.parse(await loadJobs());
        const classified = [...data.jobs, ...data.unconfirmedDates, ...data.excludedJobs].map(job => classify(job, new Date()));
        const all=classified.filter(job => job.recency !== 'excluded' && job.eligibility !== 'excluded' && job.seniority !== 'senior');
        return { ...data, excludedJobs:classified.filter(job=>job.recency==='excluded'||job.eligibility==='excluded'||job.seniority==='senior'), discarded: data.discarded + data.jobs.length + data.unconfirmedDates.length - all.length, jobs: all.filter(job => job.recency === 'recent'), unconfirmedDates: all.filter(job => job.recency === 'unknown') };
    }
    return async (path: string, init: RequestInit = {}): Promise<Response> => {
        if (init.signal?.aborted)
            throw new DOMException('Aborted', 'AbortError');
        try {
            const method = init.method ?? 'GET';
            if(path==='/api/jobs/imported')return json({jobs:imported});
            if(path==='/api/jobs/import'&&method==='POST'){const job=importedLinkedinJob(linkedinImportSchema.parse(JSON.parse(String(init.body)) as unknown));imported=[job,...imported.filter(item=>item.id!==job.id)].slice(0,100);return json({job});}
            if (path === '/api/health')
                return json({ status: 'ok', service: 'devjob-api', version: '1.0.0' });
            if (path === '/api/profile') {
                if (method === 'GET')
                    return json({ saved });
                if (method === 'DELETE') {
                    saved = null;
                    return new Response(null, { status: 204 });
                }
                if (method === 'PUT') {
                    const input = saveProfileSchema.parse(JSON.parse(String(init.body)) as unknown);
                    saved = { ...input, savedAt: new Date().toISOString() };
                    return json({ saved });
                }
            }
            if (path === '/api/resumes/extract' && method === 'POST') {
                const file = init.body instanceof FormData ? init.body.get('resume') : null;
                if (!(file instanceof File))
                    return json({ message: 'Selecione um PDF.' }, 400);
                return json(await extract(file));
            }
            if (path === '/api/jobs' || path === '/api/jobs/refresh')
                return json(await jobs());
            if (path === '/api/matches' && method === 'POST') {
                if (!saved)
                    return json({ message: 'Salve um perfil revisado antes de calcular compatibilidade.' }, 409);
                const reviewedProfile = saved;
                const input = matchRequestSchema.parse(JSON.parse(String(init.body)) as unknown);
                const data = await jobs();
                const rank = (list: typeof data.jobs) => list.map(job => ({ job, analysis: analyzeMatch(job, reviewedProfile.profile, input.weights) })).sort((a, b) => (b.analysis.score ?? -1) - (a.analysis.score ?? -1) || b.analysis.coverage - a.analysis.coverage || a.job.id.localeCompare(b.job.id));
                return json({ ...data, results: rank(data.jobs), unconfirmedDates: rank(data.unconfirmedDates), profileSavedAt: reviewedProfile.savedAt });
            }
            return json({ message: 'Recurso disponível somente no modo local. A análise por regras é gratuita.' }, 503);
        }
        catch (error: unknown) {
            return json({ message: error instanceof Error ? error.message : 'Operação indisponível.' }, 400);
        }
    };
}
