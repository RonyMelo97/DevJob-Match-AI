import { DEFAULT_FILTERS,type JobFilters as Filters } from '../features/jobs/filter-jobs';
import styles from './JobsPanel.module.css';

export function JobFilters({filters,onChange,hasAnalysis}:{filters:Filters;onChange:(value:Filters)=>void;hasAnalysis:boolean}):React.JSX.Element{
  function update<K extends keyof Filters>(key:K,value:Filters[K]):void{onChange({...filters,[key]:value});}
  return <fieldset className={styles.filters}><legend>Filtrar vagas carregadas</legend>
    <label>Buscar cargo, empresa ou tecnologia<input type="search" value={filters.search} onChange={(event)=>update('search',event.target.value)} placeholder="Ex.: React São Paulo"/></label>
    <label>Senioridade<select value={filters.seniority} onChange={(event)=>update('seniority',event.target.value as Filters['seniority'])}><option value="all">Todas as disponíveis</option><option value="junior">Júnior</option><option value="mid">Pleno</option><option value="unknown">Não informada</option></select></label>
    <label>Modalidade<select value={filters.modality} onChange={(event)=>update('modality',event.target.value as Filters['modality'])}><option value="all">Todas</option><option value="remote">Remoto</option><option value="hybrid">Híbrido</option><option value="onsite">Presencial</option><option value="unknown">Não informada</option></select></label>
    <label>Elegibilidade<select value={filters.eligibility} onChange={(event)=>update('eligibility',event.target.value as Filters['eligibility'])}><option value="all">Confirmada e pendente</option><option value="eligible">Confirmada pelas regras</option><option value="unconfirmed">Pendente de confirmação</option></select></label>
    <label>Fonte<select value={filters.source} onChange={(event)=>update('source',event.target.value as Filters['source'])}><option value="all">Todas</option><option value="remotive">Remotive</option><option value="greenhouse">Greenhouse</option></select></label>
    <label>Resultado de compatibilidade<select value={filters.scoreState} onChange={(event)=>update('scoreState',event.target.value as Filters['scoreState'])}><option value="all">Todos</option><option value="scored">Com score calculável</option><option value="unscored">Sem score calculável</option></select></label>
    <label>Compatibilidade mínima (%)<input type="number" min={0} max={100} step={1} value={filters.minScore} disabled={!hasAnalysis} onChange={(event)=>update('minScore',Math.max(0,Math.min(100,Number(event.target.value))))}/></label>
    <label>Cobertura mínima (%)<input type="number" min={0} max={100} step={1} value={filters.minCoverage} disabled={!hasAnalysis} onChange={(event)=>update('minCoverage',Math.max(0,Math.min(100,Number(event.target.value))))}/></label>
    <label>Ordenar por<select value={filters.sort} onChange={(event)=>update('sort',event.target.value as Filters['sort'])}><option value="recent">Publicação na fonte</option><option value="score" disabled={!hasAnalysis}>Compatibilidade</option><option value="coverage" disabled={!hasAnalysis}>Cobertura</option><option value="company">Empresa</option></select></label>
    <button type="button" onClick={()=>onChange({...DEFAULT_FILTERS})}>Limpar filtros</button>
    {!hasAnalysis&&<p>Calcule a compatibilidade para habilitar os filtros por percentual.</p>}
  </fieldset>;
}
