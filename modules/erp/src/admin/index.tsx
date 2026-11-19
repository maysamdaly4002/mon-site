/**
 * Interface d'administration du module « Prévention incendie » (français, mobile d'abord).
 * Composants : SDK Snapify (@snapify/sdk/admin), comme le module CRM. Les routes serveur renvoient { ok, data | error }.
 * Saisie terrain : photo redimensionnée côté client, et file d'attente hors-ligne (localStorage) synchronisée au retour du réseau.
 */
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { toDataURL as qrToDataURL } from 'qrcode';
import { getLang, setLang, t } from './i18n';
import { AlertTriangle, ArrowLeft, Check, ClipboardCheck, Download, FileText, Flame, Plus, QrCode, RefreshCw, ScanLine, ShieldCheck, X } from 'lucide-react';
import {
  Button, Card, defineAdminModule, EmptyState, ErrorState, errorMessage, fmtDate, fmtDateTime, Input, PageHeader, PageSkeleton,
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
const today = () => new Date().toISOString().slice(0, 10);

interface Etab { id: string; nom: string; adresse: string; typeActivite: string; categorie: string; effectifMax: number; emailAlertes: string }
interface Equip { id: string; etablissementId: string; niveauId: string | null; typeId: string; libelle: string; emplacement: string; dateMiseEnService: string; qrCode: string; statut: string; dernierControle: string | null; prochaineEcheance: string; etat: Etat; joursRestants: number }
interface TypeEq { id: string; code: string; libelle: string; periodiciteDefautMois: number; regles: { id: string; categorie: string | null; periodiciteMois: number }[] }
interface Niveau { id: string; nom: string; ordre: number }
interface Batiment { id: string; nom: string; niveaux: Niveau[] }
type Etat = 'ok' | 'a_venir' | 'en_retard' | 'hors_service';
interface Nc { id: string; equipementId: string; equipement: string; description: string; statut: string; createdAt: string; leveeAt: string | null }
interface Action { id: string; description: string; responsable: string; echeance: string; statut: string }
interface Entry { id: string; seq: number; type: string; occurredAt: string; auteur: string; payload: Record<string, any>; hash: string; corrigeId: string | null; corrigee: boolean }
interface Integrity { ok: boolean; checked: number; brokenAt?: number; reason?: string }

const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400';
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}</label>;
const TONES = { green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200', red: 'bg-red-50 text-red-700 ring-red-200', slate: 'bg-slate-100 text-slate-700 ring-slate-200' };
const Pill = ({ tone = 'slate', children }: { tone?: keyof typeof TONES; children: ReactNode }) => <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
const ETAT: Record<Etat, [string, keyof typeof TONES]> = { ok: ['À jour', 'green'], a_venir: ['À venir', 'amber'], en_retard: ['En retard', 'red'], hors_service: ['Hors service', 'slate'] };
const EtatPill = ({ e }: { e: Equip }) => <Pill tone={ETAT[e.etat][1]}>{t(ETAT[e.etat][0])}{e.etat === 'en_retard' ? ` (${-e.joursRestants} j)` : e.etat === 'a_venir' ? ` (${e.joursRestants} j)` : ''}</Pill>;
const NC_LABEL: Record<string, [string, keyof typeof TONES]> = { ouverte: ['Ouverte', 'red'], en_cours: ['En cours', 'amber'], levee: ['Levée', 'green'] };
const ACTION_OPTIONS = [{ value: 'a_faire', label: 'À faire' }, { value: 'en_cours', label: 'En cours' }, { value: 'terminee', label: 'Terminée' }];
const TYPE_LABEL: Record<string, string> = { controle: 'Contrôle', non_conformite: 'Non-conformité', action: 'Action corrective', levee: 'Levée', exercice: 'Exercice / formation', intervention: 'Intervention', correction: 'Correction', visite: 'Visite de la commission', prescription: 'Prescription' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function saveBase64(name: string, base64: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
/** Redimensionne la photo (1280 px max, JPEG) avant l'envoi : rapide sur réseau mobile, et sous la limite de 1,5 Mo. */
async function shrink(file: File, max = 1280) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return { nom: 'photo.jpg', mime: 'image/jpeg', base64: c.toDataURL('image/jpeg', 0.8).split(',')[1] };
}
const store = {
  get<T>(k: string, d: T): T { try { return JSON.parse(localStorage.getItem(k) ?? '') as T; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage plein ou indisponible */ } },
};

/** Établissements accessibles + sélection mémorisée. */
function useEtabs(api: Api) {
  const list = useAsync(() => get<Etab[]>(api, '/etablissements'), [api]);
  const [id, setId] = useState(() => store.get<string>('erp-etab', ''));
  const current = list.data?.find((e) => e.id === id) ?? list.data?.[0];
  useEffect(() => { if (current) store.set('erp-etab', current.id); }, [current?.id]);
  return { list, current, setId };
}
const EtabPicker = ({ etabs }: { etabs: ReturnType<typeof useEtabs> }) => (
  <Select value={etabs.current?.id ?? ''} onChange={etabs.setId} className="w-full sm:w-72" options={(etabs.list.data ?? []).map((e) => ({ value: e.id, label: e.nom }))} />
);
const Loading = ({ error, reload }: { error?: string | null; reload: () => void }) => (error ? <ErrorState message={error} onRetry={reload} /> : <PageSkeleton />);

// ───────────────────────── Tableau de bord ─────────────────────────
interface Dash { global: { equipements: number; enRetard: number; ncOuvertes: number; prescriptionsOuvertes: number; tauxConformite: number }; parEtablissement: { id: string; nom: string; equipements: number; enRetard: number; aVenir: number; ncOuvertes: number; prescriptionsOuvertes: number; tauxConformite: number }[]; equipementsEnRetard: (Equip & { etablissementNom?: string })[] }
function DashboardPage({ api, navigate }: Props) {
  const d = useAsync(() => get<Dash>(api, '/dashboard'), [api]);
  const [busy, setBusy] = useState(false);
  if (!d.data) return <Loading error={d.error} reload={d.reload} />;
  const x = d.data;
  const runAlerts = async () => { setBusy(true); try { const r = await post<{ mails: number; alertes: number; echecs: unknown[] }>(api, '/alertes/run', {}); toast.success(`${r.mails} e-mail(s) envoyé(s) (${r.alertes} alerte(s)), ${r.echecs.length} échec(s)`); } catch (e) { fail(e); } finally { setBusy(false); } };
  return (
    <div className="space-y-4">
      <PageHeader title={t('Sécurité incendie — Tableau de bord')} description={t('Conformité des équipements, retards et non-conformités par établissement.')} actions={<Button icon={RefreshCw} loading={busy} onClick={() => void runAlerts()}>{t('Envoyer les alertes')}</Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t('Taux de conformité')} value={`${x.global.tauxConformite} %`} icon={ShieldCheck} />
        <StatCard label={t('Équipements suivis')} value={x.global.equipements} icon={Flame} tone="sky" />
        <StatCard label={t('En retard')} value={x.global.enRetard} icon={AlertTriangle} />
        <StatCard label={t('Non-conformités ouvertes')} value={x.global.ncOuvertes} icon={ClipboardCheck} tone="sky" />
        <StatCard label={t('Prescriptions ouvertes')} value={x.global.prescriptionsOuvertes} icon={FileText} tone="sky" />
      </div>
      <Card padded={false}>
        <div className="border-b border-slate-100 p-4 font-semibold text-slate-900">{t('Par établissement')}</div>
        {!x.parEtablissement.length ? <EmptyState icon={Flame} title={t('Aucun établissement')} description={t('Créez un établissement pour commencer.')} /> : (
          <div className="overflow-x-auto"><Table>
            <thead><tr><Th>{t('Établissement')}</Th><Th>{t('Conformité')}</Th><Th>{t('Équipements')}</Th><Th>{t('En retard')}</Th><Th>{t('À venir (30 j)')}</Th><Th>{t('Non-conf. ouvertes')}</Th><Th>{t('Prescriptions ouvertes')}</Th></tr></thead>
            <tbody>{x.parEtablissement.map((e) => (
              <tr key={e.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => navigate(`/${e.id}`)}>
                <Td className="font-medium text-slate-900">{e.nom}</Td>
                <Td><Pill tone={e.tauxConformite >= 90 ? 'green' : e.tauxConformite >= 70 ? 'amber' : 'red'}>{e.tauxConformite} %</Pill></Td>
                <Td>{e.equipements}</Td><Td>{e.enRetard}</Td><Td>{e.aVenir}</Td><Td>{e.ncOuvertes}</Td><Td>{e.prescriptionsOuvertes}</Td>
              </tr>))}</tbody>
          </Table></div>)}
        <p className="p-4 text-xs text-slate-500">{t('Équipement conforme = en service, échéance non dépassée et aucune non-conformité ouverte.')}</p>
      </Card>
      <Card padded={false}>
        <div className="border-b border-slate-100 p-4 font-semibold text-slate-900">{t('Contrôles en retard')}</div>
        {!x.equipementsEnRetard.length ? <p className="p-4 text-sm text-slate-500">{t('Aucun contrôle en retard. 🎉')}</p> : (
          <div className="overflow-x-auto"><Table>
            <thead><tr><Th>{t('Équipement')}</Th><Th>{t('Emplacement')}</Th><Th>{t('Échéance')}</Th><Th>{t('Retard')}</Th></tr></thead>
            <tbody>{x.equipementsEnRetard.map((e) => <tr key={e.id}><Td className="font-medium text-slate-900">{e.libelle}</Td><Td>{e.emplacement || '—'}</Td><Td>{fmtDate(e.prochaineEcheance)}</Td><Td><EtatPill e={e} /></Td></tr>)}</tbody>
          </Table></div>)}
      </Card>
    </div>
  );
}

// ───────────────────────── Établissements, équipements et QR codes ─────────────────────────
function EtabForm({ api, initial, onDone, onCancel }: { api: Api; initial?: Etab; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ nom: initial?.nom ?? '', adresse: initial?.adresse ?? '', typeActivite: initial?.typeActivite ?? '', categorie: initial?.categorie ?? '5', effectifMax: String(initial?.effectifMax ?? ''), emailAlertes: initial?.emailAlertes ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async () => { setBusy(true); try { await post(api, '/etablissement/save', { ...f, id: initial?.id }); toast.success(t('Établissement enregistré')); onDone(); } catch (e) { fail(e); } finally { setBusy(false); } };
  return (
    <Card className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Nom *')}><Input value={f.nom} onChange={set('nom')} /></Field>
        <Field label={t('Type d’activité *')}><Input value={f.typeActivite} onChange={set('typeActivite')} placeholder={t('Hôtel, école, restaurant…')} /></Field>
        <div className="sm:col-span-2"><Field label={t('Adresse')}><Input value={f.adresse} onChange={set('adresse')} /></Field></div>
        <Field label={t('Catégorie ERP')}><Select value={f.categorie} onChange={(v) => setF({ ...f, categorie: v })} options={['1', '2', '3', '4', '5'].map((c) => ({ value: c, label: `${c}${c === '1' ? 're' : 'e'} catégorie` }))} /></Field>
        <Field label={t('Effectif maximal *')}><Input inputMode="numeric" value={f.effectifMax} onChange={set('effectifMax')} /></Field>
        <div className="sm:col-span-2"><Field label={t('E-mail pour les alertes d’échéance')}><Input type="email" value={f.emailAlertes} onChange={set('emailAlertes')} placeholder="securite@exemple.tn" /></Field></div>
      </div>
      <div className="flex justify-end gap-2"><Button onClick={onCancel}>{t('Annuler')}</Button><Button loading={busy} onClick={() => void submit()}>{t('Enregistrer')}</Button></div>
    </Card>
  );
}

function EtablissementsPage(props: Props) {
  const id = props.subpath.split('/').filter(Boolean)[0];
  return id ? <EtabDetail key={id} id={id} {...props} /> : <EtabList {...props} />;
}
function EtabList({ api, navigate }: Props) {
  const list = useAsync(() => get<Etab[]>(api, '/etablissements'), [api]);
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      <PageHeader title={t('Établissements')} description={t('Fiches, bâtiments, niveaux et inventaire des équipements de sécurité.')} actions={<Button icon={Plus} onClick={() => setAdding(true)}>{t('Nouvel établissement')}</Button>} />
      {adding ? <EtabForm api={api} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); void list.reload(); }} /> : null}
      {!list.data ? <Loading error={list.error} reload={list.reload} /> : !list.data.length ? <EmptyState icon={Flame} title={t('Aucun établissement')} description={t('Ajoutez votre premier établissement recevant du public.')} /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.data.map((e) => (
            <button key={e.id} onClick={() => navigate(`/${e.id}`)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300">
              <p className="font-semibold text-slate-900">{e.nom}</p>
              <p className="mt-0.5 text-sm text-slate-600">{e.typeActivite} · catégorie {e.categorie}</p>
              <p className="mt-1 text-xs text-slate-500">{e.adresse || 'Adresse non renseignée'} · {e.effectifMax} personnes max.</p>
            </button>))}
        </div>)}
    </div>
  );
}

