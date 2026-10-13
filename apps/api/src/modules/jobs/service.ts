import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { jobSchema, jobsResponseSchema, type JobsResponse } from '../../../../../packages/contracts/src/index.js';
import { classify, deduplicate } from './rules.js';
import { collectGreenhouse, collectRemotive, fetchJson, type FetchJson } from './providers.js';
import type { JobRun } from '../../../../../packages/contracts/src/index.js';
import { snapshotChanges } from './run-history.js';

const SIX_HOURS = 6 * 60 * 60 * 1000;
const snapshotSchema = z.object({
  nextRefreshAt:z.iso.datetime(),collectedAt:z.iso.datetime().nullable(),
  jobs:z.array(jobSchema), sources:jobsResponseSchema.shape.sources,
});
type Snapshot = z.infer<typeof snapshotSchema>;
export interface JobsCache { read(): Promise<Snapshot | null>; write(value: Snapshot): Promise<void> }
export class FileJobsCache implements JobsCache {
  constructor(private readonly path: string) {}
  async read(): Promise<Snapshot | null> {
    try { return snapshotSchema.parse(JSON.parse(await readFile(this.path,'utf8')) as unknown); }
    catch (error:unknown) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; }
  }
  async write(value:Snapshot): Promise<void> {
    await mkdir(dirname(this.path),{recursive:true});
    await writeFile(`${this.path}.tmp`,JSON.stringify(value));
    await rename(`${this.path}.tmp`,this.path);
  }
}
export class JobsService {
  private running: Promise<Snapshot> | null = null;
  isCollecting():boolean{return this.running!==null;}
  constructor(private readonly cache:JobsCache,private readonly boards:string[], private readonly fetcher:FetchJson = fetchJson, private readonly clock:()=>Date = () => new Date(),private readonly report?:(run:JobRun)=>Promise<void>) {}
  async get(refresh=false,trigger:JobRun['trigger']='manual'):Promise<JobsResponse> {
    let snapshot = await this.cache.read();
    if (refresh && this.running) {
      snapshot = await this.running;
    } else if (refresh && (!snapshot || Date.parse(snapshot.nextRefreshAt) <= this.clock().getTime())) {
      if (!this.running) this.running = this.collect(snapshot,trigger).finally(() => { this.running = null; });
      snapshot = await this.running;
    }
    const now = this.clock();
    const filtered = (snapshot?.jobs ?? []).map((job) => classify(job,now));
    const usable = filtered.filter((job) => job.eligibility !== 'excluded' && job.recency !== 'excluded' && job.seniority !== 'senior');
    const unique = deduplicate(usable);
    const sort = (a: typeof usable[number],b: typeof usable[number]):number => (b.publicationRaw ?? '').localeCompare(a.publicationRaw ?? '');
    return jobsResponseSchema.parse({ excludedJobs:deduplicate(filtered.filter(job=>job.eligibility==='excluded'||job.recency==='excluded'||job.seniority==='senior')).jobs.sort(sort), jobs:unique.jobs.filter((job)=>job.recency==='recent').sort(sort), unconfirmedDates:unique.jobs.filter((job)=>job.recency==='unknown').sort(sort), collectedAt:snapshot?.collectedAt??null,nextRefreshAt:snapshot?.nextRefreshAt??null,sources:snapshot?.sources??[{name:'Remotive',status:'disabled',message:'Clique em consultar fontes para iniciar.'},{name:'Greenhouse',status:'disabled',message:this.boards.length ? 'Quadros configurados, ainda não consultados.' : 'Nenhum quadro de empresa configurado.'}],discarded:filtered.length-usable.length,duplicates:unique.duplicates });
  }
  private async collect(previous:Snapshot|null,trigger:JobRun['trigger']):Promise<Snapshot> {
    const attempt = this.clock();
    // Persist cooldown before network access, including failures and restarts.
    const result:Snapshot = {collectedAt:previous?.collectedAt??null,nextRefreshAt:new Date(attempt.getTime()+SIX_HOURS).toISOString(),jobs:[],sources:[]};
    await this.cache.write({...result,jobs:previous?.jobs??[],sources:[{name:'Consulta',status:'error',message:'Consulta iniciada; se interrompida, aguarde a próxima janela.'}]});
    const run:JobRun={id:randomUUID(),trigger,startedAt:attempt.toISOString(),finishedAt:null,status:'running',added:0,updated:0,removed:0,unchanged:0,message:null};
    try{
    await this.report?.(run);
    try {
      result.jobs.push(...await collectRemotive(this.fetcher));
      result.sources.push({name:'Remotive',status:'ok',message:'Software development; atraso de 24 horas. Fonte: Remotive.'});
    } catch {
      result.sources.push({name:'Remotive',status:'error',message:'Falha ao consultar ou validar a resposta. Dados anteriores preservados quando disponíveis.'});
      result.jobs.push(...(previous?.jobs.filter((job)=>job.source==='remotive')??[]));
    }
    if (!this.boards.length) result.sources.push({name:'Greenhouse',status:'disabled',message:'Configure GREENHOUSE_BOARDS para consultar empresas.'});
    for (const board of this.boards) {
      try {
        result.jobs.push(...await collectGreenhouse(board,this.fetcher));
        result.sources.push({name:`Greenhouse (${board})`,status:'ok',message:'Até 30 vagas relevantes por quadro; detalhes sem publicação ficam com data desconhecida. Nome da empresa pode ser o identificador do quadro.'});
      } catch {
        result.sources.push({name:`Greenhouse (${board})`,status:'error',message:'Falha ao consultar o quadro. Dados anteriores preservados quando disponíveis.'});
        result.jobs.push(...(previous?.jobs.filter((job)=>job.source==='greenhouse'&&job.sourceId.startsWith(`${board}:`))??[]));
      }
    }
    result.collectedAt = result.sources.some((source)=>source.status==='ok') ? this.clock().toISOString() : previous?.collectedAt??null;
    await this.cache.write(result);
    const failed=result.sources.filter((source)=>source.status==='error').length;
    const succeeded=result.sources.some((source)=>source.status==='ok');
    await this.report?.({...run,finishedAt:this.clock().toISOString(),status:failed?(succeeded?'partial':'failed'):'success',...snapshotChanges(previous?.jobs??[],result.jobs),message:failed?'Uma ou mais fontes falharam. Dados anteriores preservados quando disponíveis.':null});
    return result;
    }catch(error:unknown){await this.report?.({...run,finishedAt:this.clock().toISOString(),status:'failed',message:'Falha de coleta ou persistência; a janela de consulta foi preservada.'});throw error;}
  }
}
