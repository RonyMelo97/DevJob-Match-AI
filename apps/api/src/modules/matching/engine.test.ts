import { describe,expect,it } from 'vitest';
import { DEFAULT_WEIGHTS, matchesResponseSchema, type Job, type ResumeProfile } from '../../../../../packages/contracts/src/index.js';
import { analyzeMatch } from './engine.js';
import { buildApp } from '../../app.js';
import { parseEnv } from '../../config/env.js';
import { JobsService } from '../jobs/service.js';
import type { ProfileRepository } from '../resumes/repository.js';

function profile(overrides:Partial<ResumeProfile>={}):ResumeProfile {
  return {objective:'Desenvolvedor Front-end pleno',summary:'',skills:['React','TypeScript','Jest'],experience:'5 anos de experiência com React. Desenvolvimento de interfaces responsivas. Performance.',education:'',languages:'Inglês fluente',...overrides};
}
function job(overrides:Partial<Job>={}):Job {
  return {id:'remotive:1',source:'remotive',sourceId:'1',title:'React Developer Pleno',company:'Synthetic Company',url:'https://remotive.com/remote-jobs/synthetic',description:'Requisitos: React; TypeScript; 3 anos de experiência com React; Inglês fluente. Desejáveis: Jest. Responsabilidades: Interfaces responsivas; Performance.',salary:null,candidateLocation:'Worldwide',modality:'remote',seniority:'mid',publishedAt:'2026-10-12T00:00:00Z',publicationRaw:'2026-10-12T00:00:00Z',eligibility:'eligible',recency:'recent',reasons:[],...overrides};
}
describe('explainable matching engine',()=> {
  it('awards 100 only when all six criteria have supporting evidence',()=>{
    const result=analyzeMatch(job(),profile());expect(result.score).toBe(100);expect(result.coverage).toBe(100);
    expect(result.criteria.every((criterion)=>criterion.items.every((item)=>item.status==='met'))).toBe(true);
  });
  it('does not infer experience with React from years spent with HTML',()=>{
    const result=analyzeMatch(job(),profile({experience:'5 anos de experiência com HTML. Interfaces responsivas. Performance.'}));
    expect(result.criteria.find((criterion)=>criterion.key==='experience')?.items[0]?.status).toBe('insufficient');
    expect(result.score).toBe(80);expect(result.coverage).toBe(80);
  });
  it('awards half points for explicitly partial years of experience',()=>{
    const result=analyzeMatch(job(),profile({experience:'1 ano de experiência com React. Interfaces responsivas. Performance.'}));
    expect(result.criteria.find((criterion)=>criterion.key==='experience')?.items[0]?.status).toBe('partial');
    const partial=analyzeMatch(job(),profile({experience:'2 anos de experiência com React. Interfaces responsivas. Performance.'}));
    expect(partial.score).toBe(90);expect(partial.coverage).toBe(100);
    const none=analyzeMatch(job(),profile({experience:'0 anos de experiência com React. Interfaces responsivas. Performance.'}));
    expect(none.criteria.find((criterion)=>criterion.key==='experience')?.items[0]?.status).toBe('not_met');expect(none.score).toBe(80);
  });
  it('treats missing technology as insufficient rather than proof of ignorance',()=>{
    const result=analyzeMatch(job({description:'Requirements: Next.js.'}),profile());
    const item=result.criteria.find((criterion)=>criterion.key==='required')?.items[0];
    expect(item?.status).toBe('insufficient');expect(item?.profileEvidence).toBeNull();
  });
  it('distinguishes learning and explicit denial from absent evidence',()=>{
    const required=job({description:'Requisitos: React.',seniority:'unknown'});
    expect(analyzeMatch(required,profile({objective:'',skills:[],summary:'Estou aprendendo React.',experience:''})).criteria[0]?.items[0]?.status).toBe('partial');
    expect(analyzeMatch(required,profile({objective:'',skills:[],summary:'Não conheço React.',experience:''})).criteria[0]?.items[0]?.status).toBe('not_met');
  });
  it('does not mark another skill as denied when the same sentence denies only Jest',()=>{
    const result=analyzeMatch(job({description:'Requisitos: React.'}),profile({skills:[],summary:'Não conheço Jest, mas uso React.',experience:''}));
    expect(result.criteria[0]?.items[0]?.status).toBe('insufficient');
  });
  it('does not promote marketing mentions to mandatory or optional requirements',()=>{
    const result=analyzeMatch(job({description:'Nossa empresa usa React e Next.js.',seniority:'unknown'}),profile({objective:''}));
    expect(result.score).toBeNull();expect(result.coverage).toBe(0);
  });
  it('preserves job and profile excerpts verbatim',()=>{
    const vacancy=job();const candidate=profile();const result=analyzeMatch(vacancy,candidate);
    for(const criterion of result.criteria)for(const item of criterion.items){
      if(item.jobEvidence)expect(`${vacancy.title}\n${vacancy.description}`).toContain(item.jobEvidence);
      if(item.profileEvidence)expect([candidate.objective,candidate.summary,...candidate.skills,candidate.experience,candidate.languages].join('\n')).toContain(item.profileEvidence);
    }
  });
  it('does not treat React Native or GitHub as React or Git',()=>{
    const result=analyzeMatch(job({description:'Requirements: React Native; GitHub.',seniority:'unknown'}),profile({objective:''}));
    expect(result.score).toBeNull();
  });
  it('keeps location and salary independent from technical score',()=>{
    const original=analyzeMatch(job(),profile());
    expect(analyzeMatch(job({candidateLocation:'Unknown',eligibility:'unconfirmed',salary:'999999'}),profile()).score).toBe(original.score);
  });
  it('supports configurable weights and rejects weights that do not sum to 100',()=>{
    expect(()=>analyzeMatch(job(),profile(),{...DEFAULT_WEIGHTS,required:99})).toThrow();
    const result=analyzeMatch(job({description:'Requisitos: React.',seniority:'unknown'}),profile(),{required:100,experience:0,seniority:0,desired:0,responsibilities:0,language:0});
    expect(result.score).toBe(100);expect(result.coverage).toBe(100);
  });
  it('does not infer fluent English from an unspecified language level',()=>{
    const result=analyzeMatch(job(),profile({languages:'Inglês'}));
    expect(result.criteria.find((criterion)=>criterion.key==='language')?.items[0]?.status).toBe('insufficient');
    expect(result.score).toBe(95);
  });
  it('does not infer professional React tenure from a sentence about learning React',()=>{
    const result=analyzeMatch(job(),profile({experience:'5 anos de experiência com HTML, estudando React.'}));
    expect(result.criteria.find((criterion)=>criterion.key==='experience')?.items[0]?.status).toBe('insufficient');
  });
  it('records explicit language denial and partial level',()=>{
    expect(analyzeMatch(job(),profile({languages:'Não falo inglês'})).criteria.find((criterion)=>criterion.key==='language')?.items[0]?.status).toBe('not_met');
    expect(analyzeMatch(job(),profile({languages:'Inglês intermediário'})).criteria.find((criterion)=>criterion.key==='language')?.items[0]?.status).toBe('partial');
  });
  it('validates the endpoint, requires reviewed profile and ranks cached jobs without network',async()=>{
    let saved:Awaited<ReturnType<ProfileRepository['get']>>=null;
    const repository:ProfileRepository={get:async()=>saved,save:async(value)=>{saved=value;},delete:async()=>{saved=null;}};
    const jobs=new JobsService({read:async()=>({nextRefreshAt:'2026-10-14T00:00:00Z',collectedAt:'2026-10-13T00:00:00Z',jobs:[job({id:'remotive:2',sourceId:'2',url:'https://remotive.com/remote-jobs/synthetic-2',description:'Requirements: Next.js.',seniority:'unknown'}),job()],sources:[]}),write:async()=>undefined},[],async()=>{throw new Error('Network must not be called');},()=>new Date('2026-10-13T12:00:00Z'));
    const app=buildApp(parseEnv({}),false,{repository,jobsService:jobs});
    try{
      expect((await app.inject({method:'POST',url:'/matches',payload:{}})).statusCode).toBe(409);
      saved={profile:profile(),reviewed:true,savedAt:'2026-10-13T00:00:00Z'};
      expect((await app.inject({method:'POST',url:'/matches',payload:{weights:{...DEFAULT_WEIGHTS,required:100}}})).statusCode).toBe(400);
      const response=await app.inject({method:'POST',url:'/matches',payload:{}});expect(response.statusCode).toBe(200);
      const result=matchesResponseSchema.parse(response.json());expect(result.results[0]?.job.id).toBe('remotive:1');expect(result.results[0]?.analysis.score).toBe(100);expect(result.results[1]?.analysis.score).toBeNull();
      expect(response.headers['cache-control']).toBe('no-store');
    }finally{await app.close();}
  });
});