function QrCard({ eq, onClose }: { eq: Equip; onClose: () => void }) {
  const [src, setSrc] = useState('');
  useEffect(() => { void qrToDataURL(eq.qrCode, { margin: 1, width: 240 }).then(setSrc); }, [eq.qrCode]);
  const print = () => {
    const w = window.open('', '_blank', 'width=360,height=460'); if (!w) return;
    w.document.write(`<body style="font-family:sans-serif;text-align:center"><img src="${src}" width="240"><h3>${esc(eq.libelle)}</h3><p style="font-family:monospace;font-size:18px">${esc(eq.qrCode)}</p><p>${esc(eq.emplacement)}</p></body>`);
    w.document.close(); w.focus(); w.print();
  };
  return (
    <Card className="flex flex-col items-center gap-2 text-center">
      {src ? <img src={src} alt={`QR ${eq.qrCode}`} width={200} height={200} /> : <PageSkeleton />}
      <p className="font-medium text-slate-900">{eq.libelle}</p><p className="font-mono text-sm text-slate-600">{eq.qrCode}</p>
      <div className="flex gap-2"><Button onClick={print}>{t('Imprimer l’étiquette')}</Button><Button onClick={onClose}>{t('Fermer')}</Button></div>
    </Card>
  );
}

function EquipHistory({ api, eq, onClose }: { api: Api; eq: Equip; onClose: () => void }) {
  const h = useAsync(() => get<{ controles: { id: string; date: string; resultat: string; observations: string; controleur: string; documentId: string | null }[] }>(api, '/equipement', { id: eq.id }), [eq.id]);
  const [photo, setPhoto] = useState<string | null>(null);
  const show = async (id: string) => { try { const d = await get<{ base64: string; mime: string }>(api, '/document', { id }); setPhoto(`data:${d.mime};base64,${d.base64}`); } catch (e) { fail(e); } };
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{eq.libelle}</p><p className="text-sm text-slate-600">Mis en service le {fmtDate(eq.dateMiseEnService)} · prochaine échéance {fmtDate(eq.prochaineEcheance)}</p></div><Button onClick={onClose}>{t('Fermer')}</Button></div>
      {!h.data ? <PageSkeleton /> : !h.data.controles.length ? <p className="text-sm text-slate-500">{t('Aucun contrôle enregistré.')}</p> : (
        <ul className="divide-y divide-slate-100 text-sm">{h.data.controles.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 py-2"><span className="w-24 text-slate-600">{fmtDate(c.date)}</span><Pill tone={c.resultat === 'conforme' ? 'green' : 'red'}>{c.resultat === 'conforme' ? 'Conforme' : 'Non conforme'}</Pill><span className="text-slate-600">{c.controleur}</span>{c.observations ? <span className="text-slate-800">— {c.observations}</span> : null}{c.documentId ? <button className="text-slate-700 underline" onClick={() => void show(c.documentId!)}>{t('Photo')}</button> : null}</li>))}</ul>)}
      {photo ? <img src={photo} alt={t('Photo du contrôle')} className="max-h-72 rounded-lg" /> : null}
    </Card>
  );
}

function EtabDetail({ api, navigate, id }: Props & { id: string }) {
  const d = useAsync(() => get<{ etablissement: Etab; batiments: Batiment[] }>(api, '/etablissement', { id }), [id]);
  const types = useAsync(() => get<TypeEq[]>(api, '/types'), [api]);
  const [etat, setEtat] = useState('');
  const { page, setPage, pageSize, setPageSize } = usePaging('erp-equip', { resetKey: { etat, id } });
  const eqs = useAsync(() => get<{ items: Equip[]; total: number }>(api, '/equipements', { etablissementId: id, etat, page, size: pageSize }), [id, etat, page, pageSize]);
  const [editing, setEditing] = useState(false); const [adding, setAdding] = useState(false);
  const [qr, setQr] = useState<Equip | null>(null); const [hist, setHist] = useState<Equip | null>(null);
  const [bat, setBat] = useState(''); const [niv, setNiv] = useState({ batimentId: '', nom: '' });
  const [f, setF] = useState({ libelle: '', typeId: '', niveauId: '', emplacement: '', dateMiseEnService: today() });
  if (!d.data) return <Loading error={d.error} reload={d.reload} />;
  const { etablissement: et, batiments } = d.data;
  const niveaux = batiments.flatMap((b) => b.niveaux.map((n) => ({ ...n, label: `${b.nom} — ${n.nom}` })));
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); await Promise.all([d.reload(), eqs.reload()]); } catch (e) { fail(e); } };
  const typeName = (tid: string) => types.data?.find((t) => t.id === tid)?.libelle ?? '';
  return (
    <div className="space-y-4">
      <PageHeader title={et.nom} description={`${et.typeActivite} · catégorie ${et.categorie} · ${et.effectifMax} personnes max. · ${et.adresse || 'adresse non renseignée'}`} actions={<div className="flex gap-2"><Button icon={ArrowLeft} onClick={() => navigate('/')}>{t('Retour')}</Button><Button onClick={() => setEditing(!editing)}>{t('Modifier')}</Button></div>} />
      {editing ? <EtabForm api={api} initial={et} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); void Promise.all([d.reload(), eqs.reload()]); }} /> : null}
      <Card className="space-y-3">
        <h3 className="font-semibold text-slate-900">{t('Bâtiments et niveaux')}</h3>
        {batiments.length ? <ul className="space-y-1 text-sm">{batiments.map((b) => <li key={b.id}><span className="font-medium text-slate-900">{b.nom}</span> <span className="text-slate-600">: {b.niveaux.map((n) => n.nom).join(' · ') || 'aucun niveau'}</span></li>)}</ul> : <p className="text-sm text-slate-500">{t('Aucun bâtiment.')}</p>}
        <div className="flex flex-wrap gap-2">
          <Input className="w-48" value={bat} onChange={(e) => setBat(e.target.value)} placeholder={t('Nouveau bâtiment')} /><Button disabled={!bat.trim()} onClick={() => void act(async () => { await post(api, '/batiment/add', { etablissementId: id, nom: bat }); setBat(''); }, t('Bâtiment ajouté'))}>{t('Ajouter')}</Button>
          {batiments.length ? <><Select className="w-44" value={niv.batimentId} onChange={(v) => setNiv({ ...niv, batimentId: v })} options={[{ value: '', label: t('Bâtiment…') }, ...batiments.map((b) => ({ value: b.id, label: b.nom }))]} /><Input className="w-40" value={niv.nom} onChange={(e) => setNiv({ ...niv, nom: e.target.value })} placeholder={t('Niveau (RDC…)')} /><Button disabled={!niv.batimentId || !niv.nom.trim()} onClick={() => void act(async () => { await post(api, '/niveau/add', { ...niv, ordre: niveaux.length }); setNiv({ ...niv, nom: '' }); }, t('Niveau ajouté'))}>{t('Ajouter')}</Button></> : null}
        </div>
      </Card>
      {qr ? <QrCard eq={qr} onClose={() => setQr(null)} /> : null}
      {hist ? <EquipHistory api={api} eq={hist} onClose={() => setHist(null)} /> : null}
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h3 className="font-semibold text-slate-900">{t('Équipements')}</h3>
          <div className="flex gap-2"><Select className="w-40" value={etat} onChange={setEtat} options={[{ value: '', label: t('Tous les états') }, { value: 'en_retard', label: t('En retard') }, { value: 'a_venir', label: t('À venir') }, { value: 'ok', label: t('À jour') }, { value: 'hors_service', label: t('Hors service') }]} /><Button icon={Plus} onClick={() => setAdding(!adding)}>{t('Équipement')}</Button></div>
        </div>
        {adding ? (
          <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2">
            <Field label={t('Libellé *')}><Input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} /></Field>
            <Field label={t('Type *')}><Select value={f.typeId} onChange={(v) => setF({ ...f, typeId: v })} options={[{ value: '', label: t('Choisir…') }, ...(types.data ?? []).map((t) => ({ value: t.id, label: t.libelle }))]} /></Field>
            <Field label={t('Niveau')}><Select value={f.niveauId} onChange={(v) => setF({ ...f, niveauId: v })} options={[{ value: '', label: t('— Aucun —') }, ...niveaux.map((n) => ({ value: n.id, label: n.label }))]} /></Field>
            <Field label={t('Emplacement')}><Input value={f.emplacement} onChange={(e) => setF({ ...f, emplacement: e.target.value })} placeholder={t('Couloir, près de l’escalier')} /></Field>
            <Field label={t('Date de mise en service *')}><Input type="date" value={f.dateMiseEnService} onChange={(e) => setF({ ...f, dateMiseEnService: e.target.value })} /></Field>
            <div className="flex items-end justify-end"><Button onClick={() => void act(async () => { await post(api, '/equipement/save', { ...f, etablissementId: id, niveauId: f.niveauId || null }); setF({ ...f, libelle: '' }); setAdding(false); }, 'Équipement créé (QR code généré)')}>{t('Créer')}</Button></div>
          </div>) : null}
        {!eqs.data ? <Loading error={eqs.error} reload={eqs.reload} /> : !eqs.data.items.length ? <EmptyState icon={Flame} title={t('Aucun équipement')} description={t('Ajoutez extincteurs, alarmes, éclairages de sécurité, RIA, issues de secours…')} /> : (<>
          <div className="overflow-x-auto"><Table>
            <thead><tr><Th>{t('Équipement')}</Th><Th>{t('Type')}</Th><Th>{t('Dernier contrôle')}</Th><Th>{t('Prochaine échéance')}</Th><Th>{t('État')}</Th><Th>{' '}</Th></tr></thead>
            <tbody>{eqs.data.items.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/70">
                <Td><button className="text-left" onClick={() => setHist(e)}><p className="font-medium text-slate-900">{e.libelle}</p><p className="text-xs text-slate-500">{e.emplacement || '—'}</p></button></Td>
                <Td>{typeName(e.typeId)}</Td><Td>{e.dernierControle ? fmtDate(e.dernierControle) : '—'}</Td><Td>{fmtDate(e.prochaineEcheance)}</Td><Td><EtatPill e={e} /></Td>
                <Td><Button icon={QrCode} onClick={() => setQr(e)}>{t('QR')}</Button></Td>
              </tr>))}</tbody>
          </Table></div>
          <Pagination page={page} pageSize={pageSize} total={eqs.data.total} onPage={setPage} onPageSize={setPageSize} noun="équipements" />
        </>)}
      </Card>
    </div>
  );
}

