import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { aiExtractionSchema,aiPreviewSchema,type AiPreview,type AiResult,type Job } from '../../../../../packages/contracts/src/index.js';
import type { AppConfig } from '../../config/env.js';
import { AI_MODEL,reservedCost,type AiProvider } from './provider.js';

export class AiError extends Error {constructor(message:string,public readonly statusCode:number){super(message);}}
export const ledgerSchema=z.object({day:z.string(),reservedUsd:z.number().nonnegative(),cache:z.array(z.object({hash:z.string(),extraction:aiExtractionSchema})).max(50)});
export type AiLedger=z.infer<typeof ledgerSchema>;
export interface AiStore {read():Promise<AiLedger|null>;write(value:AiLedger):Promise<void>}
export class FileAiStore implements AiStore {
  constructor(private readonly path:string){}
  async read():Promise<AiLedger|null>{try{return ledgerSchema.parse(JSON.parse(await readFile(this.path,'utf8')) as unknown);}catch(error:unknown){if(error instanceof Error&&'code'in error&&error.code==='ENOENT')return null;throw error;}}
  async write(value:AiLedger):Promise<void>{await mkdir(dirname(this.path),{recursive:true});await writeFile(`${this.path}.tmp`,JSON.stringify(ledgerSchema.parse(value)),{mode:0o600});await rename(`${this.path}.tmp`,this.path);}
}
export function publicJobText(job:Job):{text:string;truncated:boolean} {
  let text=`Cargo: ${job.title}\nDescrição: ${job.description}`.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[email removido]').replace(/https?:\/\/\S+/gi,'[link removido]').replace(/(?:\+?\d[\d ()-]{7,}\d)/g,'[contato removido]');
  const original=text;
  while(Buffer.byteLength(text,'utf8')>12_000)text=text.slice(0,Math.max(1,Math.floor(text.length*.9)));
  return {text,truncated:text!==original};
}
export class AiService {
  private busy=false;
  constructor(private readonly config:AppConfig,private readonly store:AiStore,private readonly provider:AiProvider,private readonly clock:()=>Date=()=>new Date()){}
  private async ledger():Promise<AiLedger>{const stored=await this.store.read();const day=this.clock().toISOString().slice(0,10);return stored?.day===day?stored:{day,reservedUsd:0,cache:stored?.cache??[]};}
  async preview(job:Job):Promise<AiPreview>{
    const {text,truncated}=publicJobText(job);const hash=createHash('sha256').update(`ai-v0.5.0:${AI_MODEL}:${text}`).digest('hex');const ledger=await this.ledger();
    return aiPreviewSchema.parse({jobId:job.id,provider:'openai',model:AI_MODEL,text,hash,truncated,maxEstimatedUsd:reservedCost(text),dailyRemainingUsd:Math.max(0,this.config.AI_DAILY_BUDGET_USD-ledger.reservedUsd),enabled:this.config.AI_ENABLED&&this.config.OPENAI_API_KEY.length>0,cached:ledger.cache.some((entry)=>entry.hash===hash)});
  }
  async analyze(job:Job,hash:string,confirmed:boolean):Promise<AiResult>{
    if(!confirmed)throw new AiError('Confirme o texto público e o custo antes de enviar.',400);
    if(this.busy)throw new AiError('Há uma análise em andamento. Aguarde.',429);
    this.busy=true;
    try{
      const preview=await this.preview(job);
      if(preview.hash!==hash)throw new AiError('A vaga mudou. Gere uma nova prévia antes de confirmar.',409);
      if(!preview.enabled)throw new AiError('IA desativada ou sem chave configurada no servidor.',503);
      const ledger=await this.ledger();const cached=ledger.cache.find((entry)=>entry.hash===hash);
      const warning='Sugestões de categorias por IA com trechos literais. Revise a vaga original; o score e o perfil não foram alterados.';
      if(cached)return {extraction:cached.extraction,cached:true,reservedUsd:0,warning};
      if(preview.maxEstimatedUsd>this.config.AI_MAX_REQUEST_USD||ledger.reservedUsd+preview.maxEstimatedUsd>this.config.AI_DAILY_BUDGET_USD)throw new AiError('A análise excede o limite local de custo por chamada ou diário.',429);
      ledger.reservedUsd=Number((ledger.reservedUsd+preview.maxEstimatedUsd).toFixed(6));await this.store.write(ledger);
      let extraction;
      try{
        extraction=aiExtractionSchema.parse(await this.provider.extract(preview.text));
        if(extraction.requirements.some((item)=>!preview.text.includes(item.quote)))throw new Error('Ungrounded');
      }catch{throw new AiError('Resposta de IA inválida, recusada ou indisponível. Nenhum dado do perfil foi alterado. A reserva de orçamento foi mantida.',502);}
      ledger.cache=[{hash,extraction},...ledger.cache.filter((entry)=>entry.hash!==hash)].slice(0,50);await this.store.write(ledger);
      return {extraction,cached:false,reservedUsd:preview.maxEstimatedUsd,warning};
    }finally{this.busy=false;}
  }
}
