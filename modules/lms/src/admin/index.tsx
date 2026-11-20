/**
 * Interface d'administration du module LMS (français, mobile d'abord).
 * Composants : SDK Snapify (@snapify/sdk/admin), comme les modules CRM et ERP. Les routes serveur renvoient { ok, data | error }.
 * Cinq pages : tableau de bord, cours (éditeur), mon apprentissage (lecteur + quiz), inscriptions et suivi, certificats.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Award, BookOpen, Check, Download, GraduationCap, Plus, Search, Upload, Users, X } from 'lucide-react';
import {
  Badge, Button, Card, defineAdminModule, EmptyState, ErrorState, errorMessage, fmtDate, Input, PageHeader, PageSkeleton,
  Pagination, Select, StatCard, Table, Td, Th, toast, useAsync, useConfirm, usePaging, type AdminPageProps,
} from '@snapify/sdk/admin';

type Env<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
type Props = AdminPageProps<Record<string, never>>;
type Api = Props['api'];
const call = async <T,>(p: Promise<Env<T>>): Promise<T> => { const r = await p; if (!r.ok) throw new Error(r.error.message); return r.data; };
const get = <T,>(api: Api, path: string, params: Record<string, string | number | undefined> = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  return call<T>(api.get<Env<T>>(`${path}${qs.toString() ? `?${qs}` : ''}`));
};
const post = <T,>(api: Api, path: string, body: unknown) => call<T>(api.post<Env<T>>(path, body));
const fail = (e: unknown) => toast.error(errorMessage(e));

interface Resume { enrollmentId: string; courseId: string; faites: number; total: number; pourcent: number; leconsFaites: string[]; quiz: { requis: boolean; reussi: boolean; tentatives: number; meilleurScore: number | null; restantes: number | null; seuil: number | null }; termine: boolean; certificatId: string | null; certificatCode: string | null }
interface CourseRow { id: string; createdAt: string; titre: string; description: string; niveau: string; statut: string; instructeurNom: string; nbLecons: number; dureeMin: number; inscription: Resume | null; peutGerer: boolean; inscrits: number | null }
type MediaType = 'video' | 'image' | 'document' | 'lien';
interface Media { type: MediaType; titre: string; url: string }
interface Lecon { id: string; titre: string; type: 'texte' | 'video' | 'lien'; contenu: string; medias?: Media[]; nbMedias?: number; dureeMin: number }
interface Chap { id: string; titre: string; lessons: Lecon[] }
interface Question { id: string; enonce: string; choix: string[]; multiple: boolean; bonnes?: number[] }
interface Quiz { id: string; titre: string; seuil: number; tentativesMax: number; questions: Question[] }
interface Detail { course: { id: string; titre: string; description: string; niveau: string; statut: string; instructeurNom: string; meetUrl?: string; meetHoraire?: string; feedbackUrl?: string }; peutGerer: boolean; chapters: Chap[]; quiz: Quiz | null; inscription: Resume | null }
interface Dash { global: { cours: number; publies: number; inscriptions: number; termines: number; tauxAchevement: number; certificats: number; inactifs: number }; parCours: { id: string; titre: string; statut: string; inscrits: number; termines: number; tauxAchevement: number; scoreMoyen: number | null; inactifs: number }[] }
interface Enr { id: string; courseId: string; apprenantNom: string; apprenantEmail: string; inscritAt: string; statut: string; coursTitre: string; resume: Resume }
interface ImportReport { total: number; created: number; duplicates: { line: number; email: string; reason: 'dans_le_fichier' | 'deja_inscrit' }[]; errors: { line: number; message: string }[] }
interface Cert { id: string; code: string; apprenantNom: string; coursTitre: string; delivreAt: string; integre: boolean }

const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400';
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}</label>;
const TONES = { green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200', red: 'bg-red-50 text-red-700 ring-red-200', slate: 'bg-slate-100 text-slate-700 ring-slate-200' };
const Pill = ({ tone = 'slate', children }: { tone?: keyof typeof TONES; children: ReactNode }) => <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
const STATUT: Record<string, [string, keyof typeof TONES]> = { brouillon: ['Brouillon', 'slate'], publie: ['Publié', 'green'], archive: ['Archivé', 'amber'] };
const NIVEAU: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const LEVELS = Object.entries(NIVEAU).map(([value, label]) => ({ value, label }));
const Loading = ({ error, reload }: { error?: string | null; reload: () => void }) => (error ? <ErrorState message={error} onRetry={reload} /> : <PageSkeleton />);
const Bar = ({ pct }: { pct: number }) => <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>;
const hhmm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`);

function saveBase64(name: string, base64: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
const download = async (api: Api, id: string) => { try { const f = await get<{ filename: string; base64: string }>(api, '/certificat/pdf', { id }); saveBase64(f.filename, f.base64, 'application/pdf'); } catch (e) { fail(e); } };
/** Adresse d'intégration : seulement YouTube et Vimeo, jamais une adresse arbitraire dans un cadre. */
function embedUrl(u: string): string | null {
  try {
    const x = new URL(u);
    const host = x.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' && x.pathname === '/watch' && /^[\w-]{6,20}$/.test(x.searchParams.get('v') ?? '')) return `https://www.youtube-nocookie.com/embed/${x.searchParams.get('v')}`;
    if (host === 'youtu.be' && /^\/[\w-]{6,20}$/.test(x.pathname)) return `https://www.youtube-nocookie.com/embed${x.pathname}`;
    if (host === 'vimeo.com' && /^\/\d{5,12}$/.test(x.pathname)) return `https://player.vimeo.com/video${x.pathname}`;
  } catch { /* adresse invalide */ }
  return null;
}
const MEDIA_MAX = 20;
/** Devine le type d'un média d'après son adresse (YouTube/Vimeo, extension d'image ou de document) ; le formateur peut toujours le changer à la main. */
function guessMediaType(url: string): MediaType {
  try {
    const u = url.trim();
    if (embedUrl(u)) return 'video';
    const path = new URL(u).pathname.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(path)) return 'image';
    if (/\.(pdf|docx?|pptx?|xlsx?|odt|ods|odp|zip)$/.test(path)) return 'document';
    if (/\.(mp4|webm|mov)$/.test(path)) return 'video';
  } catch { /* adresse incomplète */ }
  return 'lien';
}
const MEDIA_OPTIONS: { value: MediaType; label: string }[] = [{ value: 'video', label: 'Vidéo' }, { value: 'image', label: 'Image' }, { value: 'document', label: 'Document (PDF…)' }, { value: 'lien', label: 'Lien externe' }];
const MEDIA_LINK: Record<MediaType, string> = { video: 'Ouvrir la vidéo dans un nouvel onglet', image: 'Ouvrir l’image en grand', document: 'Ouvrir le document', lien: 'Ouvrir la ressource dans un nouvel onglet' };
/** Un média complémentaire, tel que le voit l'apprenant : vidéo YouTube/Vimeo intégrée, image affichée, document et lien ouverts dans un nouvel onglet. */
function MediaItem({ media }: { media: Media }) {
  const embed = media.type === 'video' ? embedUrl(media.url) : null;
  const caption = media.titre && (media.type === 'image' || media.type === 'video') ? media.titre : '';
  const label = media.titre && (media.type === 'document' || media.type === 'lien') ? media.titre : MEDIA_LINK[media.type];
  return (
    <figure className="space-y-2">
      {caption ? <figcaption className="text-sm font-medium text-slate-900">{caption}</figcaption> : null}
      {media.type === 'image' ? <a href={media.url} target="_blank" rel="noopener noreferrer"><img src={media.url} alt={media.titre} loading="lazy" referrerPolicy="no-referrer" className="max-h-[28rem] w-auto max-w-full rounded-lg border border-slate-200" /></a> : null}
      {embed ? <div className="aspect-video w-full overflow-hidden rounded-lg"><iframe src={embed} title={media.titre || 'Vidéo'} loading="lazy" className="h-full w-full" sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div> : null}
      <a href={media.url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-sky-700 underline">{label}</a>
    </figure>
  );
}
/** Contenu d'une leçon pour un inscrit : contenu principal (texte, vidéo ou lien) puis médias complémentaires, dans l'ordre. */
function LessonBody({ lesson }: { lesson: Lecon }) {
  const embed = lesson.type === 'video' ? embedUrl(lesson.contenu) : null;
  return (
    <div className="space-y-4">
      {lesson.type === 'texte' ? (lesson.contenu ? <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{lesson.contenu}</div> : null) : (<>
        {embed ? <div className="aspect-video w-full overflow-hidden rounded-lg"><iframe src={embed} title={lesson.titre} loading="lazy" className="h-full w-full" sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div> : null}
        <a href={lesson.contenu} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-sky-700 underline">{lesson.type === 'video' ? 'Ouvrir la vidéo dans un nouvel onglet' : 'Ouvrir la ressource dans un nouvel onglet'}</a></>)}
      {(lesson.medias ?? []).map((m, i) => <MediaItem key={i} media={m} />)}
    </div>
  );
}
/** Fait une action serveur avec message de succès, rechargement et gestion d'erreur. */
const useAct = (reload: () => Promise<void> | void) => {
  const [busy, setBusy] = useState(false);
  return { busy, act: async (fn: () => Promise<unknown>, ok?: string) => { setBusy(true); try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { fail(e); } finally { setBusy(false); } } };
};
// ───────── Briques communes (même présentation que le module CRM) ─────────
function saveText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
/** Lit un fichier .csv ou .xlsx et renvoie son contenu au format CSV (1re feuille pour Excel). */
async function fileToCsv(file: File): Promise<string> {
  if (!/\.xlsx$/i.test(file.name)) {
    if (/\.xls$/i.test(file.name)) throw new Error('Format .xls non pris en charge : enregistrez le fichier en .xlsx ou .csv');
    return file.text();
  }
  const { default: readXlsxFile } = await import('read-excel-file');
  const cell = (v: unknown) => {
    const t = v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return /[",;\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return (await readXlsxFile(file)).map((r) => r.map(cell).join(',')).join('\r\n');
}
const exportCsv = async (api: Api, path: string, name: string, params: Record<string, string | undefined> = {}) => {
  try { saveText(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, (await get<{ csv: string }>(api, path, params)).csv); } catch (e) { fail(e); }
};
/** Recherche insensible à la casse et aux accents. */
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const matches = (q: string, ...parts: string[]) => !q.trim() || norm(parts.join(' ')).includes(norm(q.trim()));
/** Pagination côté navigateur (les listes du module sont de taille raisonnable) ; revient à la page 1 quand les filtres changent. */
function useSlice<T>(key: string, rows: T[], resetKey: unknown) {
  const { page, setPage, pageSize, setPageSize } = usePaging(key, { resetKey });
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, setPage, pageSize, setPageSize };
}
const ImportButton = ({ busy, onFile }: { busy: boolean; onFile: (f: File) => void }) => (
  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-black hover:bg-slate-50">
    <Upload className="h-4 w-4" />{busy ? 'Import…' : 'Importer CSV / Excel'}
    <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
  </label>
);
/** Barre de recherche + filtres au-dessus d'un tableau (Card padded={false}). */
const Toolbar = ({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children?: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
    <div className="relative min-w-[220px] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
    {children}
  </div>
);
const ALL = (label: string) => ({ value: '', label });

/** Défilement doux (désactivé si l'utilisateur préfère moins d'animations) ; scrollIntoView fonctionne dans le conteneur défilant du back-office comme dans la page. */
const scrollToEl = (el: HTMLElement | null) => {
  if (!el) return;
  el.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  el.focus?.({ preventScroll: true });
};
const sub = (p: Props) => p.subpath.split('/').filter(Boolean)[0] ?? '';

// ───────────────────────── Tableau de bord ─────────────────────────
function DashboardPage({ api }: Props) {
  const d = useAsync(() => get<Dash>(api, '/dashboard'), [api]);
  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />;
  if (!d.data) return <PageSkeleton />;
  const x = d.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Formation — Tableau de bord" description="Inscriptions, achèvement, résultats aux quiz et apprenants inactifs par cours." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Cours publiés" value={`${x.global.publies} / ${x.global.cours}`} icon={BookOpen} tone="sky" />
        <StatCard label="Inscriptions" value={x.global.inscriptions} icon={Users} />
        <StatCard label="Taux d’achèvement" value={`${x.global.tauxAchevement} %`} icon={Check} tone="sky" />
        <StatCard label="Certificats délivrés" value={x.global.certificats} icon={Award} />
        <StatCard label="Apprenants inactifs" value={x.global.inactifs} icon={Users} tone={x.global.inactifs ? 'amber' : 'sky'} />
      </div>
      <Card padded={false}>
        {!x.parCours.length ? <EmptyState icon={BookOpen} title="Aucun cours" description="Créez votre premier cours dans la page « Cours »." /> : (
          <Table>
            <thead><tr><Th>Cours</Th><Th>Statut</Th><Th>Inscrits</Th><Th>Terminés</Th><Th>Score moyen</Th><Th>Inactifs</Th></tr></thead>
            <tbody>{x.parCours.map((c) => (
              <tr key={c.id}>
                <Td><p className="font-medium text-slate-900">{c.titre}</p></Td>
                <Td><Pill tone={STATUT[c.statut][1]}>{STATUT[c.statut][0]}</Pill></Td>
                <Td>{c.inscrits}</Td><Td>{c.termines}</Td>
                <Td>{c.scoreMoyen === null ? '—' : `${c.scoreMoyen} %`}</Td>
                <Td>{c.inactifs ? <Pill tone="amber">{c.inactifs}</Pill> : '0'}</Td>
              </tr>))}</tbody>
          </Table>)}
      </Card>
      {x.parCours.some((c) => c.inscrits > 0) && (
        <Card className="space-y-3">
          <h3 className="font-semibold text-slate-900">Achèvement par cours</h3>
          {x.parCours.filter((c) => c.inscrits > 0).map((c) => (
            <div key={c.id} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 truncate text-slate-700">{c.titre}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-700" style={{ width: `${c.tauxAchevement}%` }} /></div>
              <span className="w-12 text-right tabular-nums text-slate-600">{c.tauxAchevement} %</span>
            </div>))}
          <p className="text-xs text-slate-500">Inactif = inscrit, cours non terminé et aucune activité depuis 14 jours.</p>
        </Card>)}
    </div>
  );
}

// ───────────────────────── Cours (liste + éditeur) ─────────────────────────
function CoursPage(props: Props) {
  const id = sub(props);
  return id ? <CourseEditor {...props} id={id} /> : <CourseList {...props} />;
}

function CourseList({ api, navigate }: Props) {
  const list = useAsync(() => get<CourseRow[]>(api, '/cours'), [api]);
  const { busy, act } = useAct(list.reload);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ titre: '', description: '', niveau: 'debutant' });
  const [q, setQ] = useState(''); const [statut, setStatut] = useState(''); const [niveau, setNiveau] = useState('');
  const rows = (list.data ?? []).filter((c) => (!statut || c.statut === statut) && (!niveau || c.niveau === niveau) && matches(q, c.titre, c.description, c.instructeurNom));
  const pg = useSlice('lms-cours', rows, { q, statut, niveau });
  const create = () => act(async () => { const c = await post<{ id: string }>(api, '/cours/save', f); setAdding(false); setF({ titre: '', description: '', niveau: 'debutant' }); navigate(`/${c.id}`); }, 'Cours créé');
  return (
    <div className="space-y-4">
      <PageHeader title="Cours" description="Créez et publiez vos cours : chapitres, leçons (texte, vidéo, lien) et quiz final." actions={
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={() => void exportCsv(api, '/inscriptions/export', 'suivi-formations')}>Exporter le suivi</Button>
          <Button icon={Plus} onClick={() => setAdding(true)}>Nouveau cours</Button>
        </div>} />
      {adding && (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Titre *"><Input value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} /></Field>
            <Field label="Niveau"><Select value={f.niveau} onChange={(v) => setF({ ...f, niveau: v })} options={LEVELS} /></Field>
          </div>
          <Field label="Description"><textarea className={field} rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={() => setAdding(false)}>Annuler</Button><Button loading={busy} disabled={f.titre.trim().length < 1} onClick={() => void create()}>Créer</Button></div>
        </Card>)}
      <Card padded={false}>
        <Toolbar value={q} onChange={setQ} placeholder="Titre, description ou formateur…">
          <Select value={statut} onChange={setStatut} className="w-40" options={[ALL('Tous les statuts'), ...Object.entries(STATUT).map(([value, [label]]) => ({ value, label }))]} />
          <Select value={niveau} onChange={setNiveau} className="w-44" options={[ALL('Tous les niveaux'), ...LEVELS]} />
        </Toolbar>
        {list.error ? <div className="p-4"><ErrorState message={list.error} onRetry={list.reload} /></div>
          : !list.data ? <PageSkeleton />
          : !pg.total ? <EmptyState icon={BookOpen} title="Aucun cours" description={list.data.length ? 'Aucun cours ne correspond à ces filtres.' : 'Créez votre premier cours pour commencer.'} />
          : (<>
            <Table>
              <thead><tr><Th>Cours</Th><Th>Niveau</Th><Th>Statut</Th><Th>Leçons</Th><Th>Durée</Th><Th>Inscrits</Th><Th>Créé le</Th></tr></thead>
              <tbody>{pg.rows.map((c) => (
                <tr key={c.id} className={c.peutGerer ? 'cursor-pointer hover:bg-slate-50/70' : ''} onClick={c.peutGerer ? () => navigate(`/${c.id}`) : undefined}>
                  <Td><p className="font-medium text-slate-900">{c.titre}</p><p className="truncate text-xs text-slate-500">{c.instructeurNom}</p></Td>
                  <Td><Badge>{NIVEAU[c.niveau]}</Badge></Td>
                  <Td><Pill tone={STATUT[c.statut][1]}>{STATUT[c.statut][0]}</Pill></Td>
                  <Td>{c.nbLecons}</Td><Td>{hhmm(c.dureeMin)}</Td><Td>{c.inscrits ?? '—'}</Td><Td>{fmtDate(c.createdAt)}</Td>
                </tr>))}</tbody>
            </Table>
            <Pagination page={pg.page} pageSize={pg.pageSize} total={pg.total} onPage={pg.setPage} onPageSize={pg.setPageSize} noun="cours" />
          </>)}
      </Card>
    </div>
  );
}

/** `manual` : le formateur a choisi le type lui-même (on ne le devine plus d'après l'adresse) ; retiré avant l'envoi. */
interface LessonDraft { titre: string; type: string; contenu: string; dureeMin: string; medias: (Media & { manual?: boolean })[] }
const emptyLesson: LessonDraft = { titre: '', type: 'texte', contenu: '', dureeMin: '5', medias: [] };
function LessonForm({ initial, typeLocked, onSave, onCancel, busy }: { initial: LessonDraft; typeLocked?: boolean; onSave: (l: LessonDraft) => void; onCancel: () => void; busy: boolean }) {
  const [l, setL] = useState(initial);
  const setMedia = (i: number, patch: Partial<Media>) => setL({ ...l, medias: l.medias.map((m, j) => {
    if (j !== i) return m;
    const next = { ...m, ...patch, ...(patch.type ? { manual: true } : {}) };
    return patch.url !== undefined && !next.manual ? { ...next, type: guessMediaType(patch.url) } : next;
  }) });
  const move = (i: number, d: -1 | 1) => { const next = [...l.medias]; [next[i], next[i + d]] = [next[i + d], next[i]]; setL({ ...l, medias: next }); };
  // Les lignes de média laissées sans adresse sont ignorées à l'enregistrement.
  const medias = l.medias.filter((m) => m.url.trim()).map(({ type, titre, url }) => ({ type, titre, url }));
  const textOptional = l.type === 'texte' && medias.length > 0; // une leçon peut n'être composée que de médias
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Titre de la leçon *"><Input value={l.titre} onChange={(e) => setL({ ...l, titre: e.target.value })} /></Field>
        <Field label="Type du contenu principal"><Select value={l.type} onChange={(v) => !typeLocked && setL({ ...l, type: v })} options={[{ value: 'texte', label: 'Texte' }, { value: 'video', label: 'Vidéo (adresse https)' }, { value: 'lien', label: 'Lien externe (https)' }]} /></Field>
        <Field label="Durée (min)"><Input type="number" value={l.dureeMin} onChange={(e) => setL({ ...l, dureeMin: e.target.value })} /></Field>
      </div>
      <Field label={l.type === 'texte' ? (textOptional ? 'Texte (facultatif quand la leçon a des médias)' : 'Contenu *') : 'Adresse https:// *'}>
        {l.type === 'texte' ? <textarea className={field} rows={5} value={l.contenu} onChange={(e) => setL({ ...l, contenu: e.target.value })} /> : <Input placeholder="https://…" value={l.contenu} onChange={(e) => setL({ ...l, contenu: e.target.value })} />}
      </Field>
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Médias complémentaires <span className="font-normal text-slate-500">({l.medias.length} / {MEDIA_MAX})</span></p>
        {l.medias.length === 0 ? <p className="text-xs text-slate-500">Ajoutez autant de vidéos, d’images, de documents ou de liens que nécessaire : ils s’affichent à la suite du contenu, dans l’ordre ci-dessous.</p> : null}
        {l.medias.map((m, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-slate-100 p-2">
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr_1.5fr]">
              <Select value={m.type} onChange={(v) => setMedia(i, { type: v as MediaType })} options={MEDIA_OPTIONS} />
              <Input placeholder="Titre (facultatif)" value={m.titre} onChange={(e) => setMedia(i, { titre: e.target.value })} />
              <Input placeholder="https://…" value={m.url} onChange={(e) => setMedia(i, { url: e.target.value })} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button icon={ArrowUp} disabled={i === 0} onClick={() => move(i, -1)}>Monter</Button>
              <Button icon={ArrowDown} disabled={i === l.medias.length - 1} onClick={() => move(i, 1)}>Descendre</Button>
              <Button icon={X} onClick={() => setL({ ...l, medias: l.medias.filter((_, j) => j !== i) })}>Retirer</Button>
            </div>
          </div>))}
        <Button icon={Plus} disabled={l.medias.length >= MEDIA_MAX} onClick={() => setL({ ...l, medias: [...l.medias, { type: 'video', titre: '', url: '' }] })}>Ajouter un média</Button>
      </div>
      <div className="flex justify-end gap-2"><Button onClick={onCancel}>Annuler</Button><Button loading={busy} disabled={!l.titre.trim() || (!l.contenu.trim() && !textOptional)} onClick={() => onSave({ ...l, medias })}>Enregistrer la leçon</Button></div>
    </div>
  );
}

