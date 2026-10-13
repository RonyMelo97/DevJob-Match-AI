import { useState } from 'react';
import { savedProfileSchema, type MatchAnalysis, type Job } from '@devjob/contracts';
import { apiFetch } from '../services/api';
import { analyzeMatch } from '../../../api/src/modules/matching/engine';

const labels={required:'Tecnologias obrigatórias',desired:'Tecnologias desejáveis',experience:'Experiência',seniority:'Senioridade',responsibilities:'Responsabilidades',language:'Idioma'};
const findings=[
  {company:'Deliver IT · Gupy',title:'Desenvolvedor Frontend React Pleno',url:'https://deliverit.gupy.io/jobs/12649638?jobBoardSource=gupy_public_page',note:'100% remoto. React, TypeScript e APIs; exige também testes e gerenciamento de estado. Publicação sem data confirmada.'},
  {company:'Cadastra · Gupy',title:'Desenvolvedor Front End Pleno',url:'https://cadastra.gupy.io/jobs/12395356',note:'React, HTML, CSS e TypeScript; exige VTEX e Next.js. Modalidade específica e data precisam ser confirmadas.'},
  {company:'SCCON · LinkedIn',title:'Desenvolvedor Front-End Pleno · São Paulo',url:'https://br.linkedin.com/jobs/view/desenvolvedor-front-end-pleno-at-sccon-4460144771',note:'HTML, CSS e JavaScript, mas exige experiência com Angular. Página informa “há 2 semanas”; não confirmado como recente.'},
  {company:'SELOTTO / HandsOn · InfoJobs',title:'Desenvolvedor Front-End · São Paulo',url:'https://www.infojobs.com.br/vaga-de-desenvolvedor-front-end-em-sao-paulo__11275146.aspx',note:'Híbrido em São Paulo. HTML, CSS, JavaScript, WordPress, APIs e Git. Encontrado no índice de busca; disponibilidade atual e ano da publicação não confirmados.'},
];
export function PortalSearchPanel():React.JSX.Element{
  const [term,setTerm]=useState<string>('desenvolvedor front end');
  const [description,setDescription]=useState<string>('');
  const [analysis,setAnalysis]=useState<MatchAnalysis|null>(null);
  const [error,setError]=useState<string>('');
  const [busy,setBusy]=useState<boolean>(false);
  const query=encodeURIComponent(term);
  async function compare():Promise<void>{
    setBusy(true);setError('');setAnalysis(null);
    try{
      const response=await apiFetch('/api/profile');if(!response.ok)throw new Error('Não foi possível ler seu perfil.');
      const body=await response.json() as {saved:unknown};const saved=savedProfileSchema.safeParse(body.saved);
      if(!saved.success)throw new Error('Salve seu perfil revisado em Meu perfil primeiro.');
      const job:Job={id:'manual',source:'manual',sourceId:'manual',title:term,company:'Descrição colada pelo usuário',url:'https://example.org/',description,salary:null,candidateLocation:null,modality:'unknown',seniority:'unknown',publishedAt:null,publicationRaw:null,eligibility:'unconfirmed',recency:'unknown',reasons:[]};
      setAnalysis(analyzeMatch(job,saved.data.profile));
    }catch(cause:unknown){setError(cause instanceof Error?cause.message:'Falha ao comparar.');}finally{setBusy(false);}
  }
  return <section aria-labelledby="portal-search-title"><h3 id="portal-search-title">Buscar vagas nos portais brasileiros</h3>
    <p>Coleta automática: Remotive e quadros Greenhouse configurados. LinkedIn, Gupy, Indeed e os portais abaixo são buscas externas; seus resultados não entram automaticamente no ranking.</p>
    <label>Área de busca <select value={term} onChange={event=>{setTerm(event.target.value);setAnalysis(null);}}><option value="desenvolvedor front end">Front-end</option><option value="React TypeScript">React / TypeScript</option><option value="HTML CSS JavaScript">HTML / CSS / JavaScript</option><option value="WordPress PHP SEO">WordPress / PHP / SEO</option></select></label>
    <ul>
      <li><a href={`https://www.linkedin.com/jobs/search/?keywords=${query}&location=S%C3%A3o%20Paulo%2C%20Brasil&f_TPR=r604800`} target="_blank" rel="noreferrer">LinkedIn · São Paulo · última semana</a></li>
      <li><a href={`https://www.linkedin.com/jobs/search/?keywords=${query}&location=Brasil&f_WT=2&f_TPR=r604800`} target="_blank" rel="noreferrer">LinkedIn · remoto no Brasil · última semana</a></li>
      <li><a href={`https://br.indeed.com/jobs?q=${query}&l=S%C3%A3o+Paulo%2C+SP&fromage=7`} target="_blank" rel="noreferrer">Indeed · São Paulo · últimos sete dias</a></li>
      <li><a href={`https://portal.gupy.io/job-search/term%3D${query}`} target="_blank" rel="noreferrer">Gupy · buscar e ajustar localização no portal</a></li>
      <li><a href="https://www.infojobs.com.br/vagas-de-desenvolvedor-front-end-em-sao-paulo%2C-sp.aspx" target="_blank" rel="noreferrer">InfoJobs · Front-end em São Paulo</a></li>
      <li><a href="https://www.vagas.com.br/" target="_blank" rel="noreferrer">Vagas.com · pesquisar cargo e São Paulo</a></li>
      <li><a href="https://www.catho.com.br/" target="_blank" rel="noreferrer">Catho · pesquisar cargo e conferir condições do portal</a></li>
    </ul>
    <details open><summary>Anúncios encontrados na pesquisa de 13/10/2026</summary><p>Pesquisa pontual em páginas públicas e índices. Não é atualização automática nem garantia de vaga aberta, recência ou compatibilidade completa.</p><ul>{findings.map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><p>{item.company}: {item.note}</p></li>)}</ul></details>
    <details><summary>Comparar uma vaga de qualquer portal com meu currículo</summary><p>Copie a descrição completa da publicação e cole abaixo. O cálculo acontece neste navegador, com seu perfil revisado; não envia currículo ao portal ou à IA. Localização, data e disponibilidade devem ser verificadas na publicação.</p><label>Descrição original da vaga<textarea rows={8} maxLength={50000} value={description} onChange={event=>{setDescription(event.target.value);setAnalysis(null);}} style={{display:'block',width:'100%'}}/></label><button disabled={busy||!description.trim()} onClick={()=>void compare()}>{busy?'Comparando…':'Comparar com meu perfil'}</button>{error&&<p role="alert">{error}</p>}{analysis&&<div role="status"><h4>{analysis.score===null?'Evidências insuficientes para calcular':`Compatibilidade por regras: ${analysis.score}%`}</h4><p>Cobertura: {analysis.coverage}%. Estimativa técnica, não chance de contratação. Usa os pesos padrão.</p>{analysis.criteria.map(criterion=><section key={criterion.key}><h5>{labels[criterion.key]} · {criterion.contribution} pontos</h5><ul>{criterion.items.map((item,index)=><li key={index}>{item.requirement}: {item.explanation}<p>Vaga: {item.jobEvidence??'não identificado'} · Perfil: {item.profileEvidence??'não comprovado'}</p></li>)}</ul></section>)}</div>}</details>
  </section>;
}
