import { describe,it,expect } from 'vitest';
import { parseEnv } from '../../config/env.js';
import { OpenAiProvider,reservedCost } from './provider.js';
import { AiService,publicJobText,type AiLedger,type AiStore } from './service.js';
import type { Job } from '../../../../../packages/contracts/src/index.js';
import { buildApp } from '../../app.js';
import { JobsService } from '../jobs/service.js';

const job:Job={id:'remotive:ai-test',source:'remotive',sourceId:'ai-test',title:'React Developer',company:'Synthetic',url:'https://remotive.com/remote-jobs/synthetic',description:'Requirements: React and TypeScript. Contact synthetic@example.com +55 11 99999-9999.',salary:null,candidateLocation:'Worldwide',modality:'remote',seniority:'unknown',publishedAt:'2026-10-12T00:00:00Z',publicationRaw:'2026-10-12T00:00:00Z',eligibility:'eligible',recency:'recent',reasons:[]};
function memoryStore():AiStore{let ledger:AiLedger|null=null;return{read:async()=>ledger?structuredClone(ledger):null,write:async(value)=>{ledger=structuredClone(value);}};}
const config=()=>parseEnv({AI_ENABLED:'true',OPENAI_API_KEY:'synthetic-test-key'});
const extraction={requirements:[{category:'required' as const,quote:'React and TypeScript'}]};
describe('optional grounded AI',()=>{
  it('redacts contact details and bounds UTF-8 input size',()=>{
    const result=publicJobText(job);expect(result.text).not.toContain('synthetic@example.com');expect(result.text).not.toContain('99999');
    const large=publicJobText({...job,description:'á🙂'.repeat(10_000)});expect(Buffer.byteLength(large.text,'utf8')).toBeLessThanOrEqual(12_000);expect(large.truncated).toBe(true);
  });
  it('previews without provider calls and stays disabled by default',async()=>{
    let calls=0;const service=new AiService(parseEnv({}),memoryStore(),{extract:async()=>{calls++;return extraction;}});
    const preview=await service.preview(job);expect(preview.enabled).toBe(false);expect(calls).toBe(0);
    await expect(service.analyze(job,preview.hash,true)).rejects.toMatchObject({statusCode:503});expect(calls).toBe(0);
  });
  it('requires consent and matching preview hash before spending',async()=>{
    let calls=0;const service=new AiService(config(),memoryStore(),{extract:async()=>{calls++;return extraction;}});
    const preview=await service.preview(job);
    await expect(service.analyze(job,preview.hash,false)).rejects.toMatchObject({statusCode:400});
    await expect(service.analyze({...job,description:'Changed job'},preview.hash,true)).rejects.toMatchObject({statusCode:409});expect(calls).toBe(0);
  });
  it('validates evidence and caches responses across service instances',async()=>{
    const store=memoryStore();let calls=0;const provider={extract:async()=>{calls++;return extraction;}};
    const service=new AiService(config(),store,provider);const preview=await service.preview(job);
    const first=await service.analyze(job,preview.hash,true);expect(first.cached).toBe(false);expect(first.reservedUsd).toBeGreaterThan(0);
    const second=await new AiService(config(),store,provider).analyze(job,preview.hash,true);expect(second.cached).toBe(true);expect(second.reservedUsd).toBe(0);expect(calls).toBe(1);
  });
  it('rejects fabricated quotes and reserves failed attempts to prevent retry overspend',async()=>{
    const store=memoryStore();const service=new AiService(config(),store,{extract:async()=>({requirements:[{category:'required',quote:'Unstated Kubernetes expertise'}]})});const preview=await service.preview(job);
    await expect(service.analyze(job,preview.hash,true)).rejects.toMatchObject({statusCode:502});
    expect((await store.read())?.reservedUsd).toBe(preview.maxEstimatedUsd);expect((await store.read())?.cache).toEqual([]);
  });
  it('enforces per-call and persisted daily budget before external calls',async()=>{
    let calls=0;const provider={extract:async()=>{calls++;return extraction;}};
    const low=new AiService({...config(),AI_MAX_REQUEST_USD:0.000001},memoryStore(),provider);const preview=await low.preview(job);
    await expect(low.analyze(job,preview.hash,true)).rejects.toMatchObject({statusCode:429});
    const store=memoryStore();await store.write({day:new Date().toISOString().slice(0,10),reservedUsd:0.1,cache:[]});
    const daily=new AiService(config(),store,provider);await expect(daily.analyze(job,preview.hash,true)).rejects.toMatchObject({statusCode:429});expect(calls).toBe(0);
  });
  it('uses strict structured output with no storage, tools or profile data',async()=>{
    let sent:unknown;const provider=new OpenAiProvider('synthetic-key',async(body)=>{sent=body;return{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(extraction)}]}]};});
    const text=publicJobText(job).text;expect(await provider.extract(text)).toEqual(extraction);
    expect(sent).toMatchObject({store:false,max_output_tokens:1200,text:{format:{type:'json_schema',strict:true}}});
    expect(JSON.stringify(sent)).not.toContain('synthetic-key');expect(JSON.stringify(sent)).not.toContain('synthetic@example.com');
  });
  it('rejects refusals, incomplete responses, invalid JSON and unsupported evidence',async()=>{
    for(const raw of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]},{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'bad JSON'}]}]},{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({requirements:[{category:'required',quote:'fabricated quote'}]})}]}]}]){
      await expect(new OpenAiProvider('synthetic-key',async()=>raw).extract('Requirements: React')).rejects.toThrow();
    }
  });
  it('returns a conservative positive cost reservation',()=>{expect(reservedCost(publicJobText(job).text)).toBeGreaterThan(0);expect(reservedCost(publicJobText(job).text)).toBeLessThan(0.01);});
  it('rejects arbitrary uploads and confirms only jobs in filtered cache at the API boundary',async()=>{
    const jobs=new JobsService({read:async()=>({nextRefreshAt:'2026-10-14T00:00:00Z',collectedAt:'2026-10-13T00:00:00Z',jobs:[job],sources:[]}),write:async()=>undefined},[],async()=>{throw new Error('No network');},()=>new Date('2026-10-13T12:00:00Z'));
    const ai=new AiService(config(),memoryStore(),{extract:async()=>extraction});const app=buildApp(config(),false,{jobsService:jobs,aiService:ai});
    try{
      expect((await app.inject({method:'POST',url:'/ai/preview',payload:{jobId:job.id,profile:'private data'}})).statusCode).toBe(400);
      const preview=await app.inject({method:'POST',url:'/ai/preview',payload:{jobId:job.id}});expect(preview.statusCode).toBe(200);
      expect((await app.inject({method:'POST',url:'/ai/analyze',payload:{jobId:job.id,hash:preview.json().hash}})).statusCode).toBe(400);
      expect((await app.inject({method:'POST',url:'/ai/analyze',payload:{jobId:job.id,hash:preview.json().hash,confirmed:true}})).statusCode).toBe(200);
    }finally{await app.close();}
  });
});