function QuestionForm({ courseId, api, onDone }: { courseId: string; api: Api; onDone: () => void }) {
  const [q, setQ] = useState({ enonce: '', choix: ['', ''], bonnes: [] as number[] });
  const [busy, setBusy] = useState(false);
  const toggle = (i: number) => setQ({ ...q, bonnes: q.bonnes.includes(i) ? q.bonnes.filter((x) => x !== i) : [...q.bonnes, i] });
  const submit = async () => {
    setBusy(true);
    try { await post(api, '/question/save', { courseId, enonce: q.enonce, choix: q.choix, bonnes: q.bonnes }); toast.success('Question ajoutée'); setQ({ enonce: '', choix: ['', ''], bonnes: [] }); onDone(); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <Field label="Énoncé de la question"><Input value={q.enonce} onChange={(e) => setQ({ ...q, enonce: e.target.value })} /></Field>
      <p className="text-sm font-medium text-slate-700">Choix (cochez la ou les bonnes réponses)</p>
      {q.choix.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={q.bonnes.includes(i)} onChange={() => toggle(i)} aria-label={`Choix ${i + 1} correct`} />
          <Input value={c} placeholder={`Choix ${i + 1}`} onChange={(e) => setQ({ ...q, choix: q.choix.map((x, j) => (j === i ? e.target.value : x)) })} />
          <Button icon={X} disabled={q.choix.length <= 2} onClick={() => setQ({ ...q, choix: q.choix.filter((_, j) => j !== i), bonnes: q.bonnes.filter((b) => b !== i).map((b) => (b > i ? b - 1 : b)) })}>Retirer</Button>
        </div>))}
      <div className="flex flex-wrap justify-between gap-2">
        <Button icon={Plus} disabled={q.choix.length >= 6} onClick={() => setQ({ ...q, choix: [...q.choix, ''] })}>Ajouter un choix</Button>
        <Button loading={busy} disabled={!q.enonce.trim() || q.choix.some((c) => !c.trim()) || !q.bonnes.length} onClick={() => void submit()}>Ajouter la question</Button>
      </div>
    </div>
  );
}

