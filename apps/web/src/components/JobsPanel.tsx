import { useEffect, useState } from 'react';
import { jobsResponseSchema, type Job, type JobsResponse } from '@devjob/contracts';
import styles from './JobsPanel.module.css';

const mode:Record<Job['modality'],string> = {remote:'Remoto',hybrid:'Híbrido',onsite:'Presencial',unknown:'Modalidade não informada'};
const levels:Record<Job['seniority'],string> = {junior:'Júnior',mid:'Pleno',senior:'Sênior',unknown:'Senioridade não informada'};
function JobCard({job}:{job:Job}):React.JSX.Element {
  return <article className={styles.card}>
    <p className={styles.source}>{job.source === 'remotive' ? 'Fonte: Remotive' : 'Fonte: Greenhouse'}</p>
    <h3><a href={job.url} target="_blank" rel="noopener noreferrer">{job.title}</a></h3>
    <p>{job.company} · {levels[job.seniority]}</p>
    <p>{mode[job.modality]} · {job.candidateLocation ?? 'Localização não informada'}</p>
    <p>Salário: {job.salary ?? 'não informado'}</p>
    <p>Publicação na fonte: {job.publicationRaw ?? 'desconhecida'}{job.recency === 'unknown' ? ' · recência não confirmada' : ''}</p>
    {job.eligibility === 'unconfirmed' && <p className={styles.warning}>Localização ou elegibilidade pendente de confirmação.</p>}
    <details><summary>Ver descrição e observações</summary><p>{job.description || 'Descrição não informada.'}</p><ul>{job.reasons.map((reason)=><li key={reason}>{reason}</li>)}</ul></details>
  </article>;
}
export function JobsPanel():React.JSX.Element {
  const [data,setData] = useState<JobsResponse|null>(null);
  const [busy,setBusy] = useState<boolean>(false);
  const [error,setError] = useState<string>('');
  useEffect(()=> {
    const controller = new AbortController();
    fetch('/api/jobs',{signal:controller.signal}).then(async(response)=>{if(!response.ok)throw new Error(); const body:unknown=await response.json();return jobsResponseSchema.parse(body);})
      .then((result)=>{if(!controller.signal.aborted)setData(result);})
      .catch(()=>{if(!controller.signal.aborted)setError('Não foi possível carregar as vagas. Verifique a API.');});
    return ()=>controller.abort();
  },[]);
  async function refresh():Promise<void> {
    setBusy(true);setError('');
    try {
      const response = await fetch('/api/jobs/refresh',{method:'POST'});
      if(!response.ok) throw new Error();
      const body:unknown = await response.json(); setData(jobsResponseSchema.parse(body));
    } catch {setError('Não foi possível consultar as fontes. Tente novamente; a janela de atualização é preservada após falhas.');}
    finally {setBusy(false);}
  }
  return <section className={styles.panel} aria-labelledby="jobs-title">
    <h2 id="jobs-title">Vagas das fontes públicas</h2>
    <p>Front-end, React, TypeScript e JavaScript. Prioridade para júnior e pleno; vagas sem senioridade ficam sinalizadas. Ainda sem cálculo de compatibilidade.</p>
    <button disabled={busy} onClick={()=>void refresh()}>{busy?'Consultando fontes…':'Consultar fontes'}</button>
    <p role="status" aria-live="polite">{busy?'Consultando as fontes configuradas…':data?`${data.jobs.length} vagas com recência confirmada · ${data.unconfirmedDates.length} com data incerta.`:'Nenhuma consulta carregada.'}</p>
    {error&&<p role="alert" className={styles.warning}>{error}</p>}
    {data&&<>
      <p>Última coleta bem-sucedida: {data.collectedAt?new Date(data.collectedAt).toLocaleString('pt-BR'):'ainda não realizada'}.</p>
      {data.nextRefreshAt&&<p>Nova consulta externa disponível a partir de {new Date(data.nextRefreshAt).toLocaleString('pt-BR')}. Antes disso, o botão utiliza o cache.</p>}
      <ul>{data.sources.map((source)=><li key={source.name}><strong>{source.name} ({source.status==='ok'?'consultada':source.status==='error'?'falha':'não consultada'}):</strong> {source.message}</li>)}</ul>
      <h3>Publicadas nos últimos sete dias</h3>
      {data.jobs.length===0&&<p>Nenhuma vaga confirmada para os critérios atuais. Isso não significa ausência de oportunidades em outras fontes.</p>}
      <div className={styles.list}>{data.jobs.map((job)=><JobCard key={job.id} job={job}/>)}</div>
      <details><summary>Data ou recência não confirmada ({data.unconfirmedDates.length})</summary><p>Estas vagas não estão comprovadas como publicadas nos últimos sete dias.</p><div className={styles.list}>{data.unconfirmedDates.map((job)=><JobCard key={job.id} job={job}/>)}</div></details>
      <p>{data.discarded} descartadas por data, senioridade ou localização · {data.duplicates} duplicatas removidas.</p>
    </>}
    <p>Remotive disponibiliza anúncios com atraso de 24 horas. Nenhuma fonte cobre toda a internet; elegibilidade deve ser conferida na publicação original.</p>
  </section>;
}
