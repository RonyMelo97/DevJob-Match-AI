import { describe,it,expect } from 'vitest';
import type { Job } from '../../../../../packages/contracts/src/index.js';
import { classify,deduplicate } from './rules.js';
import { collectGreenhouse,collectRemotive } from './providers.js';
import { JobsService, type JobsCache } from './service.js';

const now = new Date('2026-10-13T16:00:00Z');
function job(overrides:Partial<Job>={}):Job {
  return {id:'remotive:1',source:'remotive',sourceId:'1',title:'React Developer',company:'Example',url:'https://remotive.com/remote-jobs/example-1',description:'React interface',salary:null,candidateLocation:'Worldwide',modality:'remote',seniority:'mid',publishedAt:'2026-10-10T12:00:00Z',publicationRaw:'2026-10-10T12:00:00Z',eligibility:'unconfirmed',recency:'unknown',reasons:[],...overrides};
}
function memoryCache():JobsCache {
  let stored:Awaited<ReturnType<JobsCache['read']>>=null;
  return {read:async()=>stored,write:async(value)=>{stored=value;}};
}
describe('job rules and providers',()=> {
  it.each(['Worldwide','Brazil','Latin America'])('accepts remote eligibility %s',(candidateLocation)=>{expect(classify(job({candidateLocation}),now).eligibility).toBe('eligible');});
  it('excludes explicitly restricted remote jobs',()=>{expect(classify(job({candidateLocation:'United States'}),now).eligibility).toBe('excluded');});
  it('keeps missing remote eligibility unconfirmed',()=>{expect(classify(job({candidateLocation:null}),now).eligibility).toBe('unconfirmed');});
  it('rejects an explicit exception for Brazil even when remote worldwide',()=>{expect(classify(job({candidateLocation:'Worldwide except Brazil'}),now).eligibility).toBe('excluded');});
  it('accepts Sao Paulo city and rejects Campinas in Sao Paulo state',()=>{
    expect(classify(job({modality:'hybrid',candidateLocation:'São Paulo, SP, Brazil'}),now).eligibility).toBe('eligible');
    expect(classify(job({modality:'hybrid',candidateLocation:'Campinas, São Paulo'}),now).eligibility).toBe('excluded');
    expect(classify(job({modality:'onsite',candidateLocation:'Rio de Janeiro'}),now).eligibility).toBe('excluded');
    expect(classify(job({modality:'hybrid',candidateLocation:'Brazil, Sao Paulo'}),now).eligibility).toBe('eligible');
    expect(classify(job({modality:'hybrid',candidateLocation:'São Paulo, São Paulo, Brazil'}),now).eligibility).toBe('eligible');
    expect(classify(job({modality:'hybrid',candidateLocation:'São Paulo State'}),now).eligibility).toBe('unconfirmed');
  });
  it('does not infer modality from a Brazilian city',()=>{expect(classify(job({modality:'unknown',candidateLocation:'Rio de Janeiro'}),now).eligibility).toBe('unconfirmed');});
  it('enforces seven days, future dates and exact cutoff',()=>{
    expect(classify(job(),now).recency).toBe('recent');
    expect(classify(job({publishedAt:'2026-10-06T16:00:00Z'}),now).recency).toBe('recent');
    expect(classify(job({publishedAt:'2026-10-06T15:59:59Z'}),now).recency).toBe('excluded');
    expect(classify(job({publishedAt:'2026-10-14T00:00:00Z'}),now).recency).toBe('excluded');
  });
  it('keeps missing and ambiguous boundary dates unconfirmed',()=>{
    expect(classify(job({publishedAt:null,publicationRaw:null}),now).recency).toBe('unknown');
    expect(classify(job({publishedAt:null,publicationRaw:'2026-10-06T12:00:00'}),now).recency).toBe('unknown');
    expect(classify(job({publishedAt:null,publicationRaw:'2026-10-10T12:00:00'}),now).recency).toBe('recent');
    expect(classify(job({publishedAt:null,publicationRaw:'2026-10-10T99:00:00'}),now).recency).toBe('unknown');
  });
  it('deduplicates identifiers and URLs without merging same-title different openings',()=>{
    const result = deduplicate([job(),job({url:job().url+'?utm_source=test'}),job({id:'remotive:2',sourceId:'2',url:'https://remotive.com/remote-jobs/example-2'})]);
    expect(result.duplicates).toBe(1);expect(result.jobs).toHaveLength(2);
  });
  it('normalizes Remotive and skips invalid records and unrelated roles',async()=>{
    const jobs=await collectRemotive(async()=>({jobs:[{id:1,title:'React Developer',company_name:'Example',url:job().url,description:'<p>React</p>',candidate_required_location:'Worldwide',publication_date:'2026-10-10T12:00:00Z'}, {id:2,title:'Accountant',company_name:'Example',url:job().url,description:'Finance'}, {id:'bad'}]}));
    expect(jobs).toHaveLength(1);expect(jobs[0]?.description).toBe('React');
  });
  it('uses Greenhouse first_published, never updated_at, and preserves missing modality',async()=>{
    const jobs=await collectGreenhouse('example',async(url)=>url.endsWith('/1')?{company_name:'Example',first_published:'2026-10-01T00:00:00Z'}:{jobs:[{id:1,title:'Frontend Engineer',absolute_url:'https://boards.greenhouse.io/example/jobs/1',location:{name:'São Paulo'},content:'React',updated_at:'2026-10-13T00:00:00Z'}]});
    expect(jobs[0]?.publicationRaw).toBe('2026-10-01T00:00:00Z');expect(jobs[0]?.modality).toBe('unknown');
  });
  it('keeps listing if Greenhouse detail fails',async()=>{
    const jobs=await collectGreenhouse('example',async(url)=>{if(url.endsWith('/1'))throw new Error();return{jobs:[{id:1,title:'React Developer',absolute_url:'https://boards.greenhouse.io/example/jobs/1',location:{name:'Remote'},content:'React'}]};});
    expect(jobs[0]?.publicationRaw).toBeNull();expect(classify(jobs[0]!,now).recency).toBe('unknown');
  });
  it('persists cooldown across service instances and re-evaluates recency',async()=>{
    const cache=memoryCache();let calls=0;
    const fetcher=async()=>{calls++;return{jobs:[]};};
    const first=new JobsService(cache,[],fetcher,()=>now);
    await first.get(true); await new JobsService(cache,[],fetcher,()=>now).get(true);
    expect(calls).toBe(1);
    await new JobsService(cache,[],fetcher,()=>new Date(now.getTime()+6*60*60*1000)).get(true);
    expect(calls).toBe(2);
  });
  it('retains failure status and cooldown, never fabricates vacancies',async()=>{
    const service=new JobsService(memoryCache(),[],async()=>{throw new Error('failure');},()=>now);
    const result=await service.get(true);expect(result.jobs).toEqual([]);expect(result.collectedAt).toBeNull();expect(result.sources[0]?.status).toBe('error');expect(result.nextRefreshAt).not.toBeNull();
  });
  it('removes cached postings from recent results as time advances without another network call',async()=>{
    let instant=now; let calls=0;
    const service=new JobsService(memoryCache(),[],async()=>{calls++;return{jobs:[{id:1,title:'React Developer',company_name:'Example',url:job().url,description:'React',publication_date:'2026-10-10T12:00:00Z',candidate_required_location:'Worldwide'}]};},()=>instant);
    expect((await service.get(true)).jobs).toHaveLength(1);
    instant=new Date('2026-10-20T12:00:00Z');
    expect((await service.get()).jobs).toHaveLength(0);expect(calls).toBe(1);
  });
  it('reuses one in-flight collection for concurrent refreshes',async()=>{
    let resolveFetch:((value:unknown)=>void)|undefined;let calls=0;
    const fetcher=async():Promise<unknown>=>{calls++;return new Promise((resolve)=>{resolveFetch=resolve;});};
    const service=new JobsService(memoryCache(),[],fetcher,()=>now);
    const first=service.get(true);const second=service.get(true);
    await new Promise<void>((resolve)=>setTimeout(resolve,0));
    resolveFetch?.({jobs:[]});
    const results=await Promise.all([first,second]);expect(calls).toBe(1);expect(results[0]).toEqual(results[1]);
  });
});
