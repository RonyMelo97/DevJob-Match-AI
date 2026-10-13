import { useEffect, useState } from 'react';
import { z } from 'zod';
import { MAX_PDF_BYTES, draftSchema, profileSchema, savedProfileSchema, type ResumeDraft, type ResumeProfile, type SavedProfile } from '@devjob/contracts';
import styles from './ResumePanel.module.css';

const savedResponse = z.object({ saved: savedProfileSchema.nullable() });
type EditableField = 'objective' | 'summary' | 'experience' | 'education' | 'languages';
const fields: { name: EditableField; label: string; limit: number }[] = [
  { name: 'objective', label: 'Objetivo profissional', limit: 500 },
  { name: 'summary', label: 'Resumo profissional', limit: 10_000 },
  { name: 'experience', label: 'Experiências e atividades', limit: 30_000 },
  { name: 'education', label: 'Formação', limit: 10_000 },
  { name: 'languages', label: 'Idiomas e níveis informados', limit: 2000 },
];
async function readResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = z.object({ message: z.string() }).safeParse(body);
    throw new Error(parsed.success ? parsed.data.message : 'Não foi possível concluir a operação.');
  }
  return response.json() as Promise<unknown>;
}

export function ResumePanel(): React.JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [skills, setSkills] = useState<string>('');
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [reviewed, setReviewed] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(true);
  const [message, setMessage] = useState<string>('Carregando perfil…');
  const [error, setError] = useState<string>('');
  const [deleteRequested, setDeleteRequested] = useState<boolean>(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/profile', { signal: controller.signal }).then(readResponse).then((body) => {
      if (controller.signal.aborted) return;
      const result = savedResponse.parse(body);
      setSaved(result.saved);
      setProfile(result.saved?.profile ?? null);
      setSkills(result.saved?.profile.skills.join(', ') ?? '');
      setMessage(result.saved ? 'Perfil salvo carregado. Você pode revisá-lo ou substituí-lo.' : 'Envie seu currículo para começar.');
    }).catch(() => { if (!controller.signal.aborted) { setError('Não foi possível carregar o perfil. Confira a conexão com a API e recarregue a página.'); setMessage(''); } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, []);

  async function upload(): Promise<void> {
    if (!file) { setError('Selecione um PDF.'); return; }
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > MAX_PDF_BYTES) { setError('Escolha um PDF de até 5 MB.'); return; }
    setBusy(true); setError(''); setMessage('Extraindo texto localmente…');
    try {
      const form = new FormData(); form.append('resume', file);
      const result = draftSchema.parse(await readResponse(await fetch('/api/resumes/extract', { method: 'POST', body: form })));
      setDraft(result); setProfile(result.profile); setSkills(result.profile.skills.join(', ')); setReviewed(false);
      setMessage(`Texto extraído de ${result.pages} página(s). Revise antes de salvar.`);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Falha na extração.'); setMessage(''); }
    finally { setBusy(false); }
  }
  async function save(): Promise<void> {
    if (!profile || !reviewed) return;
    setBusy(true); setError('');
    try {
      const result = profileSchema.parse({ ...profile, skills: [...new Set(skills.split(',').map((value) => value.trim()).filter(Boolean))] });
      const response = savedResponse.parse(await readResponse(await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: result, reviewed: true }) })));
      setSaved(response.saved); setProfile(result); setDraft(null); setReviewed(false); setFile(null);
      setMessage('Perfil revisado salvo no seu computador. O PDF e o texto bruto não foram armazenados.');
    } catch (cause: unknown) { setError(cause instanceof z.ZodError ? 'Confira os limites dos campos e das tecnologias (até 100 itens de 100 caracteres).' : cause instanceof Error ? cause.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }
  async function remove(): Promise<void> {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/profile', { method: 'DELETE' });
      if (!response.ok) await readResponse(response);
      setSaved(null); setProfile(null); setDraft(null); setFile(null); setSkills(''); setReviewed(false); setDeleteRequested(false);
      setMessage('Perfil excluído do armazenamento local.');
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Falha ao excluir.'); }
    finally { setBusy(false); }
  }
  function change(name: EditableField, value: string): void {
    setProfile((current) => current ? { ...current, [name]: value } : current); setReviewed(false);
  }
  return <section className={styles.panel} aria-labelledby="resume-title">
    <h2 id="resume-title">Seu perfil profissional</h2>
    <p>PDF de até 5 MB e 20 páginas, com texto selecionável. Processamento local, sem envio a provedores de IA.</p>
    <div className={styles.upload}>
      <label htmlFor="resume-file">Currículo em PDF</label>
      <input id="resume-file" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <button type="button" disabled={busy || !file} onClick={() => void upload()}>Extrair e revisar</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {draft && <>
      <ul>{draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      <details><summary>Consultar texto original extraído</summary><pre className={styles.source}>{draft.sourceText}</pre></details>
      <details><summary>Ver evidências das tecnologias sugeridas</summary><ul>{draft.evidence.map((item) => <li key={item.skill}><strong>{item.skill}:</strong> {item.excerpt}</li>)}</ul></details>
    </>}
    {profile && <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {fields.map((field) => <label className={styles.field} key={field.name} htmlFor={`profile-${field.name}`}>{field.label}<textarea id={`profile-${field.name}`} maxLength={field.limit} rows={field.name === 'objective' ? 2 : 4} value={profile[field.name]} disabled={busy} onChange={(event) => change(field.name, event.target.value)} /></label>)}
      <label className={styles.field} htmlFor="profile-skills">Tecnologias e habilidades (separadas por vírgula)<textarea id="profile-skills" rows={3} value={skills} maxLength={10_000} disabled={busy} onChange={(event) => { setSkills(event.target.value); setReviewed(false); }} /></label>
      <label className={styles.review}><input type="checkbox" checked={reviewed} disabled={busy} onChange={(event) => setReviewed(event.target.checked)} />Revisei os campos e confirmo que descrevem meu perfil.</label>
      <button disabled={busy || !reviewed} type="submit">Salvar perfil revisado</button>
      {draft && <button className={styles.secondary} type="button" disabled={busy} onClick={() => { setDraft(null); setProfile(saved?.profile ?? null); setSkills(saved?.profile.skills.join(', ') ?? ''); setReviewed(false); setMessage('Rascunho descartado.'); }}>Descartar rascunho</button>}
    </form>}
    {saved && <div className={styles.deletion}>
      <p>Salvo em {new Date(saved.savedAt).toLocaleString('pt-BR')}.</p>
      {deleteRequested ? <><p>Excluir o perfil salvo? Esta ação remove os dados locais e não pode ser desfeita.</p><button className={styles.danger} disabled={busy} onClick={() => void remove()}>Confirmar exclusão</button><button className={styles.secondary} disabled={busy} onClick={() => setDeleteRequested(false)}>Cancelar</button></> : <button className={styles.secondary} disabled={busy} onClick={() => setDeleteRequested(true)}>Excluir perfil salvo</button>}
    </div>}
  </section>;
}
