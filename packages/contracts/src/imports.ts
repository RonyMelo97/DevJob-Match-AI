import {z} from 'zod';
import {jobSchema,type Job} from './jobs.js';
export const linkedinImportSchema=z.object({
  url:z.url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.port&&!url.username&&!url.password&&['linkedin.com','www.linkedin.com','br.linkedin.com'].includes(url.hostname)&&/^\/jobs\/view\/(?:[^/]+-)?\d+\/?$/.test(url.pathname);},'Use o link HTTPS da publicação LinkedIn (/jobs/view/...).'),
  title:z.string().trim().min(3).max(300),company:z.string().trim().min(2).max(200),description:z.string().trim().min(40).max(50000),
  candidateLocation:z.string().trim().max(300),modality:jobSchema.shape.modality,seniority:jobSchema.shape.seniority,
  publicationDate:z.union([z.literal(''),z.iso.date()]),reviewed:z.literal(true),
}).strict();
export type LinkedinImport=z.infer<typeof linkedinImportSchema>;
export function importedLinkedinJob(input:LinkedinImport):Job{
  const url=new URL(input.url);const id=url.pathname.match(/(\d+)\/?$/)?.[1];if(!id)throw new Error('ID da publicação ausente.');
  return jobSchema.parse({id:`linkedin:${id}`,source:'linkedin',sourceId:id,title:input.title,company:input.company,url:`https://www.linkedin.com/jobs/view/${id}/`,description:input.description,salary:null,candidateLocation:input.candidateLocation||null,modality:input.modality,seniority:input.seniority,publishedAt:null,publicationRaw:input.publicationDate||null,checkedAt:null,eligibility:'unconfirmed',recency:'unknown',reasons:['Importada e revisada pelo usuário; disponibilidade não verificada pelo app.']});
}
