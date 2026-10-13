import type { Job,MatchAnalysis } from '@devjob/contracts';

export type JobResult={job:Job;analysis:MatchAnalysis|null};
export type JobFilters={search:string;seniority:'all'|Job['seniority'];modality:'all'|Job['modality'];eligibility:'all'|Job['eligibility'];source:'all'|Job['source'];scoreState:'all'|'scored'|'unscored';minScore:number;minCoverage:number;sort:'recent'|'score'|'coverage'|'company'};
export const DEFAULT_FILTERS:JobFilters={search:'',seniority:'all',modality:'all',eligibility:'all',source:'all',scoreState:'all',minScore:0,minCoverage:0,sort:'recent'};
function normalize(value:string):string{return value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();}
export function filterJobs(results:JobResult[],filters:JobFilters):JobResult[]{
  const terms=normalize(filters.search).trim().split(/\s+/).filter(Boolean);
  const filtered=results.filter(({job,analysis})=>{
    const text=normalize(`${job.title} ${job.company} ${job.description} ${job.candidateLocation??''}`);
    const score=analysis?.score??null;
    return terms.every((term)=>text.includes(term))
      &&(filters.seniority==='all'||job.seniority===filters.seniority)
      &&(filters.modality==='all'||job.modality===filters.modality)
      &&(filters.eligibility==='all'||job.eligibility===filters.eligibility)
      &&(filters.source==='all'||job.source===filters.source)
      &&(filters.scoreState==='all'||(filters.scoreState==='scored'?score!==null:score===null))
      &&(filters.minScore===0||(score!==null&&score>=filters.minScore))
      &&(filters.minCoverage===0||(analysis!==null&&analysis.coverage>=filters.minCoverage));
  });
  return filtered.sort((a,b)=>{
    let difference=0;
    if(filters.sort==='score')difference=(b.analysis?.score??-1)-(a.analysis?.score??-1)||(b.analysis?.coverage??-1)-(a.analysis?.coverage??-1);
    if(filters.sort==='coverage')difference=(b.analysis?.coverage??-1)-(a.analysis?.coverage??-1);
    if(filters.sort==='company')difference=a.job.company.localeCompare(b.job.company,'pt-BR');
    if(filters.sort==='recent')difference=(b.job.publicationRaw??'').localeCompare(a.job.publicationRaw??'');
    return difference||a.job.id.localeCompare(b.job.id);
  });
}
export function paginateJobs(results:JobResult[],requestedPage:number,pageSize=10):{items:JobResult[];page:number;pages:number}{
  const size=Math.max(1,Math.floor(pageSize));const pages=Math.max(1,Math.ceil(results.length/size));const page=Math.max(1,Math.min(pages,Math.floor(requestedPage)));
  return{items:results.slice((page-1)*size,page*size),page,pages};
}
