import { describe,it,expect } from 'vitest';
import { DEFAULT_WEIGHTS,type Job,type MatchAnalysis } from '@devjob/contracts';
import { DEFAULT_FILTERS,filterJobs,paginateJobs,type JobResult } from './filter-jobs';

function result(id:string,overrides:Partial<Job>={},score:number|null=null,coverage=0):JobResult{
  const job:Job={id,source:'remotive',sourceId:id,title:'React Developer',company:'Example',url:'https://remotive.com/remote-jobs/synthetic',description:'TypeScript interfaces',salary:null,candidateLocation:'São Paulo',modality:'remote',seniority:'mid',publishedAt:'2026-10-12T00:00:00Z',publicationRaw:'2026-10-12T00:00:00Z',eligibility:'eligible',recency:'recent',reasons:[],...overrides};
  const analysis:MatchAnalysis|null=score!==null||coverage>0?{engineVersion:'0.4.0',score,coverage,weights:DEFAULT_WEIGHTS,criteria:[],warnings:[]}:null;
  return{job,analysis};
}
describe('dashboard filters',()=>{
  it('matches all search terms across accented location, title and description',()=>{
    const items=[result('a'),result('b',{title:'Java Developer',description:'Java APIs',candidateLocation:'Rio de Janeiro'})];
    expect(filterJobs(items,{...DEFAULT_FILTERS,search:' REACT sao paulo TYPESCRIPT '}).map((item)=>item.job.id)).toEqual(['a']);
  });
  it('combines source, level, modality and eligibility without inventing unknowns',()=>{
    const items=[result('a'),result('b',{source:'greenhouse',seniority:'junior',modality:'hybrid',eligibility:'unconfirmed'})];
    expect(filterJobs(items,{...DEFAULT_FILTERS,source:'greenhouse',seniority:'junior',modality:'hybrid',eligibility:'unconfirmed'}).map((item)=>item.job.id)).toEqual(['b']);
    expect(filterJobs(items,{...DEFAULT_FILTERS,modality:'unknown'})).toEqual([]);
  });
  it('preserves unknown fields when explicitly filtering for them',()=>{
    expect(filterJobs([result('unknown',{modality:'unknown',seniority:'unknown',eligibility:'unconfirmed'})],{...DEFAULT_FILTERS,modality:'unknown',seniority:'unknown',eligibility:'unconfirmed'})).toHaveLength(1);
  });
  it('keeps zero score distinct from unscored and excludes unscored with a positive threshold',()=>{
    const items=[result('unknown'),result('zero',{},0,100),result('high',{},80,90)];
    expect(filterJobs(items,DEFAULT_FILTERS)).toHaveLength(3);
    expect(filterJobs(items,{...DEFAULT_FILTERS,scoreState:'scored'})).toHaveLength(2);
    expect(filterJobs(items,{...DEFAULT_FILTERS,minScore:80}).map((item)=>item.job.id)).toEqual(['high']);
    expect(filterJobs(items,{...DEFAULT_FILTERS,scoreState:'unscored'}).map((item)=>item.job.id)).toEqual(['unknown']);
  });
  it('requires measured coverage when the minimum is positive',()=>{
    const items=[result('unknown'),result('low',{},90,35),result('covered',{},50,80)];
    expect(filterJobs(items,{...DEFAULT_FILTERS,minCoverage:80}).map((item)=>item.job.id)).toEqual(['covered']);
  });
  it('sorts scores descending, breaks ties by coverage, and puts missing score last',()=>{
    const items=[result('none'),result('less-covered',{},80,50),result('covered',{},80,90),result('lower',{},60,100)];
    expect(filterJobs(items,{...DEFAULT_FILTERS,sort:'score'}).map((item)=>item.job.id)).toEqual(['covered','less-covered','lower','none']);
  });
  it('keeps input arrays and recency labels unchanged',()=>{
    const items=[result('z',{recency:'unknown'}),result('a')];const copy=structuredClone(items);
    filterJobs(items,{...DEFAULT_FILTERS,sort:'company'});expect(items).toEqual(copy);expect(items[0]?.job.recency).toBe('unknown');
  });
  it('sorts source publication dates and companies independently',()=>{
    const items=[result('older',{publicationRaw:'2026-10-10T00:00:00Z',company:'Zulu'}),result('newer',{company:'Alpha'})];
    expect(filterJobs(items,DEFAULT_FILTERS)[0]?.job.id).toBe('newer');expect(filterJobs(items,{...DEFAULT_FILTERS,sort:'company'})[0]?.job.company).toBe('Alpha');
  });
  it('paginates without losing or repeating items and clamps obsolete pages after filtering',()=>{
    const items=Array.from({length:23},(_,index)=>result(String(index)));
    expect(paginateJobs(items,1).items).toHaveLength(10);expect(paginateJobs(items,2).items[0]?.job.id).toBe('10');expect(paginateJobs(items,3).items).toHaveLength(3);
    expect(paginateJobs(items.slice(0,3),99).page).toBe(1);expect(paginateJobs([],5)).toEqual({items:[],page:1,pages:1});
  });
});