// ───────────────────────── Saisie d'un contrôle (mobile, hors-ligne) ─────────────────────────
interface Pending { body: Record<string, unknown>; label: string; at: string }
const QUEUE = 'erp-controles-en-attente';
function ControlesPage({ api, subpath }: Props) {
  const etabs = useEtabs(api);
  const eid = etabs.current?.id;
  const todo = useAsync(() => (eid ? get<{ items: Equip[] }>(api, '/equipements', { etablissementId: eid, size: 100 }) : Promise.resolve({ items: [] as Equip[] })), [eid]);
  const [sel, setSel] = useState<Equip | null>(null);
  const [code, setCode] = useState(subpath.split('/').filter(Boolean)[0] ?? '');
  const [f, setF] = useState({ date: today(), resultat: '', observations: '', controleur: store.get('erp-controleur', '') });
  const [photo, setPhoto] = useState<{ nom: string; mime: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<Pending[]>(() => store.get<Pending[]>(QUEUE, []));
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);

  const lookup = async (c: string) => {
    try { const r = await get<{ equipement: Equip }>(api, '/equipement/qr', { code: c.trim() }); setSel(r.equipement); toast.success(`${r.equipement.libelle}`); } catch (e) { fail(e); }
  };
  useEffect(() => { if (code && !sel) void lookup(code); /* QR passé dans l'URL */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const scan = async (file: File) => {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) return toast.error(t('Lecture de QR non disponible sur ce navigateur : saisissez le code imprimé sur l’étiquette.'));
    try { const found = await new Detector({ formats: ['qr_code'] }).detect(await createImageBitmap(file)); if (!found.length) return toast.error(t('Aucun QR code lisible sur la photo')); setCode(found[0].rawValue); await lookup(found[0].rawValue); } catch (e) { fail(e); }
  };

  const flush = async () => {
    const rest: Pending[] = [];
    let sent = 0;
    for (const p of queue) { try { await post(api, '/controle/add', p.body); sent++; } catch (e) { if (!navigator.onLine) rest.push(p); else toast.error(`${p.label} : ${errorMessage(e)}`); } }
    setQueue(rest); store.set(QUEUE, rest);
    if (sent) { toast.success(`${sent} contrôle(s) synchronisé(s)`); void todo.reload(); }
  };
  useEffect(() => { if (online && queue.length) void flush(); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!sel || !f.resultat) return;
    const body = { equipementId: sel.id, ...f, photo: photo ?? undefined };
    store.set('erp-controleur', f.controleur);
    setBusy(true);
    try {
      if (!navigator.onLine) throw new TypeError('hors ligne');
      const r = await post<{ nonConformite: unknown }>(api, '/controle/add', body);
      toast.success(r.nonConformite ? t('Contrôle enregistré — non-conformité créée') : t('Contrôle enregistré'));
      reset(); void todo.reload();
    } catch (e) {
      if (e instanceof TypeError || !navigator.onLine) { // réseau indisponible : on met en file d'attente sur l'appareil
        const q = [...queue, { body, label: sel.libelle, at: new Date().toISOString() }]; setQueue(q); store.set(QUEUE, q);
        toast.success(t('Pas de réseau : contrôle conservé sur l’appareil, il sera envoyé automatiquement.')); reset();
      } else fail(e);
    } finally { setBusy(false); }
  };
  const reset = () => { setSel(null); setCode(''); setPhoto(null); setF({ ...f, resultat: '', observations: '' }); };

  const aFaire = (todo.data?.items ?? []).filter((e) => e.etat === 'en_retard' || e.etat === 'a_venir');
  return (
    <div className="space-y-4">
      <PageHeader title={t('Saisie d’un contrôle')} description={t('Scannez le QR code de l’équipement ou choisissez-le dans la liste.')} actions={<EtabPicker etabs={etabs} />} />
      {!online || queue.length ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">{online ? '' : 'Hors ligne — '}{queue.length} contrôle(s) en attente d’envoi sur cet appareil.</p>
          {online && queue.length ? <Button icon={RefreshCw} onClick={() => void flush()}>{t('Synchroniser')}</Button> : null}
        </Card>) : null}

      {!sel ? (<>
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-[200px] flex-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Code du QR : EQ-XXXXXXXXXXXX')} />
            <Button disabled={!code.trim()} onClick={() => void lookup(code)}>{t('Rechercher')}</Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-black hover:bg-slate-50"><ScanLine className="h-4 w-4" />Scanner
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) void scan(x); }} /></label>
          </div>
        </Card>
        <Card padded={false}>
          <div className="border-b border-slate-100 p-4 font-semibold text-slate-900">À contrôler ({aFaire.length})</div>
          {!todo.data ? <PageSkeleton /> : !aFaire.length ? <p className="p-4 text-sm text-slate-500">{t('Rien à contrôler dans les 30 prochains jours.')}</p> : (
            <ul className="divide-y divide-slate-100">{aFaire.map((e) => (
              <li key={e.id}><button className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-slate-50" onClick={() => setSel(e)}><span><span className="block font-medium text-slate-900">{e.libelle}</span><span className="block text-xs text-slate-500">{e.emplacement || '—'} · échéance {fmtDate(e.prochaineEcheance)}</span></span><EtatPill e={e} /></button></li>))}</ul>)}
        </Card>
      </>) : (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-2"><div><p className="text-lg font-semibold text-slate-900">{sel.libelle}</p><p className="text-sm text-slate-600">{sel.emplacement || '—'} · <span className="font-mono">{sel.qrCode}</span> · échéance {fmtDate(sel.prochaineEcheance)}</p></div><Button onClick={reset}>{t('Changer')}</Button></div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setF({ ...f, resultat: 'conforme' })} className={`flex items-center justify-center gap-2 rounded-xl border-2 p-4 text-base font-semibold ${f.resultat === 'conforme' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}><Check className="h-5 w-5" />{t('Conforme')}</button>
            <button onClick={() => setF({ ...f, resultat: 'non_conforme' })} className={`flex items-center justify-center gap-2 rounded-xl border-2 p-4 text-base font-semibold ${f.resultat === 'non_conforme' ? 'border-red-600 bg-red-50 text-red-800' : 'border-slate-200 bg-white text-slate-700'}`}><AlertTriangle className="h-5 w-5" />{t('Non conforme')}</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Date du contrôle')}><Input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label={t('Nom du contrôleur *')}><Input value={f.controleur} onChange={(e) => setF({ ...f, controleur: e.target.value })} /></Field>
          </div>
          <Field label={f.resultat === 'non_conforme' ? 'Observations * (décrivez le défaut)' : 'Observations'}><textarea className={field} rows={3} value={f.observations} onChange={(e) => setF({ ...f, observations: e.target.value })} /></Field>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-black hover:bg-slate-50">📷 {photo ? 'Changer la photo' : 'Ajouter une photo'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) shrink(x).then(setPhoto).catch(fail); }} /></label>
            {photo ? <><img alt={t('Aperçu')} className="h-14 w-14 rounded-lg object-cover" src={`data:${photo.mime};base64,${photo.base64}`} /><button className="text-sm text-slate-600 underline" onClick={() => setPhoto(null)}>{t('Retirer')}</button></> : null}
          </div>
          <Button loading={busy} disabled={!f.resultat || f.controleur.trim().length < 2} onClick={() => void submit()} className="w-full">{t('Enregistrer le contrôle')}</Button>
        </Card>)}
    </div>
  );
}

// ───────────────────────── Non-conformités et plan d'action ─────────────────────────
function NcPage(props: Props) {
  const id = props.subpath.split('/').filter(Boolean)[0];
  return id ? <NcDetail key={id} id={id} {...props} /> : <NcList {...props} />;
}
function NcList({ api, navigate }: Props) {
  const etabs = useEtabs(api);
  const [statut, setStatut] = useState('');
  const eid = etabs.current?.id;
  const list = useAsync(() => (eid ? get<Nc[]>(api, '/non-conformites', { etablissementId: eid, statut }) : Promise.resolve([] as Nc[])), [eid, statut]);
  return (
    <div className="space-y-4">
      <PageHeader title={t('Non-conformités')} description={t('Créées automatiquement à chaque contrôle négatif ; suivies jusqu’à la levée.')} actions={<div className="flex flex-wrap gap-2"><EtabPicker etabs={etabs} /><Select className="w-40" value={statut} onChange={setStatut} options={[{ value: '', label: t('Tous les statuts') }, { value: 'ouverte', label: t('Ouvertes') }, { value: 'en_cours', label: t('En cours') }, { value: 'levee', label: t('Levées') }]} /></div>} />
      <Card padded={false}>
        {!list.data ? <Loading error={list.error} reload={list.reload} /> : !list.data.length ? <EmptyState icon={ClipboardCheck} title={t('Aucune non-conformité')} description={t('Aucune non-conformité ne correspond à ce filtre.')} /> : (
          <div className="overflow-x-auto"><Table>
            <thead><tr><Th>{t('Équipement')}</Th><Th>{t('Constat')}</Th><Th>{t('Date')}</Th><Th>{t('Statut')}</Th></tr></thead>
            <tbody>{list.data.map((n) => <tr key={n.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => navigate(`/${n.id}`)}><Td className="font-medium text-slate-900">{n.equipement}</Td><Td className="max-w-xs truncate">{n.description}</Td><Td>{fmtDate(n.createdAt)}</Td><Td><Pill tone={NC_LABEL[n.statut][1]}>{t(NC_LABEL[n.statut][0])}</Pill></Td></tr>)}</tbody>
          </Table></div>)}
      </Card>
    </div>
  );
}
function NcDetail({ api, navigate, id }: Props & { id: string }) {
  const d = useAsync(() => get<{ nonConformite: Nc & { leveeNote: string }; equipement: Equip; actions: Action[] }>(api, '/non-conformite', { id }), [id]);
  const confirm = useConfirm();
  const [a, setA] = useState({ description: '', responsable: '', echeance: '' });
  const [note, setNote] = useState('');
  if (!d.data) return <Loading error={d.error} reload={d.reload} />;
  const { nonConformite: nc, equipement, actions } = d.data;
  const done = nc.statut === 'levee';
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); await d.reload(); } catch (e) { fail(e); } };
  const lever = async () => { if (await confirm({ title: t('Lever cette non-conformité ?'), message: t('L’opération est inscrite au registre de sécurité et ne pourra pas être annulée.'), confirmLabel: t('Lever') })) void run(() => post(api, '/non-conformite/lever', { id, note }), t('Non-conformité levée')); };
  return (
    <div className="space-y-4">
      <PageHeader title={`${t('Non-conformité')} — ${equipement.libelle}`} description={nc.description} actions={<div className="flex items-center gap-2"><Pill tone={NC_LABEL[nc.statut][1]}>{t(NC_LABEL[nc.statut][0])}</Pill><Button icon={ArrowLeft} onClick={() => navigate('/')}>{t('Retour')}</Button></div>} />
      <Card className="space-y-3">
        <h3 className="font-semibold text-slate-900">{t('Plan d’action')}</h3>
        {!actions.length ? <p className="text-sm text-slate-500">{t('Aucune action : ajoutez au moins une action corrective.')}</p> : (
          <ul className="divide-y divide-slate-100">{actions.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><span className="block font-medium text-slate-900">{x.description}</span><span className="block text-xs text-slate-500">{x.responsable} · échéance {fmtDate(x.echeance)}{!done && x.statut !== 'terminee' && x.echeance < today() ? ' · EN RETARD' : ''}</span></span>
              {done ? <Pill tone="green">{t('Terminée')}</Pill> : <Select className="w-36" value={x.statut} onChange={(v) => void run(() => post(api, '/action/update', { id: x.id, statut: v }), t('Action mise à jour'))} options={ACTION_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))} />}</li>))}</ul>)}
        {!done ? (
          <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><Input value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} placeholder={t('Action corrective')} /></div>
            <Input value={a.responsable} onChange={(e) => setA({ ...a, responsable: e.target.value })} placeholder={t('Responsable')} />
            <Input type="date" value={a.echeance} onChange={(e) => setA({ ...a, echeance: e.target.value })} />
            <div className="sm:col-span-4 flex justify-end"><Button icon={Plus} disabled={!a.description || !a.responsable || !a.echeance} onClick={() => void run(async () => { await post(api, '/action/add', { nonConformiteId: id, ...a }); setA({ description: '', responsable: '', echeance: '' }); }, t('Action ajoutée'))}>{t('Ajouter l’action')}</Button></div>
          </div>) : <p className="text-sm text-slate-600">Levée le {fmtDateTime(nc.leveeAt!)}{nc.leveeNote ? ` — ${nc.leveeNote}` : ''}</p>}
      </Card>
      {!done ? <Card className="space-y-2"><h3 className="font-semibold text-slate-900">{t('Levée de la non-conformité')}</h3><p className="text-sm text-slate-600">{t('Possible quand toutes les actions sont terminées.')}</p><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Note de levée (facultatif)')} /><div className="flex justify-end"><Button disabled={!actions.length || actions.some((x) => x.statut !== 'terminee')} onClick={() => void lever()}>{t('Lever la non-conformité')}</Button></div></Card> : null}
    </div>
  );
}

