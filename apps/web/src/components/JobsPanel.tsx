import { useEffect, useRef, useState } from 'react';
import { DEFAULT_WEIGHTS, jobsResponseSchema, matchesResponseSchema, weightsSchema, type Criterion, type Job, type JobsResponse, type MatchAnalysis, type MatchesResponse, type MatchWeights } from '@devjob/contracts';
import styles from './JobsPanel.module.css';
import { AiJobAnalysis } from './AiJobAnalysis';

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
  const [data,setData] = useState<JobsResponse|null>(null);
  const [busy,setBusy] = useState<boolean>(false);
  const [error,setError] = useState<string>('');
  const [matches,setMatches]=useState<MatchesResponse|null>(null);
  const [weights,setWeights]=useState<MatchWeights>({...DEFAULT_WEIGHTS});
  const matchGeneration=useRef<number>(0);
  useEffect(()=>{matchGeneration.current++;setMatches(null);},[profileRevision]);
  useEffect(()=> {
    const controller = new AbortController();
    fetch('/api/jobs',{signal:controller.signal}).then(async(response)=>{if(!response.ok)throw new Error(); const body:unknown=await response.json();return jobsResponseSchema.parse(body);})
      .then((result)=>{if(!controller.signal.aborted)setData(result);})
      .catch(()=>{if(!controller.signal.aborted)setError('Não foi possível carregar as vagas. Verifique a API.');});
    return ()=>controller.abort();
  },[]);
  async function refresh():Promise<void> {
    setBusy(true);setError('');setMatches(null);
    try {
      const response = await fetch('/api/jobs/refresh',{method:'POST'});
      if(!response.ok) throw new Error();
      const body:unknown = await response.json(); setData(jobsResponseSchema.parse(body));
    } catch {setError('Não foi possível consultar as fontes. Tente novamente; a janela de atualização é preservada após falhas.');}
    finally {setBusy(false);}
  }
  async function calculate():Promise<void> {
    if(!weightsSchema.safeParse(weights).success){setError('Os pesos devem ser inteiros entre 0 e 100 e somar 100.');return;}
    setBusy(true);setError('');setMatches(null);
    const generation=++matchGeneration.current;
    try {
      const response=await fetch('/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({weights})});
      const body:unknown=await response.json();
      if(!response.ok)throw new Error(response.status===409?'Salve um perfil revisado antes de calcular compatibilidade.':'Não foi possível calcular a compatibilidade.');
      const result=matchesResponseSchema.parse(body);
      if(generation===matchGeneration.current)setMatches(result);
    }catch(cause:unknown){if(generation===matchGeneration.current)setError(cause instanceof Error?cause.message:'Falha no cálculo.');}
    finally{setBusy(false);}
  }
  return <section className={styles.panel} aria-labelledby="jobs-title">
    <h2 id="jobs-title">Vagas das fontes públicas</h2>
    <p>Front-end, React, TypeScript e JavaScript. Prioridade para júnior e pleno; vagas sem senioridade ficam sinalizadas.</p>
    <button disabled={busy} onClick={()=>void refresh()}>{busy?'Consultando fontes…':'Consultar fontes'}</button>
    <form onSubmit={(event)=>{event.preventDefault();void calculate();}}>
      <details><summary>Configurar pesos da compatibilidade</summary><fieldset disabled={busy}><legend>Pesos (soma obrigatória: 100%)</legend>
        {(Object.keys(weights) as Criterion[]).map((key)=><label className={styles.weight} key={key}>{criteriaLabels[key]}<input type="number" min={0} max={100} step={1} value={weights[key]} onChange={(event)=>{setWeights((current)=>({...current,[key]:Number(event.target.value)}));setMatches(null);}}/></label>)}
        <p>Soma: {Object.values(weights).reduce((sum,weight)=>sum+weight,0)}%</p>
        <button type="button" onClick={()=>{setWeights({...DEFAULT_WEIGHTS});setMatches(null);}}>Restaurar pesos</button>
      </fieldset></details>
      <button disabled={busy} type="submit">Calcular compatibilidade com perfil salvo</button>
    </form>
    {matches&&<p role="status">Resultados ordenados por compatibilidade. Perfil revisado salvo em {new Date(matches.profileSavedAt).toLocaleString('pt-BR')}. Alterações no perfil exigem novo cálculo.</p>}
    <p role="status" aria-live="polite">{busy?'Consultando as fontes configuradas…':data?`${data.jobs.length} vagas com recência confirmada · ${data.unconfirmedDates.length} com data incerta.`:'Nenhuma consulta carregada.'}</p>
    {error&&<p role="alert" className={styles.warning}>{error}</p>}
    {data&&<>
      <p>Última coleta bem-sucedida: {data.collectedAt?new Date(data.collectedAt).toLocaleString('pt-BR'):'ainda não realizada'}.</p>
      {data.nextRefreshAt&&<p>Nova consulta externa disponível a partir de {new Date(data.nextRefreshAt).toLocaleString('pt-BR')}. Antes disso, o botão utiliza o cache.</p>}
      <ul>{data.sources.map((source)=><li key={source.name}><strong>{source.name} ({source.status==='ok'?'consultada':source.status==='error'?'falha':'não consultada'}):</strong> {source.message}</li>)}</ul>
      <h3>Publicadas nos últimos sete dias</h3>
      {data.jobs.length===0&&<p>Nenhuma vaga confirmada para os critérios atuais. Isso não significa ausência de oportunidades em outras fontes.</p>}
      <div className={styles.list}>{matches?matches.results.map((result)=><JobCard key={result.job.id} job={result.job} analysis={result.analysis}/>):data.jobs.map((job)=><JobCard key={job.id} job={job}/>)}</div>
      <details><summary>Data ou recência não confirmada ({matches?.unconfirmedDates.length??data.unconfirmedDates.length})</summary><p>Estas vagas não estão comprovadas como publicadas nos últimos sete dias.</p><div className={styles.list}>{matches?matches.unconfirmedDates.map((result)=><JobCard key={result.job.id} job={result.job} analysis={result.analysis}/>):data.unconfirmedDates.map((job)=><JobCard key={job.id} job={job}/>)}</div></details>
      <p>{data.discarded} descartadas por data, senioridade ou localização · {data.duplicates} duplicatas removidas.</p>
    </>}
    <p>Remotive disponibiliza anúncios com atraso de 24 horas. Nenhuma fonte cobre toda a internet; elegibilidade deve ser conferida na publicação original.</p>
  </section>;
}
