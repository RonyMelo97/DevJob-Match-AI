import { profileSchema, type ResumeDraft } from '../../../../../packages/contracts/src/index.js';

const headings: Record<string, string[]> = {
  objective: ['objetivo', 'objective'],
  summary: ['resumo profissional', 'resumo', 'professional summary', 'summary'],
  skills: ['competencias tecnicas', 'habilidades', 'competencias', 'skills', 'technical skills'],
  experience: ['experiencia profissional', 'experiencias profissionais', 'experiencia', 'professional experience', 'experience'],
  education: ['formacao', 'formacao academica', 'education'],
  languages: ['idiomas', 'languages'],
  other: ['diferenciais', 'projetos', 'certificacoes', 'projects', 'certifications'],
};
function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[:\s]+$/g, '').trim();
}
const technologies = ['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'SCSS', 'SASS', 'jQuery', 'PHP', 'SQL', 'MySQL', 'Git', 'GitFlow', 'BEM', 'Bootstrap', 'Figma', 'Photoshop', 'Scrum', 'Kanban', 'Next.js', 'Node.js'];

export function extractProfile(sourceText: string, pages: number): ResumeDraft {
  const sections: Record<string, string[]> = {};
  let current = 'other';
  for (const line of sourceText.split('\n')) {
    const heading = Object.entries(headings).find(([, names]) => names.includes(normalize(line)));
    if (heading) { current = heading[0]; continue; }
    (sections[current] ??= []).push(line);
  }
  const section = (key: string): string => (sections[key] ?? []).join('\n').trim();
  // Detect mentions, not expertise. Negation and context must be reviewed by the user.
  const evidence = technologies.flatMap((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?:[35](?!\\d))?(?![\\p{L}\\p{N}])`, 'iu');
    const excerpt = sourceText.split('\n').find((line) => pattern.test(line));
    return excerpt ? [{ skill, excerpt: excerpt.slice(0, 1000) }] : [];
  });
  const profile = profileSchema.parse({
    objective: section('objective').slice(0, 500),
    summary: section('summary').slice(0, 10_000),
    skills: evidence.map((item) => item.skill),
    experience: section('experience').slice(0, 30_000),
    education: section('education').slice(0, 10_000),
    languages: section('languages').slice(0, 2000),
  });
  return { sourceText, pages, profile, evidence, warnings: [
    'Tecnologias são menções detectadas, não comprovação de proficiência. Revise contexto e possíveis negações.',
    'A extração por títulos pode não reconhecer todas as seções. Consulte o texto original e corrija os campos.',
    'Anos de experiência, senioridade e nível de idioma não são inferidos automaticamente.',
  ] };
}
