import { useEffect, useState } from 'react';
import { healthResponseSchema } from '@devjob/contracts';
import styles from './App.module.css';
import { ResumePanel } from '../components/ResumePanel';
import { JobsPanel } from '../components/JobsPanel';

type Connection = 'loading' | 'connected' | 'error';

export function App(): React.JSX.Element {
  const [connection, setConnection] = useState<Connection>('loading');
  const [attempt, setAttempt] = useState<number>(0);
  const [profileRevision,setProfileRevision]=useState<number>(0);
  useEffect(() => {
    const controller = new AbortController();
    setConnection('loading');
    async function checkHealth(): Promise<void> {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });
        if (!response.ok) throw new Error('API indisponível');
        const body: unknown = await response.json();
        healthResponseSchema.parse(body);
        if (!controller.signal.aborted) setConnection('connected');
      } catch {
        if (!controller.signal.aborted) setConnection('error');
      }
    }
    void checkHealth();
    return () => controller.abort();
  }, [attempt]);
  const labels: Record<Connection, string> = {
    loading: 'Verificando conexão com a API…',
    connected: 'API conectada e pronta',
    error: 'Não foi possível conectar à API. Verifique se o backend está em execução.',
  };
  return <main className={styles.container}>
    <header className={styles.header}><a className={styles.brand} href="/">DevJob<span> Match AI</span></a><span className={styles.version}>v0.6.0</span></header>
    <nav className={styles.navigation} aria-label="Navegação do dashboard"><a href="#vagas">Oportunidades</a><a href="#perfil">Meu perfil</a><a href="#sobre">Sobre o projeto</a></nav>
    <section className={styles.hero}>
      <p className={styles.eyebrow}>SEU PRÓXIMO PASSO, COM MAIS CLAREZA</p>
      <h1>Encontre oportunidades.<br /><span>Entenda sua compatibilidade.</span></h1>
      <p className={styles.intro}>Um espaço para comparar seu perfil com vagas de Front-end, com critérios transparentes e evidências para cada análise.</p>
      <div className={styles.status} role="status" aria-live="polite"><span aria-hidden="true" className={`${styles.dot} ${connection === 'connected' ? styles.connected : ''}`} />{labels[connection]}</div>
      {connection === 'error' && <button className={styles.retry} onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>}
    </section>
    <JobsPanel profileRevision={profileRevision}/>
    <div id="perfil"><ResumePanel onProfileChange={()=>setProfileRevision((current)=>current+1)}/></div>
    <section id="sobre" aria-labelledby="next-title"><h2 id="next-title">O que você pode fazer</h2><div className={styles.cards}>
      <article><span>01 / PERFIL</span><h3>Seu currículo como ponto de partida</h3><p>Envie um PDF e revise as experiências e habilidades extraídas.</p><small>Disponível nesta versão</small></article>
      <article><span>02 / OPORTUNIDADES</span><h3>Vagas com contexto</h3><p>Consulte fontes públicas e confira data, modalidade e elegibilidade.</p><small>Disponível nesta versão</small></article>
      <article><span>03 / COMPATIBILIDADE</span><h3>Uma análise que você entende</h3><p>Veja requisitos atendidos e informações que precisam de confirmação.</p><small>Disponível nesta versão</small></article>
    </div></section>
    <footer>Estimativas fundamentadas em evidências · Não representam probabilidade de contratação.</footer>
  </main>;
}