// ───────────────────────── Registre de sécurité ─────────────────────────
function describe(e: Entry): string {
  const p = e.payload;
  const d = (v: unknown) => (v == null || v === '' ? '' : String(v));
  switch (e.type) {
    case 'controle': return `${p.equipement} — ${p.resultat === 'conforme' ? t('conforme') : t('NON CONFORME')} (${t('contrôle du')} ${p.date})${p.observations ? ` · ${p.observations}` : ''}${p.documentId ? ' · 📷' : ''}`;
    case 'non_conformite': return `${t('Ouverte sur')} ${p.equipement} : ${p.description}`;
    case 'action': return `${p.evenement === 'creation' ? t('Nouvelle action') : t('Mise à jour')} : ${p.description ?? ''}${p.responsable ? ` (${p.responsable})` : ''}${p.statut ? ` → ${p.statut}` : ''}`;
    case 'levee': return `${t('Non-conformité levée')}${p.note ? ` — ${p.note}` : ''}`;
    case 'exercice': return `${p.type === 'formation' ? t('Formation') : t('Exercice d’évacuation')} ${t('du')} ${p.date} · ${p.participants} ${t('participant(s)')} · ${p.dureeMin} min`;
    case 'intervention': return `${p.intervenant} ${t('le')} ${p.date}${p.equipement ? ` ${t('sur')} ${p.equipement}` : ''} : ${p.description}`;
    case 'correction': return `${t('Corrige l’entrée n°')}${p.entreeCorrigee} — ${p.motif} : ${p.correction}`;
    case 'visite': return `${t('Visite de la commission')} ${t('du')} ${p.date} — ${p.avis === 'favorable' ? t('Avis favorable') : t('Avis défavorable')}${p.president ? ` · ${p.president}` : ''}${Array.isArray(p.prescriptions) && p.prescriptions.length ? ` · ${p.prescriptions.length} ${t('Prescriptions').toLowerCase()}` : ''}${p.prochaineVisite ? ` · ${t('Prochaine visite prévue le')} ${p.prochaineVisite}` : ''}`;
    case 'prescription': return `${t('Prescription')} (${d(p.evenement) === 'levee' ? t('Levée') : d(p.evenement) === 'ajoutee' ? t('ajoutée') : t('Mise à jour')}) : ${d(p.description)} — ${d(p.responsable)} · ${t('Échéance')} ${d(p.echeance)}`;
    default: return '';
  }
}
function RegistrePage({ api }: Props) {
  const etabs = useEtabs(api);
  const eid = etabs.current?.id;
  const [type, setType] = useState('');
  const { page, setPage, pageSize, setPageSize } = usePaging('erp-registre', { resetKey: { eid, type } });
  const list = useAsync(() => (eid ? get<{ items: Entry[]; total: number; integrity: Integrity }>(api, '/registre', { etablissementId: eid, type, page, size: pageSize }) : Promise.resolve(null)), [eid, type, page, pageSize]);
  const [form, setForm] = useState<'intervention' | { corrige: Entry } | null>(null);
  const [iv, setIv] = useState({ date: today(), intervenant: '', description: '' });
  const [corr, setCorr] = useState({ motif: '', correction: '' });
  const pdf = async () => { try { const r = await get<{ filename: string; base64: string }>(api, '/registre/pdf', { etablissementId: eid }); saveBase64(r.filename, r.base64, 'application/pdf'); } catch (e) { fail(e); } };
  const save = async (path: string, body: unknown, ok: string) => { try { await post(api, path, body); toast.success(ok); setForm(null); await list.reload(); } catch (e) { fail(e); } };
  return (
    <div className="space-y-4">
      <PageHeader title={t('Registre de sécurité')} description={t('Historique horodaté et non modifiable. Une erreur se corrige par une nouvelle entrée.')} actions={<div className="flex flex-wrap gap-2"><EtabPicker etabs={etabs} /><Button icon={Download} onClick={() => void pdf()}>{t('Exporter en PDF')}</Button><Button icon={Plus} onClick={() => setForm('intervention')}>{t('Intervention')}</Button></div>} />
      {list.data ? <Card className={`flex items-start gap-3 ${list.data.integrity.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
        <ShieldCheck className={`mt-0.5 h-5 w-5 shrink-0 ${list.data.integrity.ok ? 'text-emerald-700' : 'text-red-700'}`} />
        <p className={`text-sm ${list.data.integrity.ok ? 'text-emerald-900' : 'text-red-900'}`}>{list.data.integrity.ok ? `Intégrité vérifiée : ${list.data.integrity.checked} entrée(s) chaînées par empreinte SHA-256, aucune altération.` : `ALERTE : registre altéré à l’entrée n°${list.data.integrity.brokenAt} (${list.data.integrity.reason}).`}</p>
      </Card> : null}
      {form === 'intervention' ? (
        <Card className="space-y-3"><h3 className="font-semibold text-slate-900">{t('Nouvelle intervention')}</h3>
          <div className="grid gap-3 sm:grid-cols-3"><Input type="date" max={today()} value={iv.date} onChange={(e) => setIv({ ...iv, date: e.target.value })} /><div className="sm:col-span-2"><Input value={iv.intervenant} onChange={(e) => setIv({ ...iv, intervenant: e.target.value })} placeholder={t('Intervenant / société')} /></div></div>
          <textarea className={field} rows={2} value={iv.description} onChange={(e) => setIv({ ...iv, description: e.target.value })} placeholder={t('Description de l’intervention')} />
          <div className="flex justify-end gap-2"><Button onClick={() => setForm(null)}>{t('Annuler')}</Button><Button disabled={!iv.intervenant || !iv.description} onClick={() => void save('/registre/intervention', { etablissementId: eid, ...iv }, t('Intervention inscrite au registre'))}>{t('Inscrire')}</Button></div></Card>) : null}
      {form && form !== 'intervention' ? (
        <Card className="space-y-3"><h3 className="font-semibold text-slate-900">{t('Corriger l’entrée n°')}{form.corrige.seq}</h3><p className="text-sm text-slate-600">{t('L’entrée d’origine reste visible et intacte ; la correction s’ajoute à la suite avec votre nom et la date.')}</p>
          <Input value={corr.motif} onChange={(e) => setCorr({ ...corr, motif: e.target.value })} placeholder={t('Motif de la correction')} /><textarea className={field} rows={2} value={corr.correction} onChange={(e) => setCorr({ ...corr, correction: e.target.value })} placeholder={t('Information correcte')} />
          <div className="flex justify-end gap-2"><Button onClick={() => setForm(null)}>{t('Annuler')}</Button><Button disabled={!corr.motif || !corr.correction} onClick={() => void save('/registre/correction', { entryId: form.corrige.id, ...corr }, t('Correction inscrite'))}>{t('Inscrire la correction')}</Button></div></Card>) : null}
      <Card padded={false}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4"><h3 className="font-semibold text-slate-900">{t('Entrées')}</h3><Select className="w-48" value={type} onChange={setType} options={[{ value: '', label: t('Tous les types') }, ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))]} /></div>
        {!list.data ? <Loading error={list.error} reload={list.reload} /> : !list.data.items.length ? <EmptyState icon={FileText} title={t('Registre vide')} description={t('Les contrôles, exercices et interventions s’inscrivent ici automatiquement.')} /> : (<>
          <div className="overflow-x-auto"><Table>
            <thead><tr><Th>{t('N°')}</Th><Th>{t('Date et heure')}</Th><Th>{t('Type')}</Th><Th>{t('Détail')}</Th><Th>{t('Auteur')}</Th><Th>{' '}</Th></tr></thead>
            <tbody>{list.data.items.map((e) => (
              <tr key={e.id} className={e.corrigee ? 'bg-amber-50/50' : ''}>
                <Td className="tabular-nums">{e.seq}</Td><Td className="whitespace-nowrap">{fmtDateTime(e.occurredAt)}</Td><Td><Pill tone={e.type === 'correction' ? 'amber' : e.type === 'non_conformite' ? 'red' : 'slate'}>{t(TYPE_LABEL[e.type])}</Pill></Td>
                <Td className="min-w-[260px]">{describe(e)}{e.corrigee ? <span className="ml-1 text-xs text-amber-800">{t('(corrigée)')}</span> : null}<p className="font-mono text-[10px] text-slate-400">{e.hash.slice(0, 16)}…</p></Td>
                <Td>{e.auteur}</Td><Td>{e.type !== 'correction' ? <Button onClick={() => { setCorr({ motif: '', correction: '' }); setForm({ corrige: e }); }}>{t('Corriger')}</Button> : null}</Td>
              </tr>))}</tbody>
          </Table></div>
          <Pagination page={page} pageSize={pageSize} total={list.data.total} onPage={setPage} onPageSize={setPageSize} noun="entrées" />
        </>)}
      </Card>
    </div>
  );
}

// ───────────────────────── Exercices et formations ─────────────────────────
function ExercicesPage({ api }: Props) {
  const etabs = useEtabs(api);
  const eid = etabs.current?.id;
  const list = useAsync(() => (eid ? get<{ id: string; type: string; date: string; participants: number; dureeMin: number; observations: string; prochainRecyclage: string | null; recyclageEnRetard: boolean }[]>(api, '/exercices', { etablissementId: eid }) : Promise.resolve([])), [eid]);
  const [f, setF] = useState({ type: 'evacuation', date: today(), participants: '', dureeMin: '', observations: '', recyclageMois: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); try { await post(api, '/exercice/add', { etablissementId: eid, ...f }); toast.success(t('Inscrit au registre')); setF({ ...f, participants: '', dureeMin: '', observations: '' }); await list.reload(); } catch (e) { fail(e); } finally { setBusy(false); } };
  return (
    <div className="space-y-4">
      <PageHeader title={t('Exercices et formations')} description={t('Exercices d’évacuation, formations du personnel et rappels de recyclage.')} actions={<EtabPicker etabs={etabs} />} />
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('Type')}><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={[{ value: 'evacuation', label: t('Exercice d’évacuation') }, { value: 'formation', label: t('Formation du personnel') }]} /></Field>
          <Field label={t('Date')}><Input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label={t('Recyclage (mois)')}><Input inputMode="numeric" value={f.recyclageMois} onChange={(e) => setF({ ...f, recyclageMois: e.target.value })} placeholder="12" /></Field>
          <Field label={t('Participants')}><Input inputMode="numeric" value={f.participants} onChange={(e) => setF({ ...f, participants: e.target.value })} /></Field>
          <Field label={t('Durée (minutes)')}><Input inputMode="numeric" value={f.dureeMin} onChange={(e) => setF({ ...f, dureeMin: e.target.value })} /></Field>
          <Field label={t('Observations')}><Input value={f.observations} onChange={(e) => setF({ ...f, observations: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end"><Button loading={busy} disabled={!f.participants || !f.dureeMin} onClick={() => void submit()}>{t('Enregistrer')}</Button></div>
      </Card>
      <Card padded={false}>
        {!list.data ? <Loading error={list.error} reload={list.reload} /> : !list.data.length ? <EmptyState icon={Flame} title={t('Aucun exercice')} description={t('Les exercices et formations enregistrés apparaîtront ici.')} /> : (
          <div className="overflow-x-auto"><Table>
            <thead><tr><Th>{t('Date')}</Th><Th>{t('Type')}</Th><Th>{t('Participants')}</Th><Th>{t('Durée')}</Th><Th>{t('Prochain recyclage')}</Th></tr></thead>
            <tbody>{list.data.map((x) => <tr key={x.id}><Td>{fmtDate(x.date)}</Td><Td>{x.type === 'formation' ? 'Formation' : 'Évacuation'}</Td><Td>{x.participants}</Td><Td>{x.dureeMin} min</Td><Td>{x.prochainRecyclage ? <Pill tone={x.recyclageEnRetard ? 'red' : 'green'}>{fmtDate(x.prochainRecyclage)}{x.recyclageEnRetard ? ' — à renouveler' : ''}</Pill> : '—'}</Td></tr>)}</tbody>
          </Table></div>)}
      </Card>
    </div>
  );
}

// ───────────────────────── Commission de sécurité (bonus) ─────────────────────────
interface Presc { id: string; visiteId: string; description: string; responsable: string; echeance: string; statut: string; leveeAt: string | null; enRetard: boolean }
interface VisiteRow { id: string; date: string; avis: string; president: string; observations: string; prochaineVisite: string | null; prescriptions: Presc[]; ouvertes: number }
interface Visites { items: VisiteRow[]; prochaineVisite: string | null; prochaineVisiteEnRetard: boolean }
const emptyPresc = () => ({ description: '', responsable: '', echeance: '' });

function VisitesPage({ api }: Props) {
  const etabs = useEtabs(api);
  const eid = etabs.current?.id;
  const confirm = useConfirm();
  const list = useAsync(() => (eid ? get<Visites>(api, '/visites', { etablissementId: eid }) : Promise.resolve({ items: [], prochaineVisite: null, prochaineVisiteEnRetard: false } as Visites)), [eid]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ date: today(), avis: 'favorable', president: '', prochaineVisite: '', observations: '' });
  const [rows, setRows] = useState([emptyPresc()]);
  const valid = rows.filter((r) => r.description.trim() || r.responsable.trim() || r.echeance);
  const rowsOk = valid.every((r) => r.description.trim() && r.responsable.trim() && r.echeance);
  const submit = async () => {
    setBusy(true);
    try {
      await post(api, '/visite/add', { etablissementId: eid, ...f, prescriptions: valid });
      toast.success(t('Visite inscrite au registre'));
      setAdding(false); setF({ date: today(), avis: 'favorable', president: '', prochaineVisite: '', observations: '' }); setRows([emptyPresc()]);
      await list.reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const setStatut = async (p: Presc, statut: string) => {
    if (statut === p.statut) return;
    if (statut === 'levee' && !(await confirm({ title: t('Lever cette prescription ?'), message: t('L’opération est inscrite au registre de sécurité et ne pourra pas être annulée.'), confirmLabel: t('Lever') }))) return;
    try { await post(api, '/prescription/update', { id: p.id, statut }); toast.success(t('Prescription mise à jour')); await list.reload(); } catch (e) { fail(e); }
  };
  const upd = (i: number, k: 'description' | 'responsable' | 'echeance', v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-4">
      <PageHeader title={t('Commission de sécurité')} description={t('Visites de la commission, avis et suivi des prescriptions jusqu’à leur levée.')} actions={<div className="flex flex-wrap items-center gap-2"><EtabPicker etabs={etabs} /><Button icon={Plus} onClick={() => setAdding(!adding)}>{t('Nouvelle visite')}</Button></div>} />
      {list.data?.prochaineVisite && (
        <Card><p className="text-sm text-slate-700">{t('Prochaine visite prévue le')} <strong>{fmtDate(list.data.prochaineVisite)}</strong> {list.data.prochaineVisiteEnRetard ? <Pill tone="red">{t('Date dépassée')}</Pill> : null}</p></Card>
      )}
      {adding && (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Date de la visite')}><Input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label={t('Avis')}><Select value={f.avis} onChange={(v) => setF({ ...f, avis: v })} options={[{ value: 'favorable', label: t('Favorable') }, { value: 'defavorable', label: t('Défavorable') }]} /></Field>
            <Field label={t('Commission / président')}><Input value={f.president} onChange={(e) => setF({ ...f, president: e.target.value })} /></Field>
            <Field label={t('Prochaine visite (facultatif)')}><Input type="date" value={f.prochaineVisite} onChange={(e) => setF({ ...f, prochaineVisite: e.target.value })} /></Field>
          </div>
          <Field label={t('Observations')}><textarea className={field} rows={2} value={f.observations} onChange={(e) => setF({ ...f, observations: e.target.value })} /></Field>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">{t('Prescriptions')}</p>
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <Input placeholder={t('Description')} value={r.description} onChange={(e) => upd(i, 'description', e.target.value)} />
                <Input placeholder={t('Responsable')} value={r.responsable} onChange={(e) => upd(i, 'responsable', e.target.value)} />
                <Input type="date" value={r.echeance} onChange={(e) => upd(i, 'echeance', e.target.value)} />
                <Button icon={X} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>{t('Retirer')}</Button>
              </div>))}
            <Button icon={Plus} onClick={() => setRows([...rows, emptyPresc()])}>{t('Ajouter une prescription')}</Button>
          </div>
          <div className="flex justify-end gap-2"><Button onClick={() => setAdding(false)}>{t('Annuler')}</Button><Button loading={busy} disabled={!eid || !f.date || !rowsOk} onClick={() => void submit()}>{t('Enregistrer')}</Button></div>
        </Card>)}
      {!list.data ? <Loading error={list.error} reload={list.reload} /> : !list.data.items.length ? (
        <Card><EmptyState icon={ShieldCheck} title={t('Aucune visite')} description={t('Les visites de la commission de sécurité enregistrées apparaîtront ici.')} /></Card>
      ) : list.data.items.map((v) => (
        <Card key={v.id} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{t('Visite du')} {fmtDate(v.date)}</h3>
            <Pill tone={v.avis === 'favorable' ? 'green' : 'red'}>{v.avis === 'favorable' ? t('Avis favorable') : t('Avis défavorable')}</Pill>
            {v.ouvertes > 0 ? <Pill tone="amber">{v.ouvertes} {t('prescription(s) ouverte(s)')}</Pill> : null}
          </div>
          {(v.president || v.observations) && <p className="text-sm text-slate-600">{[v.president, v.observations].filter(Boolean).join(' — ')}</p>}
          {!v.prescriptions.length ? <p className="text-sm text-slate-500">{t('Aucune prescription.')}</p> : (
            <div className="overflow-x-auto"><Table>
              <thead><tr><Th>{t('Prescription')}</Th><Th>{t('Responsable')}</Th><Th>{t('Échéance')}</Th><Th>{t('Statut')}</Th></tr></thead>
              <tbody>{v.prescriptions.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium text-slate-900">{p.description}</Td><Td>{p.responsable}</Td>
                  <Td>{fmtDate(p.echeance)} {p.enRetard ? <Pill tone="red">{t('En retard')}</Pill> : null}</Td>
                  <Td>{p.statut === 'levee' ? <Pill tone="green">{t('Levée')}</Pill> : <Select value={p.statut} onChange={(x) => void setStatut(p, x)} className="w-36" options={[{ value: 'a_faire', label: t('À faire') }, { value: 'en_cours', label: t('En cours') }, { value: 'levee', label: t('Levée') }]} />}</Td>
                </tr>))}</tbody>
            </Table></div>)}
        </Card>))}
    </div>
  );
}

// ───────────────────────── Plans d'étage (bonus) ─────────────────────────
interface PlanRow { id: string; niveauId: string; nom: string; documentId: string; niveau: string; positions: { equipementId: string; x: number; y: number }[] }
const DOT: Record<Etat, string> = { ok: 'bg-emerald-500', a_venir: 'bg-amber-500', en_retard: 'bg-red-600', hors_service: 'bg-slate-400' };

function PlansPage({ api }: Props) {
  const etabs = useEtabs(api);
  const eid = etabs.current?.id;
  const struct = useAsync(() => (eid ? get<{ batiments: Batiment[] }>(api, '/etablissement', { id: eid }) : Promise.resolve({ batiments: [] as Batiment[] })), [eid]);
  const plans = useAsync(() => (eid ? get<PlanRow[]>(api, '/plans', { etablissementId: eid }) : Promise.resolve([] as PlanRow[])), [eid]);
  const eqs = useAsync(() => (eid ? get<{ items: Equip[] }>(api, '/equipements', { etablissementId: eid, size: 100 }) : Promise.resolve({ items: [] as Equip[] })), [eid]);
  const [niv, setNiv] = useState('');
  const [sel, setSel] = useState('');
  const [busy, setBusy] = useState(false);
  const niveaux = (struct.data?.batiments ?? []).flatMap((b) => b.niveaux.map((n) => ({ value: n.id, label: `${b.nom} — ${n.nom}` })));
  const niveauId = niveaux.some((n) => n.value === niv) ? niv : niveaux[0]?.value ?? '';
  const plan = plans.data?.find((p) => p.niveauId === niveauId);
  const img = useAsync(() => (plan ? get<{ mime: string; base64: string }>(api, '/document', { id: plan.documentId }) : Promise.resolve(null)), [plan?.documentId]);
  const equipements = eqs.data?.items ?? [];
  const placed = new Map((plan?.positions ?? []).map((p) => [p.equipementId, p]));
  const current = equipements.find((e) => e.id === sel);
  const upload = async (file: File) => {
    setBusy(true);
    try { const image = await shrink(file, 1600); await post(api, '/plan/save', { etablissementId: eid, niveauId, nom: niveaux.find((n) => n.value === niveauId)?.label ?? '', image }); toast.success(t('Plan enregistré')); await plans.reload(); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };
  const place = async (equipementId: string, x: number | null, y: number | null) => {
    if (!plan) return;
    try { await post(api, '/plan/position', { planId: plan.id, equipementId, x, y }); await plans.reload(); } catch (e) { fail(e); }
  };
  const onPlan = (ev: ReactMouseEvent<HTMLDivElement>) => {
    if (!sel) return toast.error(t('Choisissez d’abord un équipement dans la liste.'));
    const r = ev.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const pct = (v: number, size: number) => Math.round(Math.min(100, Math.max(0, (v / size) * 100)) * 10) / 10;
    void place(sel, pct(ev.clientX - r.left, r.width), pct(ev.clientY - r.top, r.height));
  };
  return (
    <div className="space-y-4">
      <PageHeader title={t('Plans d’étage')} description={t('Importez le plan d’un niveau puis positionnez les équipements en touchant le plan.')} actions={<EtabPicker etabs={etabs} />} />
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('Niveau')}><Select value={niveauId} onChange={setNiv} options={niveaux.length ? niveaux : [{ value: '', label: t('Aucun niveau : créez-en dans « Établissements »') }]} /></Field>
          <div className="flex items-end"><label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 ${!niveauId || busy ? 'pointer-events-none opacity-50' : ''}`}><Plus className="h-4 w-4" />{plan ? t('Remplacer le plan') : t('Importer le plan (image)')}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) void upload(x); }} /></label></div>
        </div>
      </Card>
      {!plan ? <Card><EmptyState icon={FileText} title={t('Aucun plan pour ce niveau')} description={t('Importez une image (PNG, JPEG ou WebP) du plan de ce niveau.')} /></Card> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card padded={false}>
            {!img.data ? <Loading error={img.error} reload={img.reload} /> : (
              <div className="relative cursor-crosshair overflow-hidden rounded-xl" onClick={onPlan} dir="ltr">
                <img src={`data:${img.data.mime};base64,${img.data.base64}`} alt={plan.nom} className="block w-full select-none" draggable={false} />
                {equipements.filter((e) => placed.has(e.id)).map((e) => { const p = placed.get(e.id)!; return (
                  <button key={e.id} type="button" title={`${e.libelle} — ${e.emplacement}`} onClick={(ev) => { ev.stopPropagation(); setSel(e.id); }}
                    className={`absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full shadow ring-2 ${DOT[e.etat]} ${sel === e.id ? 'ring-sky-500 scale-125' : 'ring-white'}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} />); })}
              </div>)}
          </Card>
          <Card className="space-y-3">
            <Field label={t('Équipement à positionner')}><Select value={sel} onChange={setSel} options={[{ value: '', label: t('— Choisir —') }, ...equipements.map((e) => ({ value: e.id, label: `${e.libelle}${placed.has(e.id) ? ' ✓' : ''}` }))]} /></Field>
            {current ? <p className="text-sm text-slate-600">{placed.has(current.id) ? t('Touchez le plan pour déplacer l’équipement.') : t('Touchez le plan pour placer l’équipement.')}</p> : <p className="text-sm text-slate-500">{t('Choisissez un équipement, puis touchez son emplacement sur le plan.')}</p>}
            {current && placed.has(current.id) ? <Button icon={X} onClick={() => void place(current.id, null, null)}>{t('Retirer du plan')}</Button> : null}
            <div className="space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
              {([['ok', 'À jour'], ['a_venir', 'À venir'], ['en_retard', 'En retard'], ['hors_service', 'Hors service']] as [Etat, string][]).map(([k, l]) => <p key={k} className="flex items-center gap-2"><span className={`inline-block h-3 w-3 rounded-full ${DOT[k]}`} />{t(l)}</p>)}
              <p>{plan.positions.length} / {equipements.length} {t('équipement(s) placé(s)')}</p>
            </div>
          </Card>
        </div>)}
    </div>
  );
}

// ───────────────────────── Règles de périodicité ─────────────────────────
function ReglesPage({ api }: Props) {
  const types = useAsync(() => get<TypeEq[]>(api, '/types'), [api]);
  const [f, setF] = useState({ typeEquipementId: '', categorie: '', periodiciteMois: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { const r = await post<{ recalculated: number }>(api, '/regle/save', { ...f, categorie: f.categorie || null }); toast.success(`Règle enregistrée — ${r.recalculated} échéance(s) recalculée(s)`); setF({ ...f, periodiciteMois: '' }); await types.reload(); } catch (e) { fail(e); } finally { setBusy(false); } };
  const [nt, setNt] = useState({ libelle: '', periodiciteDefautMois: '' });
  const addType = async () => {
    const code = nt.libelle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
    try { await post(api, '/type/save', { code, libelle: nt.libelle, periodiciteDefautMois: nt.periodiciteDefautMois }); toast.success(t('Type ajouté')); setNt({ libelle: '', periodiciteDefautMois: '' }); await types.reload(); } catch (e) { fail(e); }
  };
  const cats = ['1', '2', '3', '4', '5'];
  const first = useMemo(() => types.data?.[0]?.id ?? '', [types.data]);
  return (
    <div className="space-y-4">
      <PageHeader title={t('Règles de périodicité')} description={t('Périodicité par type d’équipement, éventuellement spécifique à une catégorie d’établissement. Les échéances sont recalculées automatiquement.')} />
      <Card className="border-amber-200 bg-amber-50"><p className="text-sm text-amber-900">{t('Les périodicités sont des paramètres, pas des valeurs réglementaires : à faire valider avec la réglementation applicable à votre établissement.')}</p></Card>
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={t('Type d’équipement')}><Select value={f.typeEquipementId || first} onChange={(v) => setF({ ...f, typeEquipementId: v })} options={(types.data ?? []).map((t) => ({ value: t.id, label: t.libelle }))} /></Field>
          <Field label={t('Catégorie')}><Select value={f.categorie} onChange={(v) => setF({ ...f, categorie: v })} options={[{ value: '', label: t('Toutes les catégories') }, ...cats.map((c) => ({ value: c, label: `${t('Catégorie')} ${c}` }))]} /></Field>
          <Field label={t('Périodicité (mois)')}><Input inputMode="numeric" value={f.periodiciteMois} onChange={(e) => setF({ ...f, periodiciteMois: e.target.value })} /></Field>
          <div className="flex items-end"><Button loading={busy} disabled={!f.periodiciteMois} onClick={() => void save()} className="w-full">{t('Enregistrer la règle')}</Button></div>
        </div>
      </Card>
      <Card className="space-y-3">
        <h3 className="font-semibold text-slate-900">{t('Nouveau type d’équipement')}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1"><Input value={nt.libelle} onChange={(e) => setNt({ ...nt, libelle: e.target.value })} placeholder={t('Ex. : Colonne sèche')} /></div>
          <Input inputMode="numeric" value={nt.periodiciteDefautMois} onChange={(e) => setNt({ ...nt, periodiciteDefautMois: e.target.value })} placeholder={t('Périodicité par défaut (mois)')} />
          <Button disabled={!nt.libelle.trim() || !nt.periodiciteDefautMois} onClick={() => void addType()}>{t('Ajouter le type')}</Button>
        </div>
      </Card>
      <Card padded={false}>
        {!types.data ? <Loading error={types.error} reload={types.reload} /> : (
          <div className="overflow-x-auto"><Table>
            <thead><tr><Th>{t('Type')}</Th><Th>{t('Par défaut')}</Th>{cats.map((c) => <Th key={c}>Cat. {c}</Th>)}</tr></thead>
            <tbody>{types.data.map((t) => {
              const general = t.regles.find((r) => r.categorie === null)?.periodiciteMois ?? t.periodiciteDefautMois;
              return <tr key={t.id}><Td className="font-medium text-slate-900">{t.libelle}</Td><Td>{general} mois</Td>{cats.map((c) => { const r = t.regles.find((x) => x.categorie === c); return <Td key={c}>{r ? <Pill tone="amber">{r.periodiciteMois} mois</Pill> : <span className="text-slate-400">{general}</span>}</Td>; })}</tr>;
            })}</tbody>
          </Table></div>)}
      </Card>
    </div>
  );
}

/** Enveloppe commune : bascule français / arabe (arabe = lecture de droite à gauche). */
function withShell(Page: (p: Props) => ReactNode) {
  return function Shell(props: Props) {
    const [lang, setL] = useState(getLang());
    const switchTo = (l: 'fr' | 'ar') => { setLang(l); setL(l); };
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} className="space-y-3">
        <div className="flex justify-end gap-1 text-xs" dir="ltr">
          {(['fr', 'ar'] as const).map((l) => <button key={l} type="button" onClick={() => switchTo(l)} aria-pressed={lang === l} className={`rounded-md px-2 py-1 font-medium ring-1 ring-inset ${lang === l ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200'}`}>{l === 'fr' ? 'Français' : 'العربية'}</button>)}
        </div>
        <Page {...props} />
      </div>
    );
  };
}

export default defineAdminModule<Record<string, never>>({
  pages: Object.fromEntries(Object.entries({ dashboard: DashboardPage, etablissements: EtablissementsPage, controles: ControlesPage, 'non-conformites': NcPage, registre: RegistrePage, exercices: ExercicesPage, visites: VisitesPage, plans: PlansPage, regles: ReglesPage }).map(([k, P]) => [k, withShell(P)])),
});
