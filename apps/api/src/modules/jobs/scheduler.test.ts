import { describe,it,expect,afterEach } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Job,JobRun } from '../../../../../packages/contracts/src/index.js';
import { JobsService,type JobsCache } from './service.js';
import { JobsScheduler,type SchedulerTimers } from './scheduler.js';
import { FileRunHistory,snapshotChanges,type RunHistory } from './run-history.js';

const SIX_HOURS=6*60*60*1000;
const initial=new Date('2026-10-13T12:00:00Z');
const directories:string[]=[];
afterEach(async()=>{await Promise.all(directories.splice(0).map((directory)=>rm(directory,{recursive:true,force:true})));});
function memoryHistory():RunHistory{let runs:JobRun[]=[];return{read:async()=>structuredClone(runs),upsert:async(run)=>{runs=[structuredClone(run),...runs.filter((old)=>old.id!==run.id)].slice(0,20);}};}
function memoryCache(value:Awaited<ReturnType<JobsCache['read']>>=null):JobsCache{let stored=value;return{read:async()=>stored?structuredClone(stored):null,write:async(value)=>{stored=structuredClone(value);}};}
function fakeTimers():{api:SchedulerTimers;active:Map<number,{callback:()=>void;delay:number}>}{let id=0;const active=new Map<number,{callback:()=>void;delay:number}>();return{active,api:{set:(callback,delay)=>{active.set(++id,{callback,delay});return id;},clear:(handle)=>{active.delete(handle as number);}}};}
const future=()=>({nextRefreshAt:new Date(initial.getTime()+SIX_HOURS).toISOString(),collectedAt:initial.toISOString(),jobs:[],sources:[]});
function run(overrides:Partial<JobRun>={}):JobRun{return{id:'test-run',trigger:'manual',startedAt:initial.toISOString(),finishedAt:null,status:'running',added:0,updated:0,removed:0,unchanged:0,message:null,...overrides};}
function job(id:string,description='React interfaces'):Job{return{id,source:'remotive',sourceId:id,title:'React Developer',company:'Example',url:`https://remotive.com/remote-jobs/${id}`,description,salary:null,candidateLocation:'Worldwide',modality:'remote',seniority:'unknown',publicationRaw:'2026-10-12T00:00:00Z',publishedAt:'2026-10-12T00:00:00Z',eligibility:'unconfirmed',recency:'unknown',reasons:[]};}

