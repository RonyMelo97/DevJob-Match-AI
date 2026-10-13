import { analysisSchema, DEFAULT_WEIGHTS, weightsSchema, type Criterion, type Job, type MatchAnalysis, type MatchItem, type MatchWeights, type ResumeProfile } from '../../../../../packages/contracts/src/index.js';
import { normalized } from '../jobs/rules.js';

type Technology = {name:string; pattern:RegExp};
const technologies:Technology[] = [
  {name:'React',pattern:/\breact(?:\.js|js)?\b(?!\s+native)/i},
  {name:'TypeScript',pattern:/\btypescript\b/i}, {name:'JavaScript',pattern:/\bjavascript\b/i},
  {name:'HTML',pattern:/\bhtml5?\b/i},{name:'CSS',pattern:/\bcss3?\b/i},
  {name:'SCSS',pattern:/\bscss\b/i},{name:'SASS',pattern:/\bsass\b/i},
  {name:'Next.js',pattern:/\bnext(?:\.js|js)\b/i},{name:'Node.js',pattern:/\bnode(?:\.js|js)\b/i},
  {name:'Git',pattern:/\bgit\b/i},{name:'Jest',pattern:/\bjest\b/i},
  {name:'Vitest',pattern:/\bvitest\b/i},{name:'Testing Library',pattern:/\btesting library\b/i},
  {name:'Cypress',pattern:/\bcypress\b/i},{name:'Playwright',pattern:/\bplaywright\b/i},
];
type Section = Criterion|'unknown';
type Clause = {text:string;section:Section};
function clauses(description:string):Clause[] {
  const tokens = description.split(/(nice to have|preferred qualifications|desejaveis|desejáveis|diferenciais|requisitos(?:\s+obrigat[oó]rios)?|requirements|must have|responsabilidades|responsibilities|qualifications|atividades)\s*:?/i);
  let section:Section='unknown';const result:Clause[]=[];
  for(const token of tokens) {
    const lower=normalized(token).trim();
    if(/^(nice to have|preferred qualifications|desejaveis|diferenciais)$/.test(lower)){section='desired';continue;}
    if(/^(requisitos(?:\s+obrigatorios)?|requirements|must have|qualifications)$/.test(lower)){section='required';continue;}
    if(/^(responsabilidades|responsibilities|atividades)$/.test(lower)){section='responsibilities';continue;}
    // Avoid splitting dotted technology names. Flattened HTML uses headings and sentences.
    for(const text of token.split(/\n|;|[.!?](?=\s|$)/).map((value)=>value.trim()).filter(Boolean))result.push({text,section});
  }
  return result;
}
function technologyItem(tech:Technology,evidence:string,profile:ResumeProfile):MatchItem {
  const lines=[...profile.skills,profile.summary,profile.experience].flatMap((value)=>value.split(/\n|;|[.!?](?=\s|$)/)).filter((line)=>tech.pattern.test(line));
  const negative=(line:string):boolean=>/\b(nao conheco|nao domino|nao tenho experiencia|no experience|do not know)\b/.test(normalized(line));
  const denied=lines.find((line)=> {
    const text=normalized(line);const position=text.search(tech.pattern);
    return /(?:nao conheco|nao domino|nao tenho experiencia(?:\s+(?:com|em))?|no experience(?:\s+(?:with|in))?|do not know)\s*$/.test(text.slice(0,position));
  });
  const learning=lines.find((line)=>/\b(estudando|aprendendo|aprofundamento|learning|studying|basico|basic)\b/.test(normalized(line)));
  const positive=lines.find((line)=>!negative(line)&&!/(nao informado|not specified|nao comprovad)/.test(normalized(line)));
  const status:MatchItem['status']=denied?'not_met':learning?'partial':positive?'met':'insufficient';
  return {requirement:tech.name,status,jobEvidence:evidence,profileEvidence:denied??learning??positive??null,explanation:denied?'O perfil revisado declara explicitamente ausência desta experiência.':learning?'O perfil informa estudo ou conhecimento básico; atendimento parcial.':positive?'Tecnologia declarada no perfil revisado; isso não comprova proficiência ou tempo de experiência.':'Tecnologia não comprovada no perfil. Ausência não significa desconhecimento.'};
}
function insufficient(requirement:string,evidence:string|null=null):MatchItem {
  return {requirement,status:'insufficient',jobEvidence:evidence,profileEvidence:null,explanation:'Informação insuficiente para avaliar este critério sem inferir experiências.'};
}
function years(text:string):number|null {
  const value=normalized(text);
  if(/\d\s*[-–]\s*\d/.test(value))return null;
  const match=value.match(/\b(\d{1,2})(?:\s*\+)?\s*(?:anos?|years?)\b/);
  return match?.[1]?Number(match[1]):null;
}
function level(text:string):'junior'|'mid'|'senior'|null {
  const value=normalized(text);
  if(/\b(nao|not|no experience)\b/.test(value))return null;
  if(/\b(senior|sr|staff|lead|principal)\b/.test(value))return 'senior';
  if(/\b(pleno|mid|intermediate)\b/.test(value))return 'mid';
  if(/\b(junior|jr|entry)\b/.test(value))return 'junior';
  return null;
}
export function analyzeMatch(job:Job,profile:ResumeProfile,inputWeights:MatchWeights=DEFAULT_WEIGHTS):MatchAnalysis {
  const weights=weightsSchema.parse(inputWeights);
  const parts=clauses(job.description);
  const groups:Record<Criterion,MatchItem[]>={required:[],experience:[],seniority:[],desired:[],responsibilities:[],language:[]};
  for(const section of ['required','desired'] as const) {
    for(const tech of technologies) {
      const clause=parts.find((part)=>part.section===section&&tech.pattern.test(part.text));
      if(clause)groups[section].push(technologyItem(tech,clause.text,profile));
    }
    for(const clause of parts.filter((part)=>part.section===section)) {
      if(!technologies.some((tech)=>tech.pattern.test(clause.text))&&years(clause.text)===null&&!/\b(ingles|english|espanhol|spanish)\b/.test(normalized(clause.text))) {
        groups[section].push(insufficient('Requisito não interpretado automaticamente',clause.text));
      }
    }
  }
  // Without a recognized requirement marker, mentions stay unknown rather than becoming mandatory.
  if(!groups.required.length)groups.required.push(insufficient('Tecnologias obrigatórias não identificadas com segurança'));
  if(!groups.desired.length)groups.desired.push(insufficient('Tecnologias desejáveis não identificadas com segurança'));
  const experienceClauses=parts.filter((part)=>part.section==='required'&&years(part.text)!==null&&/experiencia|experience/.test(normalized(part.text)));
  for(const clause of experienceClauses) {
    const requiredYears=years(clause.text)!;
    const scope=technologies.filter((tech)=>tech.pattern.test(clause.text));
    const candidates=[profile.summary,profile.experience].flatMap((text)=>text.split(/\n|;|[.!?](?=\s|$)/))
      .filter((text)=>years(text)!==null&&/experiencia|experience/.test(normalized(text))&&scope.every((tech)=>tech.pattern.test(text))&&!/nao|not |no experience|aprendendo|estudando|aprofundamento|learning|studying/.test(normalized(text)));
    const best=candidates.sort((a,b)=>(years(b)??0)-(years(a)??0))[0];
    groups.experience.push(best?{requirement:clause.text,status:years(best)!>=requiredYears?'met':years(best)===0?'not_met':'partial',jobEvidence:clause.text,profileEvidence:best,explanation:years(best)!>=requiredYears?'Duração explicitamente declarada para o mesmo escopo.':years(best)===0?'O perfil declara zero anos para o escopo exigido.':'Duração declarada inferior à exigida; atendimento parcial.'}:insufficient(clause.text,clause.text));
  }
  if(!groups.experience.length)groups.experience.push(insufficient('Tempo de experiência exigido não identificado'));
  const candidateLevel=level(profile.objective);
  if(job.seniority==='unknown'||!candidateLevel)groups.seniority.push(insufficient('Senioridade',job.seniority==='unknown'?null:job.title));
  else {
    const order={junior:0,mid:1,senior:2};
    groups.seniority.push({requirement:`Senioridade: ${job.seniority}`,status:order[candidateLevel]>=order[job.seniority]?'met':'partial',jobEvidence:job.title,profileEvidence:profile.objective,explanation:'Comparação com senioridade explicitamente declarada no objetivo, sem inferir por tempo de carreira.'});
  }
  const activities=[{name:'Interfaces responsivas',pattern:/responsiv|responsive/i},{name:'Consumo de APIs',pattern:/\bapis?\b|rest api/i},{name:'Performance',pattern:/performance|desempenho/i},{name:'Acessibilidade',pattern:/acessibilidade|accessibility/i},{name:'Testes automatizados',pattern:/testes automatizados|automated tests|automated testing/i}];
  for(const activity of activities) {
    const clause=parts.find((part)=>part.section==='responsibilities'&&activity.pattern.test(part.text));
    if(!clause)continue;
    const evidence=profile.experience.split(/\n|;|[.!?](?=\s|$)/).find((line)=>activity.pattern.test(line)&&!/nao|not |no experience/i.test(line));
    groups.responsibilities.push(evidence?{requirement:activity.name,status:'met',jobEvidence:clause.text,profileEvidence:evidence,explanation:'Atividade registrada no campo de experiências revisado.'}:insufficient(activity.name,clause.text));
  }
  if(!groups.responsibilities.length)groups.responsibilities.push(insufficient('Responsabilidades não identificadas com segurança'));
  for(const language of [{name:'Inglês',pattern:/\b(ingles|english)\b/i},{name:'Espanhol',pattern:/\b(espanhol|spanish)\b/i}]) {
    const clause=parts.find((part)=>part.section==='required'&&language.pattern.test(normalized(part.text)));
    if(!clause)continue;
    const evidence=profile.languages.split(/\n|;/).find((line)=>language.pattern.test(normalized(line)));
    let item=insufficient(language.name,clause.text);
    if(evidence) {
      const demanded=normalized(clause.text);const stated=normalized(evidence);
      const band=(text:string):number|null=>/nativo|native|fluente|fluent|c2|c1|advanced|avancado/.test(text)?3:/intermediate|intermediario|b2|b1/.test(text)?2:/basic|basico|a2|a1/.test(text)?1:null;
      const requiredBand=band(demanded),candidateBand=band(stated);
      if(/nao falo|do not speak/.test(stated))item={...item,status:'not_met',profileEvidence:evidence,explanation:'O perfil declara explicitamente não falar o idioma.'};
      else if(requiredBand!==null&&candidateBand!==null)item={...item,status:candidateBand>=requiredBand?'met':'partial',profileEvidence:evidence,explanation:'Comparação entre níveis de idioma explicitamente declarados; sem certificação inferida.'};
      else item={...item,profileEvidence:evidence,explanation:'Idioma citado, mas nível exigido ou declarado não identificado com segurança.'};
    }
    groups.language.push(item);
  }
  if(!groups.language.length)groups.language.push(insufficient('Idioma exigido não identificado'));
  let coverage=0,total=0;
  const criteria=(Object.keys(weights) as Criterion[]).map((key)=> {
    const items=groups[key];const weight=weights[key];
    const known=items.filter((item)=>item.status!=='insufficient').length/items.length;
    const fraction=items.reduce((sum,item)=>sum+(item.status==='met'?1:item.status==='partial'?.5:0),0)/items.length;
    coverage+=weight*known;const contribution=weight*fraction;total+=contribution;
    return {key,weight,contribution:Math.round(contribution*100)/100,items};
  });
  return analysisSchema.parse({engineVersion:'0.4.0',score:coverage>0?Math.round(total*100)/100:null,coverage:Math.round(coverage*100)/100,weights,criteria,warnings:['Estimativa de compatibilidade, não probabilidade de contratação.','Critérios sem evidência recebem zero pontos; a cobertura mostra quanto pôde ser avaliado. Não normalizamos o score pelos poucos critérios conhecidos.','A cobertura se refere aos critérios identificados pelo motor, não garante compreensão de todos os requisitos da descrição.','Regras de extração reconhecem apenas títulos, tecnologias e padrões explícitos. Revise a descrição original; não há análise semântica por IA.']});
}
