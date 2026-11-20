/**
 * Pages PUBLIQUES du module LMS (site visiteur) : /formation/*
 *   /formation/                  catalogue + « Mes formations »
 *   /formation/cours/<id>/       lecteur de cours (leçons, quiz, certificat)
 *   /formation/certificats/      mes certificats (PDF)
 *   /formation/verifier/         vérification publique d'un certificat
 * Connexion / inscription : module « Espace client » (/compte/). Toutes les données passent par les routes publiques du module,
 * qui n'accordent que le rôle « apprenant » (voir src/public-api.ts).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { definePublicModule, isModuleActive, type ModuleApi, type PublicPageProps } from '@snapify/sdk';

type Settings = { catalogTitle?: string; catalogIntro?: string; openEnrollment?: boolean };
type Props = PublicPageProps<Settings>;
interface Resume { enrollmentId: string; faites: number; total: number; pourcent: number; leconsFaites: string[]; quiz: { requis: boolean; reussi: boolean; tentatives: number; meilleurScore: number | null; restantes: number | null; seuil: number | null }; termine: boolean; certificatId: string | null }
interface Course { id: string; titre: string; description: string; niveau: string; statut: string; instructeurNom: string; nbLecons: number; dureeMin: number; inscription: Resume | null }
type MediaType = 'video' | 'image' | 'document' | 'lien';
interface Media { type: MediaType; titre: string; url: string }
interface Lecon { id: string; titre: string; type: 'texte' | 'video' | 'lien'; contenu: string; medias?: Media[]; nbMedias?: number; dureeMin: number }
interface Detail { course: Course; chapters: { id: string; titre: string; lessons: Lecon[] }[]; quiz: { titre: string; seuil: number; tentativesMax: number; questions: { id: string; enonce: string; choix: string[]; multiple: boolean }[] } | null; inscription: Resume | null }
interface Me { customer: { id: string; nom: string } | null; accountsAvailable: boolean; openEnrollment: boolean }
interface Cert { id: string; code: string; coursTitre: string; apprenantNom: string; delivreAt: string; integre: boolean }
interface QuizResult { score: number; reussi: boolean; seuil: number; tentative: number; details: { questionId: string; correct: boolean }[] }

const BASE = '/formation/';
const NIVEAU: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const btn = 'inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';
const btn2 = 'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';
const card = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
const hhmm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`);
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Une erreur est survenue');

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [s, set] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const load = () => { set((p) => ({ ...p, loading: true })); return fn().then((data) => set({ data, loading: false }), (e) => set({ error: msg(e), loading: false })); };
  useEffect(() => { let on = true; fn().then((data) => on && set({ data, loading: false }), (e) => on && set({ error: msg(e), loading: false })); return () => { on = false; }; }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...s, reload: load };
}
const Bar = ({ pct }: { pct: number }) => <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>;
const Alert = ({ children }: { children: ReactNode }) => <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{children}</p>;
const Pill = ({ ok, children }: { ok?: boolean; children: ReactNode }) => <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{children}</span>;

/** Défilement doux, désactivé pour qui préfère les animations réduites ; le focus suit pour les lecteurs d'écran et le clavier. */
const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function scrollToEl(el: HTMLElement | null) {
  if (!el) return;
  el.scrollIntoView?.({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  el.focus?.({ preventScroll: true });
}

function saveBase64(name: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
/** Vidéos : seuls YouTube et Vimeo sont intégrés (jamais une adresse arbitraire dans un cadre). */
function embedUrl(u: string): string | null {
  try {
    const x = new URL(u); const host = x.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' && x.pathname === '/watch' && /^[\w-]{6,20}$/.test(x.searchParams.get('v') ?? '')) return `https://www.youtube-nocookie.com/embed/${x.searchParams.get('v')}`;
    if (host === 'youtu.be' && /^\/[\w-]{6,20}$/.test(x.pathname)) return `https://www.youtube-nocookie.com/embed${x.pathname}`;
    if (host === 'vimeo.com' && /^\/\d{5,12}$/.test(x.pathname)) return `https://player.vimeo.com/video${x.pathname}`;
  } catch { /* adresse invalide */ }
  return null;
}

const MEDIA_LINK: Record<MediaType, string> = { video: 'Ouvrir la vidéo dans un nouvel onglet', image: 'Ouvrir l’image en grand', document: 'Ouvrir le document', lien: 'Ouvrir la ressource dans un nouvel onglet' };
/** Un média complémentaire : vidéo YouTube/Vimeo intégrée, image affichée, document et lien ouverts dans un nouvel onglet. */
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

function Shell({ p, me, title, children }: { p: Props; me: Me | undefined; title: string; children: ReactNode }) {
  const link = (href: string, label: string) => <a href={href} onClick={(e) => { e.preventDefault(); p.navigate(href); }} className="font-medium text-slate-700 underline-offset-4 hover:underline">{label}</a>;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 text-sm">
        <nav aria-label="Formation" className="flex flex-wrap gap-4">{link(BASE, 'Catalogue')}{link(`${BASE}certificats/`, 'Mes certificats')}{link(`${BASE}verifier/`, 'Vérifier un certificat')}</nav>
        <div className="text-slate-600">{me?.customer ? <>Connecté : <strong>{me.customer.nom}</strong></> : me?.accountsAvailable ? <a className="font-medium text-slate-900 underline" href="/compte/">Se connecter / créer un compte</a> : null}</div>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {children}
    </main>
  );
}
const useMe = (api: ModuleApi) => useLoad(() => api.get<Me>('/public/me'), [api]);
const LoginPrompt = ({ me }: { me: Me | undefined }) => (
  <div className={card}><p className="text-sm text-slate-700">{me?.accountsAvailable === false ? 'Les comptes apprenants ne sont pas activés sur ce site : contactez le formateur pour être inscrit.' : 'Connectez-vous ou créez un compte pour vous inscrire et suivre ce cours.'}</p>
    {me?.accountsAvailable !== false ? <a className={`${btn} mt-3`} href="/compte/">Se connecter / créer un compte</a> : null}</div>
);

// ───────────── Catalogue ─────────────
function Catalogue(p: Props) {
  const me = useMe(p.api), list = useLoad(() => p.api.get<Course[]>('/public/cours'), [p.api]);
  useEffect(() => { p.setMeta({ title: 'Formations', description: p.settings.catalogIntro }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (id: string) => p.navigate(`${BASE}cours/${id}/`);
  const mine = (list.data ?? []).filter((c) => c.inscription), open = (list.data ?? []).filter((c) => !c.inscription && c.statut === 'publie');
  return (
    <Shell p={p} me={me.data} title={p.settings.catalogTitle || 'Nos formations'}>
      {p.settings.catalogIntro ? <p className="text-slate-600">{p.settings.catalogIntro}</p> : null}
      {list.error ? <Alert>{list.error}</Alert> : list.loading ? <p className="text-slate-500" aria-live="polite">Chargement…</p> : (<>
        {mine.length > 0 && (<section aria-labelledby="mes"><h2 id="mes" className="mb-3 text-lg font-semibold text-slate-900">Mes formations</h2>
          <div className="grid gap-4 sm:grid-cols-2">{mine.map((c) => (
            <article key={c.id} className={`${card} space-y-2`}><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-slate-900">{c.titre}</h3>{c.inscription!.termine ? <Pill ok>Terminé</Pill> : <Pill>En cours</Pill>}</div>
              <Bar pct={c.inscription!.pourcent} /><p className="text-xs text-slate-500">{c.inscription!.faites} / {c.inscription!.total} leçons · {c.inscription!.pourcent} %</p>
              <button type="button" className={btn} onClick={() => go(c.id)}>{c.inscription!.termine ? 'Revoir le cours' : 'Continuer'}</button></article>))}</div></section>)}
        <section aria-labelledby="dispo"><h2 id="dispo" className="mb-3 text-lg font-semibold text-slate-900">{mine.length ? 'Autres formations' : 'Formations disponibles'}</h2>
          {!open.length ? <p className="text-slate-500">Aucune formation publiée pour le moment.</p> : (
            <div className="grid gap-4 sm:grid-cols-2">{open.map((c) => (
              <article key={c.id} className={`${card} space-y-2`}><h3 className="font-semibold text-slate-900">{c.titre}</h3><p className="text-sm text-slate-600">{c.description}</p>
                <p className="text-xs text-slate-500">{NIVEAU[c.niveau]} · {c.nbLecons} leçon(s) · {hhmm(c.dureeMin)} · {c.instructeurNom}</p>
                <button type="button" className={btn2} onClick={() => go(c.id)}>Voir le programme</button></article>))}</div>)}</section>
      </>)}
    </Shell>
  );
}

// ───────────── Cours ─────────────
function CoursePage({ p, id }: { p: Props; id: string }) {
  const me = useMe(p.api), d = useLoad(() => p.api.get<Detail>(`/public/cours/detail?id=${encodeURIComponent(id)}`), [id]);
  const [sel, setSel] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [answers, setAnswers] = useState<number[][]>([]); const [result, setResult] = useState<QuizResult | null>(null);
  const panelRef = useRef<HTMLElement>(null), quizRef = useRef<HTMLElement>(null), resultRef = useRef<HTMLDivElement>(null), navRef = useRef<HTMLElement>(null);
  // Dans un programme long (liste défilante), la leçon active reste visible.
  useEffect(() => {
    const nav = navRef.current, el = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!nav || !el) return;
    if (el.offsetTop < nav.scrollTop || el.offsetTop + el.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTop = Math.max(0, el.offsetTop - nav.clientHeight / 2);
  }, [sel, d.data]);
  useEffect(() => { if (d.data) p.setMeta({ title: d.data.course.titre, description: d.data.course.description }); }, [d.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(''); try { await fn(); await d.reload(); } catch (e) { setErr(msg(e)); } finally { setBusy(false); } };
  if (d.error) return <Shell p={p} me={me.data} title="Cours introuvable"><Alert>{d.error}</Alert></Shell>;
  if (!d.data) return <Shell p={p} me={me.data} title="Chargement…"><p className="text-slate-500" aria-live="polite">Chargement du cours…</p></Shell>;
  const { course, chapters, quiz, inscription: ins } = d.data;
  const all = chapters.flatMap((c) => c.lessons);
  const cur = all.find((l) => l.id === sel) ?? all.find((l) => !ins?.leconsFaites.includes(l.id)) ?? all[0];
  const done = (lid: string) => !!ins?.leconsFaites.includes(lid);
  const allDone = !!ins && ins.total > 0 && ins.faites === ins.total;
  const qs = quiz?.questions ?? [];
  const ans = (i: number) => answers[i] ?? [];
  const pick = (qi: number, ci: number, multiple: boolean) => setAnswers((prev) => { const n = [...prev]; const c = n[qi] ?? []; n[qi] = multiple ? (c.includes(ci) ? c.filter((x) => x !== ci) : [...c, ci]) : [ci]; return n; });
  const choose = (lid: string) => { setSel(lid); requestAnimationFrame(() => scrollToEl(panelRef.current)); };
  const idx = cur ? all.findIndex((l) => l.id === cur.id) : -1;
  const prev = idx > 0 ? all[idx - 1] : null, next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  /** Valide la leçon puis passe à la prochaine non terminée ; s'il n'y en a plus, amène au quiz. */
  const finish = () => {
    const upcoming = [...all.slice(idx + 1), ...all.slice(0, Math.max(idx, 0))].find((l) => !done(l.id) && l.id !== cur!.id);
    void act(() => p.api.post('/public/lecon/terminer', { enrollmentId: ins!.enrollmentId, lessonId: cur!.id })).then(() => {
      if (upcoming) choose(upcoming.id); else if (quiz && qs.length) requestAnimationFrame(() => scrollToEl(quizRef.current));
    });
  };
  const cert = async () => { try { const f = await p.api.get<{ filename: string; base64: string }>(`/public/certificat/pdf?id=${encodeURIComponent(ins!.certificatId!)}`); saveBase64(f.filename, f.base64); } catch (e) { setErr(msg(e)); } };
  return (
    <Shell p={p} me={me.data} title={course.titre}>
      <p className="text-slate-600">{course.description}</p>
      {err ? <Alert>{err}</Alert> : null}
      {!ins ? (me.data?.customer ? (
        <div className={card}>{course.statut === 'publie' && me.data.openEnrollment ? <><p className="mb-3 text-sm text-slate-700">Inscrivez-vous pour accéder au contenu des leçons.</p><button type="button" className={btn} disabled={busy} onClick={() => void act(() => p.api.post('/public/inscription', { courseId: id }))}>S’inscrire à ce cours</button></> : <p className="text-sm text-slate-700">Les inscriptions à ce cours sont gérées par le formateur.</p>}</div>
      ) : <LoginPrompt me={me.data} />) : (
        <div className={`${card} space-y-2`}><Bar pct={ins.pourcent} /><p className="text-sm text-slate-600">{ins.faites} / {ins.total} leçons · {ins.pourcent} %{ins.termine ? ' · cours terminé 🎉' : ''}</p>
          {ins.certificatId ? <button type="button" className={btn} onClick={() => void cert()}>Télécharger mon certificat (PDF)</button> : null}</div>)}
      <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
        <nav ref={navRef} aria-label="Programme du cours" className={`${card} relative max-h-72 space-y-3 overflow-y-auto overscroll-contain lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start`}>{chapters.map((ch) => (
          <div key={ch.id}><p className="mb-1 text-sm font-semibold text-slate-900">{ch.titre}</p>
            <ul className="space-y-1">{ch.lessons.map((l) => (
              <li key={l.id}><button type="button" onClick={() => choose(l.id)} aria-current={cur?.id === l.id ? 'true' : undefined} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${cur?.id === l.id ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'}`}>
                <span aria-hidden className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${done(l.id) ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}>{done(l.id) ? '✓' : ''}</span>{l.titre}{done(l.id) ? <span className="sr-only"> (terminée)</span> : null}</button></li>))}</ul></div>))}</nav>
        <section ref={panelRef} tabIndex={-1} className={`${card} scroll-mt-4 space-y-3 outline-none`} aria-live="polite">
          {!cur ? <p className="text-slate-500">Ce cours n’a pas encore de contenu.</p> : (<>
            <h2 className="text-lg font-semibold text-slate-900">{cur.titre}</h2>
            {!ins ? <p className="text-sm text-slate-500">Le contenu est réservé aux inscrits{cur.nbMedias ? ` (${cur.nbMedias} média${cur.nbMedias > 1 ? 's' : ''} complémentaire${cur.nbMedias > 1 ? 's' : ''})` : ''}.</p> : <LessonBody lesson={cur} />}
            {ins ? (done(cur.id) ? <Pill ok>Leçon terminée</Pill> : <div><button type="button" className={btn} disabled={busy} onClick={finish}>Marquer comme terminée</button></div>) : null}
            {all.length > 1 ? <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3">{prev ? <button type="button" className={btn2} onClick={() => choose(prev.id)}>← {prev.titre}</button> : <span />}{next ? <button type="button" className={btn2} onClick={() => choose(next.id)}>{next.titre} →</button> : null}</div> : null}
          </>)}
        </section>
      </div>
      {ins && quiz && qs.length > 0 && (
        <section ref={quizRef} tabIndex={-1} className={`${card} scroll-mt-4 space-y-3 outline-none`} aria-labelledby="quiz"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="quiz" className="text-lg font-semibold text-slate-900">{quiz.titre}</h2>
          <span className="text-xs text-slate-500">Seuil {quiz.seuil} % · {ins.quiz.restantes === null ? 'tentatives illimitées' : `${ins.quiz.restantes} tentative(s) restante(s)`}{ins.quiz.meilleurScore !== null ? ` · meilleur score ${ins.quiz.meilleurScore} %` : ''}</span></div>
          {!allDone ? <p className="text-sm text-slate-600">Terminez toutes les leçons pour débloquer le quiz.</p> : ins.quiz.reussi ? <Pill ok>Quiz réussi ({ins.quiz.meilleurScore} %)</Pill> : ins.quiz.restantes === 0 ? <Alert>Vous n’avez plus de tentative : contactez votre formateur.</Alert> : (<>
            {qs.map((q, qi) => (
              <fieldset key={q.id} className="space-y-1 rounded-lg border border-slate-100 p-3 text-sm"><legend className="px-1 font-medium text-slate-900">{qi + 1}. {q.enonce}{q.multiple ? ' (plusieurs réponses)' : ''}</legend>
                {q.choix.map((c, ci) => <label key={ci} className="flex cursor-pointer items-center gap-2 py-0.5"><input type={q.multiple ? 'checkbox' : 'radio'} name={q.id} className="h-4 w-4" checked={ans(qi).includes(ci)} onChange={() => pick(qi, ci, q.multiple)} />{c}</label>)}
              </fieldset>))}
            <button type="button" className={btn} disabled={busy || qs.some((_, i) => !ans(i).length)} onClick={() => void act(async () => { setResult(await p.api.post<QuizResult>('/public/quiz/soumettre', { enrollmentId: ins.enrollmentId, reponses: qs.map((_, i) => ans(i)) })); }).then(() => requestAnimationFrame(() => scrollToEl(resultRef.current)))}>Valider mes réponses</button>
          </>)}
          {result && <div ref={resultRef} tabIndex={-1} role="status" className={`scroll-mt-4 rounded-lg p-3 text-sm outline-none ${result.reussi ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}><p className="font-semibold">Score : {result.score} % — {result.reussi ? 'réussi 🎉' : `insuffisant (seuil ${result.seuil} %)`} · tentative {result.tentative}</p>
            <p className="mt-1">{qs.map((q, i) => `${i + 1}. ${result.details.find((x) => x.questionId === q.id)?.correct ? '✓' : '✗'}`).join('   ')}</p>{result.reussi && ins.certificatId ? <button type="button" className={`${btn} mt-3`} onClick={() => void cert()}>Télécharger mon certificat (PDF)</button> : null}</div>}
        </section>)}
    </Shell>
  );
}

// ───────────── Certificats ─────────────
function Certificats(p: Props) {
  const me = useMe(p.api), list = useLoad(() => p.api.get<Cert[]>('/public/certificats').catch((e) => { if ((e as { status?: number }).status === 401) return [] as Cert[]; throw e; }), [p.api]);
  const [err, setErr] = useState('');
  useEffect(() => { p.setMeta({ title: 'Mes certificats' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dl = async (id: string) => { try { const f = await p.api.get<{ filename: string; base64: string }>(`/public/certificat/pdf?id=${encodeURIComponent(id)}`); saveBase64(f.filename, f.base64); } catch (e) { setErr(msg(e)); } };
  return (
    <Shell p={p} me={me.data} title="Mes certificats">
      {err ? <Alert>{err}</Alert> : null}
      {me.data && !me.data.customer ? <LoginPrompt me={me.data} /> : list.error ? <Alert>{list.error}</Alert> : !list.data ? <p className="text-slate-500">Chargement…</p> : !list.data.length ? <p className="text-slate-500">Terminez un cours pour obtenir votre certificat.</p> : (
        <ul className="space-y-3">{list.data.map((c) => (
          <li key={c.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}><div><p className="font-semibold text-slate-900">{c.coursTitre}</p><p className="text-sm text-slate-600">Délivré le {day(c.delivreAt)} · code <code className="text-xs">{c.code}</code></p></div>
            <button type="button" className={btn} disabled={!c.integre} onClick={() => void dl(c.id)}>Télécharger (PDF)</button></li>))}</ul>)}
    </Shell>
  );
}

// ───────────── Vérification publique ─────────────
function Verifier(p: Props) {
  const me = useMe(p.api);
  const [code, setCode] = useState(new URLSearchParams(p.search).get('code') ?? '');
  const [res, setRes] = useState<{ valide: boolean; apprenantNom?: string; coursTitre?: string; delivreAt?: string } | null>(null); const [err, setErr] = useState('');
  useEffect(() => { p.setMeta({ title: 'Vérifier un certificat', description: 'Contrôlez l’authenticité d’un certificat à partir de son code.' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const check = async () => { setErr(''); setRes(null); try { setRes(await p.api.get(`/public/certificat/verifier?code=${encodeURIComponent(code.trim())}`)); } catch (e) { setErr(msg(e)); } };
  return (
    <Shell p={p} me={me.data} title="Vérifier un certificat">
      <div className={`${card} space-y-3`}>
        <label className="block text-sm font-medium text-slate-700" htmlFor="code">Code du certificat</label>
        <div className="flex flex-wrap gap-2"><input id="code" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="CERT-XXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && code.trim().length >= 5) void check(); }} /><button type="button" className={btn} disabled={code.trim().length < 5} onClick={() => void check()}>Vérifier</button></div>
        {err ? <Alert>{err}</Alert> : null}
        {res && (res.valide ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">✓ Certificat authentique : <strong>{res.apprenantNom}</strong> a terminé « {res.coursTitre} » le {res.delivreAt ? day(res.delivreAt) : ''}.</p> : <p role="status" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">✗ Code inconnu, ou certificat altéré.</p>)}
      </div>
    </Shell>
  );
}

function LmsPage(props: Props) {
  const segs = props.path.split('/').filter(Boolean); // ['formation', 'cours', '<id>']
  const sub = segs[1] ?? '';
  // Changer de page (catalogue → cours…) repart en haut, au lieu de garder la position de la page précédente.
  useEffect(() => { window.scrollTo?.({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); }, [props.path]);
  // Sans module « Espace client » : message de repli dans les écrans qui exigent un compte (voir LoginPrompt).
  void isModuleActive;
  if (sub === 'cours' && segs[2]) return <CoursePage key={segs[2]} p={props} id={decodeURIComponent(segs[2])} />;
  if (sub === 'certificats') return <Certificats {...props} />;
  if (sub === 'verifier') return <Verifier {...props} />;
  return <Catalogue {...props} />;
}

export default definePublicModule<Settings>({ page: LmsPage });