function CourseEditor({ api, navigate, id }: Props & { id: string }) {
  const d = useAsync(() => get<Detail>(api, '/cours/detail', { id }), [id]);
  const { busy, act } = useAct(d.reload);
  const confirm = useConfirm();
  const [info, setInfo] = useState<{ titre: string; description: string; niveau: string; meetUrl: string; meetHoraire: string; feedbackUrl: string } | null>(null);
  const [chap, setChap] = useState('');
  const [lessonFor, setLessonFor] = useState<string | null>(null); // id du chapitre (ajout) ou de la leçon (édition)
  const [quiz, setQuiz] = useState<{ titre: string; seuil: string; tentativesMax: string } | null>(null);
  if (!d.data) return <Loading error={d.error} reload={d.reload} />;
  const c = d.data.course;
  const form = info ?? { titre: c.titre, description: c.description, niveau: c.niveau, meetUrl: c.meetUrl ?? '', meetHoraire: c.meetHoraire ?? '', feedbackUrl: c.feedbackUrl ?? '' };
  const qz = quiz ?? { titre: d.data.quiz?.titre ?? 'Quiz final', seuil: String(d.data.quiz?.seuil ?? 70), tentativesMax: String(d.data.quiz?.tentativesMax ?? 3) };
  const setStatut = (statut: string) => act(() => post(api, '/cours/statut', { id, statut }), 'Statut mis à jour');
  const archive = async (path: string, what: string, itemId: string) => { if (await confirm({ title: `Archiver ${what} ?`, message: 'Il disparaît du cours ; les résultats déjà enregistrés sont conservés.', confirmLabel: 'Archiver', danger: true })) await act(() => post(api, path, { id: itemId }), 'Archivé'); };
  return (
    <div className="space-y-4">
      <PageHeader title={c.titre} description={`${NIVEAU[c.niveau]} · ${c.instructeurNom}`} actions={<div className="flex flex-wrap items-center gap-2">
        <Pill tone={STATUT[c.statut][1]}>{STATUT[c.statut][0]}</Pill>
        {c.statut !== 'publie' ? <Button loading={busy} onClick={() => void setStatut('publie')}>Publier</Button> : <Button loading={busy} onClick={() => void setStatut('archive')}>Archiver le cours</Button>}
        <Button onClick={() => navigate('')}>Retour</Button></div>} />
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Titre"><Input value={form.titre} onChange={(e) => setInfo({ ...form, titre: e.target.value })} /></Field>
          <Field label="Niveau"><Select value={form.niveau} onChange={(v) => setInfo({ ...form, niveau: v })} options={LEVELS} /></Field>
        </div>
        <Field label="Description"><textarea className={field} rows={2} value={form.description} onChange={(e) => setInfo({ ...form, description: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lien Google Meet (séances en direct)"><Input type="url" inputMode="url" placeholder="https://meet.google.com/abc-defg-hij" value={form.meetUrl} onChange={(e) => setInfo({ ...form, meetUrl: e.target.value })} /></Field>
          <Field label="Jours et heure des séances"><Input placeholder="Chaque mardi, 18 h (heure de Tunis)" value={form.meetHoraire} onChange={(e) => setInfo({ ...form, meetHoraire: e.target.value })} /></Field>
        </div>
        <Field label="Formulaire d’avis des apprenants (facultatif)"><Input type="url" inputMode="url" placeholder="https://forms.gle/…" value={form.feedbackUrl} onChange={(e) => setInfo({ ...form, feedbackUrl: e.target.value })} /></Field>
        <p className="text-xs text-slate-500">Le lien Meet et le formulaire d’avis ne sont visibles que par les inscrits ; l’horaire est visible de tous.</p>
        <div className="flex justify-end"><Button loading={busy} disabled={!info} onClick={() => void act(async () => { await post(api, '/cours/save', { id, ...form }); setInfo(null); }, 'Cours enregistré')}>Enregistrer</Button></div>
      </Card>

      <h2 className="text-base font-semibold text-slate-900">Contenu</h2>
      {d.data.chapters.map((ch) => (
        <Card key={ch.id} className="space-y-3">
          <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{ch.titre}</h3><Button icon={X} onClick={() => void archive('/chapitre/archive', 'ce chapitre', ch.id)}>Archiver</Button></div>
          {ch.lessons.map((l) => lessonFor === l.id ? (
            <LessonForm key={l.id} typeLocked busy={busy} initial={{ titre: l.titre, type: l.type, contenu: l.contenu, dureeMin: String(l.dureeMin), medias: (l.medias ?? []).map((m) => ({ ...m, manual: true })) }} onCancel={() => setLessonFor(null)}
              onSave={(v) => void act(async () => { await post(api, '/lecon/save', { id: l.id, titre: v.titre, contenu: v.contenu, medias: v.medias, dureeMin: v.dureeMin }); setLessonFor(null); }, 'Leçon enregistrée')} />
          ) : (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <span><span className="font-medium text-slate-900">{l.titre}</span> <Pill>{l.type === 'texte' ? 'Texte' : l.type === 'video' ? 'Vidéo' : 'Lien'}</Pill>{(l.medias ?? []).length ? <> <Pill tone="green">+ {(l.medias ?? []).length} média{(l.medias ?? []).length > 1 ? 's' : ''}</Pill></> : null} <span className="text-slate-500">{hhmm(l.dureeMin)}</span></span>
              <span className="flex gap-2"><Button onClick={() => setLessonFor(l.id)}>Modifier</Button><Button icon={X} onClick={() => void archive('/lecon/archive', 'cette leçon', l.id)}>Archiver</Button></span>
            </div>))}
          {lessonFor === `new-${ch.id}` ? (
            <LessonForm busy={busy} initial={emptyLesson} onCancel={() => setLessonFor(null)} onSave={(v) => void act(async () => { await post(api, '/lecon/save', { courseId: id, chapterId: ch.id, ...v }); setLessonFor(null); }, 'Leçon ajoutée')} />
          ) : <Button icon={Plus} onClick={() => setLessonFor(`new-${ch.id}`)}>Ajouter une leçon</Button>}
        </Card>))}
      <Card className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1"><Field label="Nouveau chapitre"><Input value={chap} placeholder="Titre du chapitre" onChange={(e) => setChap(e.target.value)} /></Field></div>
        <Button icon={Plus} loading={busy} disabled={!chap.trim()} onClick={() => void act(async () => { await post(api, '/chapitre/save', { courseId: id, titre: chap }); setChap(''); }, 'Chapitre ajouté')}>Ajouter</Button>
      </Card>

      <h2 className="text-base font-semibold text-slate-900">Quiz final</h2>
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Titre"><Input value={qz.titre} onChange={(e) => setQuiz({ ...qz, titre: e.target.value })} /></Field>
          <Field label="Seuil de réussite (%)"><Input type="number" value={qz.seuil} onChange={(e) => setQuiz({ ...qz, seuil: e.target.value })} /></Field>
          <Field label="Tentatives max (0 = illimité)"><Input type="number" value={qz.tentativesMax} onChange={(e) => setQuiz({ ...qz, tentativesMax: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end"><Button loading={busy} onClick={() => void act(async () => { await post(api, '/quiz/save', { courseId: id, ...qz }); setQuiz(null); }, 'Quiz enregistré')}>{d.data.quiz ? 'Enregistrer le quiz' : 'Créer le quiz'}</Button></div>
        {d.data.quiz && (<>
          {d.data.quiz.questions.map((q, n) => (
            <div key={q.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex items-start justify-between gap-2"><p className="font-medium text-slate-900">{n + 1}. {q.enonce}</p><Button icon={X} onClick={() => void archive('/question/archive', 'cette question', q.id)}>Archiver</Button></div>
              <ul className="mt-1 space-y-0.5">{q.choix.map((c, i) => <li key={i} className={q.bonnes?.includes(i) ? 'font-medium text-emerald-700' : 'text-slate-600'}>{q.bonnes?.includes(i) ? '✓' : '○'} {c}</li>)}</ul>
            </div>))}
          <QuestionForm courseId={id} api={api} onDone={() => void d.reload()} />
        </>)}
      </Card>
    </div>
  );
}

// ───────────────────────── Mon apprentissage (catalogue + lecteur + quiz) ─────────────────────────
function ApprentissagePage(props: Props) {
  const id = sub(props);
  return id ? <Player {...props} id={id} /> : <Catalogue {...props} />;
}

function Catalogue({ api, navigate }: Props) {
  const list = useAsync(() => get<CourseRow[]>(api, '/cours'), [api]);
  const { busy, act } = useAct(list.reload);
  if (!list.data) return <Loading error={list.error} reload={list.reload} />;
  const mine = list.data.filter((c) => c.inscription);
  const open = list.data.filter((c) => !c.inscription && c.statut === 'publie');
  return (
    <div className="space-y-4">
      <PageHeader title="Mon apprentissage" description="Suivez vos cours, validez les leçons, passez les quiz et téléchargez vos certificats." />
      <h2 className="text-base font-semibold text-slate-900">Mes formations</h2>
      {!mine.length ? <Card><EmptyState icon={GraduationCap} title="Aucune inscription" description="Inscrivez-vous à un cours ci-dessous." /></Card> : (
        <div className="grid gap-3 sm:grid-cols-2">{mine.map((c) => (
          <Card key={c.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-slate-900">{c.titre}</h3>{c.inscription!.termine ? <Pill tone="green">Terminé</Pill> : <Pill tone="amber">En cours</Pill>}</div>
            <Bar pct={c.inscription!.pourcent} />
            <p className="text-xs text-slate-500">{c.inscription!.faites} / {c.inscription!.total} leçons · {c.inscription!.pourcent} %</p>
            <div className="flex flex-wrap gap-2"><Button onClick={() => navigate(`/${c.id}`)}>{c.inscription!.termine ? 'Revoir' : 'Continuer'}</Button>
              {c.inscription!.certificatId ? <Button icon={Download} onClick={() => void download(api, c.inscription!.certificatId!)}>Certificat</Button> : null}</div>
          </Card>))}</div>)}
      <h2 className="text-base font-semibold text-slate-900">Cours disponibles</h2>
      {!open.length ? <p className="text-sm text-slate-500">Aucun autre cours publié pour le moment.</p> : (
        <div className="grid gap-3 sm:grid-cols-2">{open.map((c) => (
          <Card key={c.id} className="space-y-2">
            <h3 className="font-semibold text-slate-900">{c.titre}</h3>
            <p className="text-sm text-slate-600">{c.description}</p>
            <p className="text-xs text-slate-500">{NIVEAU[c.niveau]} · {c.nbLecons} leçon(s) · {hhmm(c.dureeMin)} · {c.instructeurNom}</p>
            <Button loading={busy} onClick={() => void act(() => post(api, '/inscription/add', { courseId: c.id }), 'Inscription enregistrée')}>S’inscrire</Button>
          </Card>))}</div>)}
    </div>
  );
}

function Player({ api, navigate, id }: Props & { id: string }) {
  const d = useAsync(() => get<Detail>(api, '/cours/detail', { id }), [id]);
  const { busy, act } = useAct(d.reload);
  const [sel, setSel] = useState('');
  const panelRef = useRef<HTMLDivElement>(null), resultRef = useRef<HTMLDivElement>(null), navRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const nav = navRef.current, el = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!nav || !el) return;
    if (el.offsetTop < nav.scrollTop || el.offsetTop + el.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTop = Math.max(0, el.offsetTop - nav.clientHeight / 2);
  }, [sel, d.data]);
  const [answers, setAnswers] = useState<number[][]>([]);
  const [result, setResult] = useState<{ score: number; reussi: boolean; seuil: number; tentative: number; details: { questionId: string; correct: boolean }[] } | null>(null);
  if (!d.data) return <Loading error={d.error} reload={d.reload} />;
  const { course, chapters, quiz, inscription: ins } = d.data;
  const all = chapters.flatMap((c) => c.lessons);
  const cur = all.find((l) => l.id === sel) ?? all.find((l) => !ins?.leconsFaites.includes(l.id)) ?? all[0];
  const done = (lid: string) => !!ins?.leconsFaites.includes(lid);
  const allDone = !!ins && ins.total > 0 && ins.faites === ins.total;
  const questions = quiz?.questions ?? [];
  const ans = (qi: number) => answers[qi] ?? [];
  const pick = (qi: number, ci: number, multiple: boolean) => setAnswers((prev) => { const next = [...prev]; const cur2 = next[qi] ?? []; next[qi] = multiple ? (cur2.includes(ci) ? cur2.filter((x) => x !== ci) : [...cur2, ci]) : [ci]; return next; });
  const choose = (lid: string) => { setSel(lid); requestAnimationFrame(() => scrollToEl(panelRef.current)); };
  const submit = () => act(async () => { setResult(await post(api, '/quiz/soumettre', { enrollmentId: ins!.enrollmentId, reponses: questions.map((_, i) => ans(i)) })); }, undefined).then(() => requestAnimationFrame(() => scrollToEl(resultRef.current)));
  return (
    <div className="space-y-4">
      <PageHeader title={course.titre} description={course.description} />
      <div className="flex flex-wrap items-center gap-2"><Button onClick={() => navigate('')}>← Mes formations</Button>
        {ins?.certificatId ? <Button icon={Download} onClick={() => void download(api, ins.certificatId!)}>Télécharger mon certificat</Button> : null}</div>
      {!ins ? (
        <Card className="space-y-2"><p className="text-sm text-slate-700">Inscrivez-vous pour accéder au contenu des leçons.</p>
          {course.statut === 'publie' ? <Button loading={busy} onClick={() => void act(() => post(api, '/inscription/add', { courseId: id }), 'Inscription enregistrée')}>S’inscrire</Button> : null}</Card>
      ) : <Card className="space-y-1"><Bar pct={ins.pourcent} /><p className="text-xs text-slate-500">{ins.faites} / {ins.total} leçons · {ins.pourcent} %{ins.termine ? ' · cours terminé 🎉' : ''}</p></Card>}
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div ref={navRef} className="relative max-h-72 self-start overflow-y-auto overscroll-contain lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]"><Card className="space-y-3">{chapters.map((ch) => (
          <div key={ch.id}><p className="mb-1 text-sm font-semibold text-slate-900">{ch.titre}</p>
            <ul className="space-y-1">{ch.lessons.map((l) => (
              <li key={l.id}><button type="button" onClick={() => choose(l.id)} aria-current={cur?.id === l.id ? 'true' : undefined} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${cur?.id === l.id ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'}`}>
                <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${done(l.id) ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}>{done(l.id) ? '✓' : ''}</span>{l.titre}</button></li>))}</ul>
          </div>))}</Card></div>
        <div ref={panelRef} tabIndex={-1} className="scroll-mt-4 outline-none"><Card className="space-y-3">
          {!cur ? <EmptyState icon={BookOpen} title="Aucune leçon" description="Ce cours n’a pas encore de contenu." /> : (<>
            <h3 className="text-lg font-semibold text-slate-900">{cur.titre}</h3>
            {!ins ? <p className="text-sm text-slate-500">Contenu réservé aux inscrits{cur.nbMedias ? ` (${cur.nbMedias} média${cur.nbMedias > 1 ? 's' : ''} complémentaire${cur.nbMedias > 1 ? 's' : ''})` : ''}.</p> : <LessonBody lesson={cur} />}
            {ins ? (done(cur.id) ? <Pill tone="green">Leçon terminée</Pill> : <div><Button icon={Check} loading={busy} onClick={() => void act(() => post(api, '/lecon/terminer', { enrollmentId: ins.enrollmentId, lessonId: cur.id }), 'Leçon terminée')}>Marquer comme terminée</Button></div>) : null}
          </>)}
        </Card></div>
      </div>
      {ins && quiz && questions.length > 0 && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold text-slate-900">{quiz.titre}</h3>
            <span className="text-xs text-slate-500">Seuil {quiz.seuil} % · {ins.quiz.restantes === null ? 'tentatives illimitées' : `${ins.quiz.restantes} tentative(s) restante(s)`}{ins.quiz.meilleurScore !== null ? ` · meilleur score ${ins.quiz.meilleurScore} %` : ''}</span></div>
          {!allDone ? <p className="text-sm text-slate-600">Terminez toutes les leçons pour débloquer le quiz.</p> : ins.quiz.reussi ? <Pill tone="green">Quiz réussi ({ins.quiz.meilleurScore} %)</Pill> : ins.quiz.restantes === 0 ? <Pill tone="red">Plus de tentative disponible : contactez votre formateur.</Pill> : (<>
            {questions.map((q, qi) => (
              <fieldset key={q.id} className="space-y-1 rounded-lg border border-slate-100 p-3 text-sm">
                <legend className="px-1 font-medium text-slate-900">{qi + 1}. {q.enonce}{q.multiple ? ' (plusieurs réponses)' : ''}</legend>
                {q.choix.map((c, ci) => (
                  <label key={ci} className="flex cursor-pointer items-center gap-2 py-0.5"><input type={q.multiple ? 'checkbox' : 'radio'} name={q.id} className="h-4 w-4" checked={ans(qi).includes(ci)} onChange={() => pick(qi, ci, q.multiple)} />{c}</label>))}
              </fieldset>))}
            <div className="flex justify-end"><Button loading={busy} disabled={questions.some((_, i) => !ans(i).length)} onClick={() => void submit()}>Valider mes réponses</Button></div>
          </>)}
          {result && (
            <div ref={resultRef} tabIndex={-1} className={`scroll-mt-4 rounded-lg p-3 text-sm outline-none ${result.reussi ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
              <p className="font-semibold">Score : {result.score} % — {result.reussi ? 'réussi 🎉' : `insuffisant (seuil ${result.seuil} %)`} · tentative {result.tentative}</p>
              <p className="mt-1">{questions.map((q, i) => `${i + 1}. ${result.details.find((x) => x.questionId === q.id)?.correct ? '✓' : '✗'}`).join('   ')}</p>
            </div>)}
        </Card>)}
    </div>
  );
}

// ───────────────────────── Inscriptions et suivi ─────────────────────────
function InscriptionsPage({ api }: Props) {
  const courses = useAsync(() => get<CourseRow[]>(api, '/cours'), [api]);
  const [cid, setCid] = useState('');
  const managed = (courses.data ?? []).filter((c) => c.peutGerer);
  const courseId = managed.some((c) => c.id === cid) ? cid : managed[0]?.id ?? '';
  const list = useAsync(() => (courseId ? get<Enr[]>(api, '/inscriptions', { courseId }) : Promise.resolve([] as Enr[])), [courseId]);
  const detail = useAsync(() => (courseId ? get<Detail>(api, '/cours/detail', { id: courseId }) : Promise.resolve(null)), [courseId]);
  const { busy, act } = useAct(async () => { await list.reload(); });
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ apprenantNom: '', apprenantEmail: '' });
  const [open, setOpen] = useState('');
  const [q, setQ] = useState(''); const [etat, setEtat] = useState('');
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const rows = (list.data ?? []).filter((e) => (!etat || e.statut === etat) && matches(q, e.apprenantNom, e.apprenantEmail));
  const pg = useSlice('lms-inscriptions', rows, { courseId, q, etat });
  if (!courses.data) return <Loading error={courses.error} reload={courses.reload} />;
  const cur = list.data?.find((e) => e.id === open);

  const toggle = (id: string) => { setOpen(open === id ? '' : id); if (open !== id) requestAnimationFrame(() => scrollToEl(detailRef.current)); };
  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const r = await post<ImportReport>(api, '/inscriptions/import', { courseId, csv: await fileToCsv(file) });
      setReport(r);
      toast.success(`${r.created} inscrit(s), ${r.duplicates.length} doublon(s) ignoré(s), ${r.errors.length} erreur(s)`);
      await list.reload();
    } catch (e) { fail(e); } finally { setImporting(false); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Inscriptions et suivi" description="Inscrivez des apprenants (même sans accès au back-office) et enregistrez leur progression, par exemple en formation présentielle." actions={
        <div className="flex flex-wrap gap-2">
          {courseId ? <ImportButton busy={importing} onFile={(file) => void importFile(file)} /> : null}
          <Button icon={Download} disabled={!courseId} onClick={() => void exportCsv(api, '/inscriptions/export', 'inscriptions', { courseId })}>Exporter</Button>
          <Button icon={Plus} disabled={!courseId} onClick={() => setAdding(true)}>Nouvelle inscription</Button>
        </div>} />
      {adding && courseId && (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom de l’apprenant *"><Input value={f.apprenantNom} onChange={(e) => setF({ ...f, apprenantNom: e.target.value })} /></Field>
            <Field label="E-mail *"><Input type="email" value={f.apprenantEmail} onChange={(e) => setF({ ...f, apprenantEmail: e.target.value })} /></Field>
          </div>
          <p className="text-xs text-slate-500">Le cours doit être publié. Un e-mail déjà associé à un compte retrouve ce compte.</p>
          <div className="flex justify-end gap-2"><Button onClick={() => setAdding(false)}>Annuler</Button>
            <Button loading={busy} disabled={f.apprenantNom.trim().length < 2 || !f.apprenantEmail.includes('@')} onClick={() => void act(async () => { await post(api, '/inscription/add', { courseId, ...f }); setF({ apprenantNom: '', apprenantEmail: '' }); setAdding(false); }, 'Apprenant inscrit')}>Inscrire</Button></div>
        </Card>)}
      {report && (
        <Card className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900">Résultat de l’import</h3>
            <Button icon={X} onClick={() => setReport(null)}>Fermer</Button>
          </div>
          <p className="text-sm text-slate-700">{report.total} ligne(s) lue(s) : <strong>{report.created}</strong> inscrit(s), {report.duplicates.length} doublon(s) ignoré(s), {report.errors.length} erreur(s).</p>
          {[...report.errors.map((e) => `Ligne ${e.line} : ${e.message}`), ...report.duplicates.map((d) => `Ligne ${d.line} : ${d.email} — ${d.reason === 'deja_inscrit' ? 'déjà inscrit' : 'en double dans le fichier'}`)].slice(0, 10).map((t) => <p key={t} className="text-xs text-slate-500">{t}</p>)}
        </Card>)}
      <Card padded={false}>
        <Toolbar value={q} onChange={setQ} placeholder="Nom ou e-mail de l’apprenant…">
          <Select value={courseId} onChange={setCid} className="w-full sm:w-64" options={managed.length ? managed.map((c) => ({ value: c.id, label: c.titre })) : [{ value: '', label: 'Aucun cours à gérer' }]} />
          <Select value={etat} onChange={setEtat} className="w-40" options={[ALL('Tous les états'), { value: 'en_cours', label: 'En cours' }, { value: 'termine', label: 'Terminé' }]} />
        </Toolbar>
        {list.error ? <div className="p-4"><ErrorState message={list.error} onRetry={list.reload} /></div>
          : !list.data ? <PageSkeleton />
          : !pg.total ? <EmptyState icon={Users} title="Aucun inscrit" description={list.data.length ? 'Aucun inscrit ne correspond à ces filtres.' : 'Inscrivez un apprenant ou importez un fichier CSV / Excel (colonnes Nom, Prénom, E-mail).'} />
          : (<>
            <Table>
              <thead><tr><Th>Apprenant</Th><Th>Progression</Th><Th>Quiz</Th><Th>État</Th><Th>Inscrit le</Th></tr></thead>
              <tbody>{pg.rows.map((e) => (
                <tr key={e.id} className={`cursor-pointer hover:bg-slate-50/70 ${open === e.id ? 'bg-slate-50' : ''}`} onClick={() => toggle(e.id)}>
                  <Td><p className="font-medium text-slate-900">{e.apprenantNom}</p><p className="truncate text-xs text-slate-500">{e.apprenantEmail || '—'}</p></Td>
                  <Td><div className="w-32"><Bar pct={e.resume.pourcent} /><span className="text-xs text-slate-500">{e.resume.faites}/{e.resume.total} leçons</span></div></Td>
                  <Td>{!e.resume.quiz.requis ? '—' : e.resume.quiz.reussi ? <Pill tone="green">{e.resume.quiz.meilleurScore} %</Pill> : e.resume.quiz.tentatives ? <Pill tone="red">{e.resume.quiz.meilleurScore} %</Pill> : <Badge>À passer</Badge>}</Td>
                  <Td>{e.statut === 'termine' ? <Pill tone="green">Terminé</Pill> : <Pill tone="amber">En cours</Pill>}</Td>
                  <Td>{fmtDate(e.inscritAt)}</Td>
                </tr>))}</tbody>
            </Table>
            <Pagination page={pg.page} pageSize={pg.pageSize} total={pg.total} onPage={pg.setPage} onPageSize={pg.setPageSize} noun="inscrits" />
          </>)}
      </Card>
      <div ref={detailRef} tabIndex={-1} className="scroll-mt-4 outline-none">
        {cur && detail.data && (
          <Card className="space-y-2">
            <h3 className="font-semibold text-slate-900">Progression de {cur.apprenantNom}</h3>
            {detail.data.chapters.map((ch) => (<div key={ch.id}><p className="text-sm font-medium text-slate-700">{ch.titre}</p>
              <ul className="mt-1 space-y-1">{ch.lessons.map((l) => { const ok = cur.resume.leconsFaites.includes(l.id); return (
                <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 text-sm"><span>{ok ? '✓' : '○'} {l.titre}</span>
                  {ok ? <Pill tone="green">Fait</Pill> : <Button loading={busy} onClick={() => void act(() => post(api, '/lecon/terminer', { enrollmentId: cur.id, lessonId: l.id }), 'Progression enregistrée')}>Marquer fait</Button>}</li>); })}</ul></div>))}
          </Card>)}
      </div>
    </div>
  );
}

// ───────────────────────── Certificats ─────────────────────────
function CertificatsPage({ api }: Props) {
  const list = useAsync(() => get<Cert[]>(api, '/certificats'), [api]);
  const [code, setCode] = useState('');
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ valide: boolean; apprenantNom?: string; coursTitre?: string; delivreAt?: string } | null>(null);
  const rows = (list.data ?? []).filter((c) => matches(q, c.apprenantNom, c.coursTitre, c.code));
  const pg = useSlice('lms-certificats', rows, { q });
  const check = async () => { try { setRes(await get(api, '/certificat/verifier', { code })); } catch (e) { setRes(null); fail(e); } };
  return (
    <div className="space-y-4">
      <PageHeader title="Certificats" description="Délivrés automatiquement quand toutes les leçons sont terminées et le quiz réussi. Chaque certificat porte un code et une empreinte vérifiables." actions={
        <Button icon={Download} onClick={() => void exportCsv(api, '/certificats/export', 'certificats')}>Exporter</Button>} />
      <Card className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Vérifier un certificat</p>
        <div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><Input placeholder="CERT-XXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} /></div><Button disabled={code.trim().length < 5} onClick={() => void check()}>Vérifier</Button></div>
        {res && (res.valide ? <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">✓ Authentique : {res.apprenantNom} — {res.coursTitre} ({res.delivreAt ? fmtDate(res.delivreAt.slice(0, 10)) : ''})</p> : <p className="rounded-lg bg-red-50 p-2 text-sm text-red-800">✗ Code inconnu ou certificat altéré.</p>)}
      </Card>
      <Card padded={false}>
        <Toolbar value={q} onChange={setQ} placeholder="Apprenant, cours ou code…" />
        {list.error ? <div className="p-4"><ErrorState message={list.error} onRetry={list.reload} /></div>
          : !list.data ? <PageSkeleton />
          : !pg.total ? <EmptyState icon={Award} title="Aucun certificat" description={list.data.length ? 'Aucun certificat ne correspond à la recherche.' : 'Terminez un cours pour obtenir votre certificat.'} />
          : (<>
            <Table>
              <thead><tr><Th>Apprenant</Th><Th>Cours</Th><Th>Code</Th><Th>Intégrité</Th><Th>Délivré le</Th><Th> </Th></tr></thead>
              <tbody>{pg.rows.map((c) => (
                <tr key={c.id}>
                  <Td><p className="font-medium text-slate-900">{c.apprenantNom}</p></Td><Td>{c.coursTitre}</Td>
                  <Td><Badge>{c.code}</Badge></Td>
                  <Td>{c.integre ? <Pill tone="green">Intact</Pill> : <Pill tone="red">Altéré</Pill>}</Td>
                  <Td>{fmtDate(c.delivreAt)}</Td>
                  <Td><Button icon={Download} disabled={!c.integre} onClick={() => void download(api, c.id)}>PDF</Button></Td>
                </tr>))}</tbody>
            </Table>
            <Pagination page={pg.page} pageSize={pg.pageSize} total={pg.total} onPage={pg.setPage} onPageSize={pg.setPageSize} noun="certificats" />
          </>)}
      </Card>
    </div>
  );
}

export default defineAdminModule<Record<string, never>>({
  pages: { dashboard: DashboardPage, cours: CoursPage, apprentissage: ApprentissagePage, inscriptions: InscriptionsPage, certificats: CertificatsPage },
});
