import { useEffect, useState } from 'react';
import { jobsResponseSchema, savedProfileSchema, type Job, type MatchAnalysis } from '@devjob/contracts';
import { apiFetch, PUBLIC_MODE } from '../services/api';
import { analyzeMatch } from '../../../api/src/modules/matching/engine';
import { PortalSearchPanel } from './PortalSearchPanel';
import { toCsv } from '../features/jobs/csv';
import styles from './JobsPanel.module.css';
type Row = {
    id: string;
    title: string;
    company: string;
    location: string;
    date: string;
    url: string;
    note: string;
    analysis: MatchAnalysis | null;
};
export function JobsTable({ profileRevision }: {
    profileRevision: number;
}): React.JSX.Element {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [analyses, setAnalyses] = useState<Record<string, MatchAnalysis>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [broad, setBroad] = useState(false);
    const [reactOnly, setReactOnly] = useState(true);
    useEffect(() => { setAnalyses({}); }, [profileRevision]);
    useEffect(() => { const controller = new AbortController(); apiFetch('/api/jobs', { signal: controller.signal }).then(async (response) => { if (!response.ok)
        throw new Error('Não foi possível carregar vagas.'); const data = jobsResponseSchema.parse(await response.json()); if (!controller.signal.aborted)
        setJobs([...data.jobs, ...data.unconfirmedDates, ...data.excludedJobs]); }).catch(cause => { if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Falha ao carregar.'); }); return () => controller.abort(); }, []);
    async function refresh(): Promise<void> { setBusy(true); setError(''); try {
        const response = await apiFetch('/api/jobs/refresh', { method: 'POST' });
        if (!response.ok)
            throw new Error('Falha ao atualizar vagas.');
        const data = jobsResponseSchema.parse(await response.json());
        setJobs([...data.jobs, ...data.unconfirmedDates, ...data.excludedJobs]);
        setAnalyses({});
    }
    catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'Falha ao atualizar.');
    }
    finally {
        setBusy(false);
    } }
    async function fit(): Promise<void> { setBusy(true); setError(''); try {
        const response = await apiFetch('/api/profile');
        if (!response.ok)
            throw new Error('Não foi possível ler seu perfil.');
        const body = await response.json() as {
            saved: unknown;
        };
        const saved = savedProfileSchema.safeParse(body.saved);
        if (!saved.success)
            throw new Error('Abra Meu currículo abaixo e salve seu perfil revisado primeiro.');
        setAnalyses(Object.fromEntries(jobs.map(job => [job.id, analyzeMatch(job, saved.data.profile)])));
    }
    catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'Falha ao calcular.');
    }
    finally {
        setBusy(false);
    } }
    useEffect(() => { const controller = new AbortController(); setAnalyses({}); apiFetch('/api/profile', { signal: controller.signal }).then(async (response) => { if (!response.ok)
        return; const body = await response.json() as {
        saved: unknown;
    }; const saved = savedProfileSchema.safeParse(body.saved); if (saved.success && !controller.signal.aborted)
        setAnalyses(Object.fromEntries(jobs.map(job => [job.id, analyzeMatch(job, saved.data.profile)]))); }).catch(() => { }); return () => controller.abort(); }, [jobs, profileRevision]);
    const automatic: Row[] = jobs.filter(job => !(/\b(mobile|ios|android|react native)\b/i.test(job.title)) && (!reactOnly || /\breact(?:\.js|js)?\b(?!\s+native)/i.test(job.title + ' ' + job.description)) && (broad || (job.eligibility !== 'excluded' && job.seniority !== 'senior' && (!job.publishedAt || (Date.parse(job.publishedAt) >= Date.now() - 30 * 86400000 && Date.parse(job.publishedAt) <= Date.now()))))).map(job => ({ id: job.id, title: job.title, company: job.company, location: job.candidateLocation ?? 'Não informada', date: job.publicationRaw ?? 'Não confirmada', url: job.url, note: [job.recency === 'excluded' ? 'Anterior aos últimos 7 dias ou data futura' : '', job.checkedAt ? `Publicada na Gupy, verificada em ${new Date(job.checkedAt).toLocaleString('pt-BR')}` : 'Disponibilidade atual não verificada', job.seniority === 'senior' ? 'Sênior' : '', job.eligibility === 'excluded' ? 'Localização incompatível' : '', ...job.reasons].filter(Boolean).join(' · '), analysis: analyses[job.id] ?? null }));
    const rows = automatic.filter(row => `${row.title} ${row.company} ${row.location} ${row.note}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).sort((a, b) => (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1));
    function exportCsv(): void { const contents = toCsv([['Vaga', 'Empresa / fonte', 'Local', 'Publicação', 'Fit (%)', 'Cobertura (%)', 'Observações', 'Link para candidatura'], ...rows.map(row => [row.title, row.company, row.location, row.date, row.analysis?.score === null || !row.analysis ? '' : String(row.analysis.score), row.analysis ? String(row.analysis.coverage) : '', row.note, row.url])]); const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'vagas-devjob.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return <section id="vagas" className={styles.panel}><h1>Minhas vagas</h1><p>Veja as oportunidades, confira o fit e abra a candidatura.</p>
    <button disabled={busy} onClick={() => void refresh()}>{PUBLIC_MODE ? 'Atualizar lista' : 'Buscar / atualizar'}</button><button disabled={busy} onClick={() => void fit()}>Calcular fit com meu currículo</button><button disabled={!rows.length} onClick={exportCsv}>Baixar planilha CSV</button>
    <p><label>Pesquisar na tabela <input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label> <label><input type="checkbox" checked={broad} onChange={event => setBroad(event.target.checked)}/> Incluir anúncios fora dos critérios</label> <label><input type="checkbox" checked={reactOnly} onChange={event => setReactOnly(event.target.checked)}/> Priorizar React</label></p>
    <p role="status">{busy ? 'Carregando…' : `${rows.length} vagas com descrição completa. Busca padrão: React, até 30 dias, sem sênior ou localização incompatível.`}</p>{error && <p role="alert">{error}</p>}
    <div style={{ overflowX: 'auto' }}><table className={styles.table}><caption>Oportunidades para conferir e se candidatar</caption><thead><tr><th>Vaga / empresa</th><th>Local / data</th><th>Fit</th><th>Candidatura</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.title}</strong><br />{row.company}<details><summary>Observações</summary><p>{row.note}</p></details></td><td>{row.location}<br /><small>{row.date}</small></td><td>{row.analysis ? row.analysis.score === null ? 'Sem evidência suficiente' : `${row.analysis.score}%` : 'Salve seu currículo para calcular'}{row.analysis && <>{row.analysis.coverage < 50 && <small style={{ display: 'block' }}>Fit preliminar: faltam evidências</small>}<small style={{ display: 'block' }}>Cobertura: {row.analysis.coverage}%</small><details><summary>Entender fit</summary><ul>{row.analysis.criteria.flatMap(criterion => criterion.items).filter(item => item.jobEvidence !== null).map((item, index) => <li key={index}>{item.requirement}: {item.status === 'met' ? 'atendido' : item.status === 'partial' ? 'parcial' : item.status === 'not_met' ? 'não atendido' : 'não comprovado'}<p>{item.explanation}</p></li>)}</ul></details></>}</td><td><a href={row.url} target="_blank" rel="noreferrer">Abrir vaga ↗</a></td></tr>)}</tbody></table></div>
    <p><small>Fit é uma estimativa por evidências, não chance de contratação. Data desconhecida não significa vaga recente. A verificação de disponibilidade Gupy tem cache de seis horas. Atualizar respeita o cache das fontes.</small></p>
    <details><summary>Buscar em outros sites / comparar uma descrição</summary><PortalSearchPanel /></details>
  </section>;
}
