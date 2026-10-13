import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {jobSchema,linkedinImportSchema,importedLinkedinJob,type Job} from '../../../../../packages/contracts/src/index.js';
const list=z.array(jobSchema).max(100);
export class FileImportedJobs{
  private pending:Promise<void>=Promise.resolve();
  constructor(private readonly path:string){}
  async read():Promise<Job[]>{await this.pending;return this.load();}
  private async load():Promise<Job[]>{try{return list.parse(JSON.parse(await readFile(this.path,'utf8')) as unknown);}catch(error:unknown){if(error instanceof Error&&'code'in error&&error.code==='ENOENT')return [];throw error;}}
  async upsert(job:Job):Promise<void>{
    const task=this.pending.then(async()=>{const jobs=await this.load();const updated=[job,...jobs.filter(item=>item.id!==job.id)].slice(0,100);await mkdir(dirname(this.path),{recursive:true});await writeFile(`${this.path}.tmp`,JSON.stringify(updated));await rename(`${this.path}.tmp`,this.path);});this.pending=task.catch(()=>{});return task;
  }
}
export async function importRoutes(app:FastifyInstance,options:{repository:FileImportedJobs}):Promise<void>{
  app.get('/jobs/imported',async()=>({jobs:await options.repository.read()}));
  app.post('/jobs/import',async(request,reply)=>{const input=linkedinImportSchema.safeParse(request.body);if(!input.success)return reply.code(400).send({message:'Confira link da publicação, campos obrigatórios, data e confirmação de revisão.'});const job=importedLinkedinJob(input.data);await options.repository.upsert(job);return {job};});
}
