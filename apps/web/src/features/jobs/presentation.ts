import {z} from 'zod';
import type {Job} from '@devjob/contracts';
const DAYS=14*24*60*60*1000;
export function withinTwoWeeks(job:Job,now:Date=new Date()):boolean{
  if(job.publishedAt){const time=Date.parse(job.publishedAt);return Number.isFinite(time)&&time<=now.getTime()&&time>=now.getTime()-DAYS;}
  const raw=job.publicationRaw;
  if(raw&&(z.iso.date().safeParse(raw).success||z.iso.datetime({local:true}).safeParse(raw).success)){
    const day=raw.slice(0,10);const earliest=Date.parse(`${day}T00:00:00+14:00`);const latest=Date.parse(`${day}T23:59:59-12:00`);
    return latest>=now.getTime()-DAYS&&earliest<=now.getTime();
  }
  return true; // Unknown date stays explicitly unconfirmed, never invented as recent.
}
export function publicationLabel(job:Job):string{
  if(job.publishedAt&&Number.isFinite(Date.parse(job.publishedAt)))return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(job.publishedAt));
  const raw=job.publicationRaw;
  if(raw&&(z.iso.date().safeParse(raw).success||z.iso.datetime({local:true}).safeParse(raw).success)){const [year,month,day]=raw.slice(0,10).split('-');return `${day}/${month}/${year} (fuso não informado)`;}
  return 'Data não confirmada';
}
export function locationLabel(job:Job):string{
  const mode={remote:'Remoto',hybrid:'Híbrido',onsite:'Presencial',unknown:'Modalidade não informada'}[job.modality];
  return `${mode} · ${(job.candidateLocation??'Local não informado').replace(/\bBrazil\b/gi,'Brasil')}`;
}
