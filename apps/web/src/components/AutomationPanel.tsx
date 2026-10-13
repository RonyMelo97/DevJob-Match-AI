import { useEffect,useState } from 'react';
import { automationStatusSchema,type AutomationStatus,type JobRun } from '@devjob/contracts';

const labels:Record<JobRun['status'],string>={running:'Em andamento',success:'Sucesso',partial:'Falha parcial',failed:'Falha',interrupted:'Interrompida'};
export function AutomationPanel():React.JSX.Element{
  const [status,setStatus]=useState<AutomationStatus|null>(null);const [busy,setBusy]=useState<boolean>(false);const [error,setError]=useState<string>('');
  useEffect(()=>{const controller=new AbortController();let pending=false;async function load():Promise<void>{if(pending)return;pending=true;try{const response=await fetch('/api/jobs/automation',{signal:controller.signal});if(!response.ok)throw new Error();const body:unknown=await response.json();if(!controller.signal.aborted){setStatus(automationStatusSchema.parse(body));setError('');}}catch{if(!controller.signal.aborted)setError('Não foi possível ler o agendamento.');}finally{pending=false;}}void load();const timer=setInterval(()=>void load(),60_000);return()=>{controller.abort();clearInterval(timer);};},[]);
  async function toggle():Promise<void>{if(!status)return;setBusy(true);setError('');try{const response=await fetch('/api/jobs/automation',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!status.enabled})});if(!response.ok)throw new Error();const body:unknown=await response.json();setStatus(automationStatusSchema.parse(body));}catch{setError('Não foi possível alterar o agendamento.');}finally{setBusy(false);}}
  return <details><summary>Atualização automática e histórico</summary>
    <p>Consulta apenas fontes públicas enquanto a API está ligada, respeitando a janela de seis horas. Nenhuma chamada automática de IA.</p>
    <p>A pausa dura até reiniciar o servidor. Para manter a busca pausada após reinícios, use a configuração descrita no README.</p>
    {status&&<><p role="status">Busca automática: {status.enabled?'ativa':'pausada'}. {status.running?'Há uma coleta em andamento.':''}</p><p>Próxima verificação: {status.nextCheckAt?new Date(status.nextCheckAt).toLocaleString('pt-BR'):'não agendada'}.</p>
      <button disabled={busy} onClick={()=>void toggle()}>{busy?'Aplicando…':status.enabled?'Pausar busca automática':'Ativar busca automática'}</button>
      {status.lastError&&<p role="alert">{status.lastError}</p>}
      <p>O histórico é atualizado a cada minuto. Use “Recarregar lista do cache” para ver novas vagas no dashboard.</p>
      {status.runs.length===0&&<p>Nenhuma coleta registrada nesta versão ainda.</p>}
      <ul>{status.runs.map((run)=><li key={run.id}><strong>{labels[run.status]}</strong> · {run.trigger==='scheduled'?'agendada':'manual'} · {new Date(run.startedAt).toLocaleString('pt-BR')}<p>{run.added} novas · {run.updated} alteradas · {run.unchanged} sem alteração · {run.removed} fora da nova fotografia.</p>{run.message&&<p>{run.message}</p>}</li>)}</ul>
    </>}
    {error&&<p role="alert">{error}</p>}
  </details>;
}
