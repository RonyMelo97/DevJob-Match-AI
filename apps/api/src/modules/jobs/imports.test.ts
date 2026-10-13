import {describe,it,expect} from 'vitest';
import Fastify from 'fastify';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {linkedinImportSchema,importedLinkedinJob} from '../../../../../packages/contracts/src/index.js';
import {FileImportedJobs,importRoutes} from './imports.js';
const input={url:'https://br.linkedin.com/jobs/view/example-react-123456/?trackingId=test',title:'Synthetic React Developer',company:'Synthetic test only',description:'Requisitos obrigatórios\nReact, TypeScript, HTML e CSS.\nResponsabilidades\nInterfaces responsivas.',candidateLocation:'Brasil',modality:'remote',seniority:'junior',publicationDate:'',reviewed:true};
describe('LinkedIn manual import',()=>{
  it.each(['https://evil.test/jobs/view/123456','https://linkedin.com.evil.test/jobs/view/123456','http://www.linkedin.com/jobs/view/123456','https://www.linkedin.com/jobs/search/','https://user@www.linkedin.com/jobs/view/123456'])('rejects unsafe or non-publication URL %s',url=>{expect(linkedinImportSchema.safeParse({...input,url}).success).toBe(false);});
  it('normalizes the publication link, preserves unknown date and requires review',()=>{
    expect(linkedinImportSchema.safeParse({...input,reviewed:false}).success).toBe(false);
    const job=importedLinkedinJob(linkedinImportSchema.parse(input));expect(job.url).toBe('https://www.linkedin.com/jobs/view/123456/');expect(job.publishedAt).toBeNull();expect(job.publicationRaw).toBeNull();expect(job.checkedAt).toBeNull();expect(job.source).toBe('linkedin');
  });
  it('persists privately, updates duplicates and survives repository restart without network access',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'linkedin-import-'));const app=Fastify();try{
      const path=join(dir,'imports.json');await app.register(importRoutes,{repository:new FileImportedJobs(path)});
      expect((await app.inject({method:'POST',url:'/jobs/import',payload:{...input,reviewed:false}})).statusCode).toBe(400);
      expect((await app.inject({method:'POST',url:'/jobs/import',payload:input})).statusCode).toBe(200);
      await app.inject({method:'POST',url:'/jobs/import',payload:{...input,title:'Updated synthetic React title'}});
      const jobs=await new FileImportedJobs(path).read();expect(jobs).toHaveLength(1);expect(jobs[0]?.title).toBe('Updated synthetic React title');expect((await app.inject('/jobs/imported')).json().jobs).toHaveLength(1);
    }finally{await app.close();await rm(dir,{recursive:true,force:true});}
  });
});
