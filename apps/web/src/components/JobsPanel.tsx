import { apiFetch, PUBLIC_MODE } from '../services/api';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_WEIGHTS, jobsResponseSchema, matchesResponseSchema, weightsSchema, type Criterion, type Job, type JobsResponse, type MatchAnalysis, type MatchesResponse, type MatchWeights } from '@devjob/contracts';
import styles from './JobsPanel.module.css';
import { AiJobAnalysis } from './AiJobAnalysis';
import { JobFilters } from './JobFilters';
import { AutomationPanel } from './AutomationPanel';
import { DEFAULT_FILTERS,filterJobs,paginateJobs,type JobFilters as Filters,type JobResult } from '../features/jobs/filter-jobs';

const mode:Record<Job['modality'],string> = {remote:'Remoto',hybrid:'Híbrido',onsite:'Presencial',unknown:'Modalidade não informada'};
const levels:Record<Job['seniority'],string> = {junior:'Júnior',mid:'Pleno',senior:'Sênior',unknown:'Senioridade não informada'};
const criteriaLabels:Record<Criterion,string>={required:'Tecnologias obrigatórias',experience:'Experiência',seniority:'Senioridade',desired:'Tecnologias desejáveis',responsibilities:'Responsabilidades',language:'Idioma'};
const statusLabels={met:'Atendido',partial:'Parcialmente atendido',not_met:'Não atendido',insufficient:'Informação insuficiente'};
function JobCard({job,analysis}:{job:Job;analysis?:MatchAnalysis}):React.JSX.Element {
  return <article className={styles.card}>
    <p className={styles.source}>{job.source === 'remotive' ? 'Fonte: Remotive' : 'Fonte: Greenhouse'}</p>
    <h3><a href={job.url} target="_blank" rel="noopener noreferrer">{job.title}</a></h3>
    <p>{job.company} · {levels[job.seniority]}</p>
    <p>{mode[job.modality]} · {job.candidateLocation ?? 'Localização não informada'}</p>
    <p>Salário: {job.salary ?? 'não informado'}</p>
    <p>Publicação na fonte: {job.publicationRaw ?? 'desconhecida'}{job.recency === 'unknown' ? ' · recência não confirmada' : ''}</p>
    {job.eligibility === 'unconfirmed' && <p className={styles.warning}>Localização ou elegibilidade pendente de confirmação.</p>}
    {analysis&&<div className={styles.analysis}>
      <h4>{analysis.score===null?'Compatibilidade não calculável com as evidências atuais':`Compatibilidade estimada: ${analysis.score}%`}</h4>
      <p>Cobertura das evidências: {analysis.coverage}%. Estimativa técnica; confira elegibilidade separadamente.</p>
      <details><summary>Entender o resultado</summary>
        {analysis.criteria.map((criterion)=><section key={criterion.key}><h5>{criteriaLabels[criterion.key]} · peso {criterion.weight}% · {criterion.contribution} pontos</h5>
          <ul>{criterion.items.map((item,index)=><li key={`${item.requirement}-${index}`}><strong>{item.requirement}: {statusLabels[item.status]}</strong><p>{item.explanation}</p><p>Vaga: {item.jobEvidence??'não informado'}</p><p>Perfil revisado: {item.profileEvidence??'não comprovado'}</p></li>)}</ul>
        </section>)}
        {analysis.warnings.map((warning)=><p key={warning}>{warning}</p>)}
        <p>Motor {analysis.engineVersion}</p>
      </details>
    </div>}
    <details><summary>Ver descrição e observações</summary><p>{job.description || 'Descrição não informada.'}</p><ul>{job.reasons.map((reason)=><li key={reason}>{reason}</li>)}</ul></details>
    <AiJobAnalysis jobId={job.id}/>
  </article>;
}
export function JobsPanel({profileRevision}:{profileRevision:number}):React.JSX.Element {
  const [broadSearch,setBroadSearch]=useState<boolean>(false);
  const [data,setData] = useState<JobsResponse|null>(null);
  const [busy,setBusy] = useState<boolean>(true);
  const [operation,setOperation]=useState<string>('Carregando vagas salvas…');
  const [error,setError] = useState<string>('');
  const [matches,setMatches]=useState<MatchesResponse|null>(null);
  const [weights,setWeights]=useState<MatchWeights>({...DEFAULT_WEIGHTS});
  const matchGeneration=useRef<number>(0);
  const [filters,setFilters]=useState<Filters>({...DEFAULT_FILTERS});
  const [recentPage,setRecentPage]=useState<number>(1);
  const [unknownPage,setUnknownPage]=useState<number>(1);
  const invalidate=():void=>{setMatches(null);setFilters((current)=>({...current,minScore:0,minCoverage:0,scoreState:'all',sort:'recent'}));setRecentPage(1);setUnknownPage(1);};
  useEffect(()=>{matchGeneration.current++;setMatches(null);setFilters((current)=>({...current,minScore:0,minCoverage:0,scoreState:'all',sort:'recent'}));setRecentPage(1);setUnknownPage(1);},[profileRevision]);
  useEffect(()=> {
    const controller = new AbortController();
    apiFetch('/api/jobs',{signal:controller.signal}).then(async(response)=>{if(!response.ok)throw new Error(); const body:unknown=await response.json();return jobsResponseSchema.parse(body);})
      .then((result)=>{if(!controller.signal.aborted)setData(result);})
      .catch(()=>{if(!controller.signal.aborted)setError(PUBLIC_MODE?'Não foi possível carregar a publicação de vagas. Tente recarregar a lista.':'Não foi possível carregar as vagas. Verifique a API.');})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[]);
  async function refresh():Promise<void> {
    setBusy(true);setOperation(PUBLIC_MODE?'Carregando última publicação…':'Consultando fontes…');setError('');invalidate();
    try {
      const response = await apiFetch('/api/jobs/refresh',{method:'POST'});
      if(!response.ok) throw new Error();
      const body:unknown = await response.json(); setData(jobsResponseSchema.parse(body));
    } catch {setError('Não foi possível consultar as fontes. Tente novamente; a janela de atualização é preservada após falhas.');}
    finally {setBusy(false);}
  }
  async function reloadCache():Promise<void>{setBusy(true);setOperation('Carregando lista do cache…');setError('');invalidate();try{const response=await apiFetch('/api/jobs');if(!response.ok)throw new Error();const body:unknown=await response.json();setData(jobsResponseSchema.parse(body));}catch{setError('Não foi possível carregar a lista do cache.');}finally{setBusy(false);}}
  async function calculate():Promise<void> {
    if(!weightsSchema.safeParse(weights).success){setError('Os pesos devem ser inteiros entre 0 e 100 e somar 100.');return;}
    setBusy(true);setOperation('Calculando compatibilidade…');setError('');setMatches(null);
    const generation=++matchGeneration.current;
    try {
      const response=await apiFetch('/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({weights})});
      const body:unknown=await response.json();
      if(!response.ok)throw new Error(response.status===409?'Salve um perfil revisado antes de calcular compatibilidade.':'Não foi possível calcular a compatibilidade.');
      const result=matchesResponseSchema.parse(body);
      if(generation===matchGeneration.current){setMatches(result);setData({excludedJobs:data?.excludedJobs??[],jobs:result.results.map((entry)=>entry.job),unconfirmedDates:result.unconfirmedDates.map((entry)=>entry.job),sources:result.sources,collectedAt:result.collectedAt,nextRefreshAt:result.nextRefreshAt,discarded:result.discarded,duplicates:result.duplicates});setFilters((current)=>({...current,sort:'score'}));setRecentPage(1);setUnknownPage(1);}
    }catch(cause:unknown){if(generation===matchGeneration.current)setError(cause instanceof Error?cause.message:'Falha no cálculo.');}
    finally{setBusy(false);}
  }
  const recent:JobResult[]=matches?.results??data?.jobs.map((job)=>({job,analysis:null}))??[];
  const uncertain:JobResult[]=matches?.unconfirmedDates??data?.unconfirmedDates.map((job)=>({job,analysis:null}))??[];
  const visibleRecent=filterJobs(recent,filters),visibleUncertain=filterJobs(uncertain,filters);
  const recentSlice=paginateJobs(visibleRecent,recentPage),unknownSlice=paginateJobs(visibleUncertain,unknownPage);
  function changeFilters(value:Filters):void{setFilters(value);setRecentPage(1);setUnknownPage(1);}
  function renderResult(result:JobResult):React.JSX.Element{return <JobCard key={result.job.id} job={result.job} {...(result.analysis?{analysis:result.analysis}:{})}/>;}
  return <section id="vagas" className={styles.panel} aria-labelledby="jobs-title">
    <h2 id="jobs-title">Dashboard de oportunidades</h2>
    <p>Front-end, React, TypeScript e JavaScript. Prioridade para júnior e pleno; vagas sem senioridade ficam sinalizadas.</p>
    <div className={styles.metrics} aria-label="Resumo da lista carregada"><div><strong>{recent.length}</strong><span>Recentes confirmadas</span></div><div><strong>{uncertain.length}</strong><span>Datas incertas</span></div><div><strong>{[...recent,...uncertain].filter((result)=>result.job.eligibility==='unconfirmed').length}</strong><span>Elegibilidade pendente</span></div><div><strong>{[...recent,...uncertain].filter((result)=>result.analysis?.score!==null&&result.analysis!==null).length}</strong><span>Com score calculável</span></div></div>
    <button disabled={busy} onClick={()=>void refresh()}>{PUBLIC_MODE?'Carregar última publicação':'Consultar fontes'}</button>
    {!PUBLIC_MODE&&<button disabled={busy} onClick={()=>void reloadCache()}>Recarregar lista do cache</button>}
    <label><input type="checkbox" checked={broadSearch} onChange={event=>setBroadSearch(event.target.checked)}/> Busca aberta para teste: incluir vagas fora dos critérios</label>
    <AutomationPanel/>
    <form onSubmit={(event)=>{event.preventDefault();void calculate();}}>
      <details><summary>Configurar pesos da compatibilidade</summary><fieldset disabled={busy}><legend>Pesos (soma obrigatória: 100%)</legend>
        {(Object.keys(weights) as Criterion[]).map((key)=><label className={styles.weight} key={key}>{criteriaLabels[key]}<input type="number" min={0} max={100} step={1} value={weights[key]} onChange={(event)=>{setWeights((current)=>({...current,[key]:Number(event.target.value)}));invalidate();}}/></label>)}
        <p>Soma: {Object.values(weights).reduce((sum,weight)=>sum+weight,0)}%</p>
        <button type="button" onClick={()=>{setWeights({...DEFAULT_WEIGHTS});invalidate();}}>Restaurar pesos</button>
      </fieldset></details>
      <button disabled={busy} type="submit">Calcular compatibilidade com perfil salvo</button>
    </form>
    {matches&&<p>Compatibilidade calculada com perfil salvo em {new Date(matches.profileSavedAt).toLocaleString('pt-BR')}. Alterações no perfil exigem novo cálculo.</p>}
    <p role="status" aria-live="polite">{busy?operation:data?`${visibleRecent.length} recentes e ${visibleUncertain.length} com data incerta correspondem aos filtros.`:'Nenhuma consulta carregada.'}</p>
    {error&&<p role="alert" className={styles.warning}>{error}</p>}
    {data&&<>
      <p>Última coleta bem-sucedida: {data.collectedAt?new Date(data.collectedAt).toLocaleString('pt-BR'):'ainda não realizada'}.</p>
      {data.nextRefreshAt&&<p>{PUBLIC_MODE?'Próxima janela de coleta pública a partir de':'Nova consulta externa disponível a partir de'} {new Date(data.nextRefreshAt).toLocaleString('pt-BR')}. {PUBLIC_MODE?'O agendamento pode atrasar; o botão lê a última publicação.':'Antes disso, o botão utiliza o cache.'}</p>}
      <ul>{data.sources.map((source)=><li key={source.name}><strong>{source.name} ({source.status==='ok'?'consultada':source.status==='error'?'falha':'não consultada'}):</strong> {source.message}</li>)}</ul>
      {broadSearch&&<section aria-label="Vagas fora dos critérios"><h3>Busca aberta — {data.excludedJobs.length} vagas adicionais</h3><p>Dados reais da coleta, incluindo anúncios antigos, sêniores e localidades fora das regras. Não representam vagas recentes ou elegíveis para seu perfil. Este filtro apenas lê o cache e não antecipa consultas.</p>{data.excludedJobs.length===0&&<p>Nenhum anúncio adicional no cache.</p>}<div className={styles.list}>{data.excludedJobs.map(job=><div key={job.id}><p className={styles.warning}>Fora dos critérios: {job.recency==='excluded'?'publicação fora dos últimos sete dias ou futura. ':''}{job.seniority==='senior'?'senioridade sênior. ':''}{job.eligibility==='excluded'?'localização ou elegibilidade excluída.':''}</p><JobCard job={job}/></div>)}</div></section>}
      <JobFilters filters={filters} onChange={changeFilters} hasAnalysis={matches!==null}/>
      <h3>Publicadas nos últimos sete dias</h3>
      {visibleRecent.length===0&&<p>{recent.length?'Nenhuma vaga corresponde aos filtros. Limpe ou ajuste os filtros.':'Nenhuma vaga recente confirmada nas fontes carregadas. Isso não significa ausência de oportunidades em outras fontes.'}</p>}
      <div className={styles.list}>{recentSlice.items.map(renderResult)}</div>
      {recentSlice.pages>1&&<nav className={styles.pagination} aria-label="Paginação das vagas recentes"><button disabled={recentSlice.page===1} onClick={()=>setRecentPage(recentSlice.page-1)}>Anteriores</button><span>Página {recentSlice.page} de {recentSlice.pages}</span><button disabled={recentSlice.page===recentSlice.pages} onClick={()=>setRecentPage(recentSlice.page+1)}>Próximas</button></nav>}
      <details><summary>Data ou recência não confirmada ({visibleUncertain.length})</summary><p>Estas vagas não estão comprovadas como publicadas nos últimos sete dias.</p>{visibleUncertain.length===0&&<p>Nenhuma vaga com data incerta corresponde aos filtros.</p>}<div className={styles.list}>{unknownSlice.items.map(renderResult)}</div>
        {unknownSlice.pages>1&&<nav className={styles.pagination} aria-label="Paginação das vagas com data incerta"><button disabled={unknownSlice.page===1} onClick={()=>setUnknownPage(unknownSlice.page-1)}>Anteriores</button><span>Página {unknownSlice.page} de {unknownSlice.pages}</span><button disabled={unknownSlice.page===unknownSlice.pages} onClick={()=>setUnknownPage(unknownSlice.page+1)}>Próximas</button></nav>}
      </details>
      <p>{data.discarded} descartadas por data, senioridade ou localização · {data.duplicates} duplicatas removidas.</p>
    </>}
    <p>Remotive disponibiliza anúncios com atraso de 24 horas. Nenhuma fonte cobre toda a internet; elegibilidade deve ser conferida na publicação original.</p>
  </section>;
}