describe('scheduled collection and history',()=>{
  it('waits for the persisted cooldown without any network call',async()=>{
    let calls=0;const history=memoryHistory(),timers=fakeTimers();const jobs=new JobsService(memoryCache(future()),[],async()=>{calls++;return{jobs:[]};},()=>initial,(value)=>history.upsert(value));
    const scheduler=new JobsScheduler(jobs,history,()=>initial,timers.api);await scheduler.start();
    expect(calls).toBe(0);expect([...timers.active.values()][0]?.delay).toBe(SIX_HOURS);expect((await scheduler.status()).nextCheckAt).toBe(future().nextRefreshAt);await scheduler.stop();expect(timers.active.size).toBe(0);
  });
  it('collects when due, logs scheduled trigger and avoids duplicate ticks',async()=>{
    let instant=initial,calls=0;const history=memoryHistory(),timers=fakeTimers();const cache=memoryCache();const jobs=new JobsService(cache,[],async()=>{calls++;return{jobs:[]};},()=>instant,(value)=>history.upsert(value));
    const scheduler=new JobsScheduler(jobs,history,()=>instant,timers.api);await scheduler.start();await scheduler.tick();expect(calls).toBe(1);
    expect((await history.read())[0]).toMatchObject({trigger:'scheduled',status:'success'});
    instant=new Date(initial.getTime()+SIX_HOURS);await scheduler.tick();expect(calls).toBe(2);expect((await history.read())).toHaveLength(2);await scheduler.stop();
  });
  it('preserves cooldown after provider failure instead of retrying immediately',async()=>{
    let calls=0;const history=memoryHistory(),timers=fakeTimers();const jobs=new JobsService(memoryCache(),[],async()=>{calls++;throw new Error('Provider unavailable');},()=>initial,(value)=>history.upsert(value));
    const scheduler=new JobsScheduler(jobs,history,()=>initial,timers.api);await scheduler.start();await scheduler.tick();expect(calls).toBe(1);expect((await history.read())[0]?.status).toBe('failed');expect([...timers.active.values()][0]?.delay).toBe(SIX_HOURS);await scheduler.stop();
  });
  it('records partial failure when another source succeeds',async()=>{
    const history=memoryHistory();const jobs=new JobsService(memoryCache(),['example'],async(url)=>{if(url.includes('greenhouse'))throw new Error();return{jobs:[]};},()=>initial,(value)=>history.upsert(value));await jobs.get(true);expect((await history.read())[0]).toMatchObject({trigger:'manual',status:'partial'});
  });
  it('recovers interrupted entries without bypassing a restart cooldown',async()=>{
    const history=memoryHistory();await history.upsert(run());let calls=0;const timers=fakeTimers();const jobs=new JobsService(memoryCache(future()),[],async()=>{calls++;return{jobs:[]};},()=>initial);
    const scheduler=new JobsScheduler(jobs,history,()=>initial,timers.api);await scheduler.start();expect((await history.read())[0]?.status).toBe('interrupted');expect(calls).toBe(0);await scheduler.stop();
  });
  it('stops without scheduling another timer after an in-flight collection completes',async()=>{
    let resolveFetch:((value:unknown)=>void)|undefined;const timers=fakeTimers();const jobs=new JobsService(memoryCache(),[],async()=>new Promise((resolve)=>{resolveFetch=resolve;}),()=>initial);
    const scheduler=new JobsScheduler(jobs,memoryHistory(),()=>initial,timers.api);const starting=scheduler.start();await new Promise<void>((resolve)=>setTimeout(resolve,0));const stopping=scheduler.stop();resolveFetch?.({jobs:[]});await Promise.all([starting,stopping]);expect(timers.active.size).toBe(0);expect((await scheduler.status()).enabled).toBe(false);
  });
  it('does not duplicate or mislabel an active manual collection when scheduler is resumed',async()=>{
    let calls=0,resolveFetch:((value:unknown)=>void)|undefined;const history=memoryHistory(),timers=fakeTimers();const jobs=new JobsService(memoryCache(),[],async()=>{calls++;return new Promise((resolve)=>{resolveFetch=resolve;});},()=>initial,(value)=>history.upsert(value));
    const manual=jobs.get(true);await new Promise<void>((resolve)=>setTimeout(resolve,0));const scheduler=new JobsScheduler(jobs,history,()=>initial,timers.api);await scheduler.start();expect((await history.read())[0]?.status).toBe('running');resolveFetch?.({jobs:[]});await manual;expect(calls).toBe(1);expect((await history.read())[0]?.trigger).toBe('manual');await scheduler.stop();
  });
  it('uses added/updated/removed/unchanged counts without inferring closure',()=>{
    const previous=[job('a'),job('b'),job('gone')];const next=[job('a'),job('b','Updated React role'),job('new')];expect(snapshotChanges(previous,next)).toEqual({added:1,updated:1,removed:1,unchanged:1});
  });
  it('persists, bounds and updates history through a new repository instance',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'devjob-runs-'));directories.push(directory);const path=join(directory,'runs.json');const history=new FileRunHistory(path);
    for(let index=0;index<25;index++)await history.upsert(run({id:String(index),status:'success',finishedAt:initial.toISOString()}));
    const reloaded=new FileRunHistory(path);expect(await reloaded.read()).toHaveLength(20);await reloaded.upsert(run({id:'24',status:'failed'}));expect((await reloaded.read())[0]?.status).toBe('failed');expect(await reloaded.read()).toHaveLength(20);
  });
  it('rechecks after persistence failure without making an unsafe provider request',async()=>{
    let calls=0;const timers=fakeTimers();const jobs=new JobsService({read:async()=>null,write:async()=>{throw new Error('No persistence');}},[],async()=>{calls++;return{jobs:[]};},()=>initial);const scheduler=new JobsScheduler(jobs,memoryHistory(),()=>initial,timers.api);
    await scheduler.start();expect(calls).toBe(0);expect((await scheduler.status()).lastError).not.toBeNull();expect([...timers.active.values()][0]?.delay).toBe(60_000);await scheduler.stop();
  });
});
