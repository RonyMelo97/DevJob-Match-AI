import { useState } from 'react';
import { z } from 'zod';
import { aiPreviewSchema,aiResultSchema,type AiPreview,type AiResult } from '@devjob/contracts';

const labels={required:'Obrigatório',desired:'Desejável',experience:'Experiência',seniority:'Senioridade',responsibilities:'Responsabilidades',language:'Idioma'};
async function post(path:string,input:unknown):Promise<unknown>{
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const body:unknown=await response.json();
  if(!response.ok){const error=z.object({message:z.string()}).safeParse(body);throw new Error(error.success?error.data.message:'Falha na análise de IA.');}
  return body;
}
export function AiJobAnalysis({jobId}:{jobId:string}):React.JSX.Element{
  const [preview,setPreview]=useState<AiPreview|null>(null);
  const [result,setResult]=useState<AiResult|null>(null);
  const [confirmed,setConfirmed]=useState<boolean>(false);
  const [busy,setBusy]=useState<boolean>(false);
  const [error,setError]=useState<string>('');
  async function prepare():Promise<void>{
    setBusy(true);setError('');setConfirmed(false);setResult(null);
    try{setPreview(aiPreviewSchema.parse(await post('/api/ai/preview',{jobId})));}catch(cause:unknown){setError(cause instanceof Error?cause.message:'Falha ao preparar análise.');}
    finally{setBusy(false);}
  }
  async function analyze():Promise<void>{
    if(!preview||!confirmed)return;setBusy(true);setError('');
    try{setResult(aiResultSchema.parse(await post('/api/ai/analyze',{jobId,hash:preview.hash,confirmed:true})));setConfirmed(false);}catch(cause:unknown){setError(cause instanceof Error?cause.message:'Falha na análise.');}
    finally{setBusy(false);}
  }
  return <details><summary>Identificar requisitos com IA (opcional)</summary>
    <p>Somente texto público da vaga; currículo e perfil ficam locais. A IA não altera seu score nem suas habilidades.</p>
    <button type="button" disabled={busy} onClick={()=>void prepare()}>Preparar prévia sem enviar à IA</button>
    {preview&&<>
      <p>Destino: OpenAI · modelo {preview.model}. {preview.enabled?'IA configurada.':'IA desativada ou sem chave no servidor.'}</p>
      <p>Reserva estimada máxima: US$ {preview.maxEstimatedUsd.toFixed(6)}. Orçamento diário restante (UTC): US$ {preview.dailyRemainingUsd.toFixed(6)}. {preview.cached?'Resultado disponível no cache; nova reserva é zero.':''}</p>
      {preview.truncated&&<p>Texto limitado por tamanho: a análise não cobrirá toda a descrição.</p>}
      <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:300,overflow:'auto'}}>{preview.text}</pre>
      <p>O envio está sujeito às políticas de tratamento de dados da OpenAI. Nenhuma chamada real é feita ao preparar esta prévia.</p>
      <label><input type="checkbox" checked={confirmed} disabled={busy||!preview.enabled} onChange={(event)=>setConfirmed(event.target.checked)}/> Confirmo o envio deste texto público à OpenAI e o custo estimado, se não houver cache.</label>
      <br/><button type="button" disabled={busy||!preview.enabled||!confirmed} onClick={()=>void analyze()}>{busy?'Analisando…':'Confirmar análise'}</button>
    </>}
    {error&&<p role="alert">{error}</p>}
    {result&&<div role="status"><p>{result.warning}</p><p>{result.cached?'Resultado do cache.':'Resultado recebido e validado.'} Reserva: US$ {result.reservedUsd.toFixed(6)}.</p>
      {result.extraction.requirements.length===0&&<p>Nenhum requisito identificado com segurança.</p>}
      <ul>{result.extraction.requirements.map((item,index)=><li key={index}><strong>{labels[item.category]}:</strong> {item.quote}</li>)}</ul>
    </div>}
  </details>;
}
