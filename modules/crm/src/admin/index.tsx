/**
 * Interface d'administration du module CRM (français, responsive).
 * Composants : SDK Snapify (@snapify/sdk/admin) ; glisser-déposer : @dnd-kit (déjà dans le projet).
 * Les routes serveur renvoient { ok, data | error } : `call()` déballe et lève une Error lisible.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { ArrowLeft, Download, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import {
  Badge, Button, Card, defineAdminModule, EmptyState, ErrorState, errorMessage, fmtDate, fmtDateTime, Input, PageHeader, PageSkeleton,
  Pagination, Select, StatCard, Table, Td, Th, toast, useAsync, useConfirm, useDebounced, usePaging, type AdminPageProps,
} from '@snapify/sdk/admin';

type Env<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
type Api = AdminPageProps<Record<string, never>>['api'];
const call = async <T,>(p: Promise<Env<T>>): Promise<T> => { const r = await p; if (!r.ok) throw new Error(r.error.message); return r.data; };
const get = <T,>(api: Api, path: string, params: Record<string, string | number | undefined> = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  return call<T>(api.get<Env<T>>(`${path}${qs.toString() ? `?${qs}` : ''}`));
};
const post = <T,>(api: Api, path: string, body: unknown) => call<T>(api.post<Env<T>>(path, body));
const money = (n: number) => new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(n);
const fail = (e: unknown) => toast.error(errorMessage(e));

interface Contact { id: string; firstName: string; lastName: string; email: string | null; phone: string; companyId: string | null; source: string; tags: string[]; createdAt: string }
interface Company { id: string; name: string; website: string; phone: string; address: string }
interface Deal { id: string; contactId: string; title: string; stage: string; amount: number; expectedClose: string | null; contactName?: string }
interface Activity { id: string; type: 'note' | 'call' | 'email'; note: string; occurredAt: string }
const TYPE_LABEL = { note: 'Note', call: 'Appel', email: 'E-mail' } as const;
const STAGE_OPTIONS = [['nouveau', 'Nouveau'], ['qualifie', 'Qualifié'], ['proposition', 'Proposition'], ['gagne', 'Gagné'], ['perdu', 'Perdu']].map(([value, label]) => ({ value, label }));

const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400';
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}</label>
);
const fullName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.trim();

function saveText(name: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

/** Lit un fichier .csv ou .xlsx et renvoie son contenu au format CSV (1re feuille pour Excel). */
async function fileToCsv(file: File): Promise<string> {
  if (!/\.xlsx$/i.test(file.name)) {
    if (/\.xls$/i.test(file.name)) throw new Error('Format .xls non pris en charge : enregistrez le fichier en .xlsx ou .csv');
    return file.text();
  }
  const { default: readXlsxFile } = await import('read-excel-file');
  const rows = await readXlsxFile(file);
  const cell = (v: unknown) => {
    const t = v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return /[\",;\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

// ───────────────────────── Contacts ─────────────────────────
function ContactForm({ api, initial, onSaved, onCancel }: { api: Api; initial?: Contact; onSaved: () => void; onCancel: () => void }) {
  const companies = useAsync(() => get<{ items: Company[] }>(api, '/companies', { size: 100 }), [api]);
  const [f, setF] = useState({ firstName: initial?.firstName ?? '', lastName: initial?.lastName ?? '', email: initial?.email ?? '', phone: initial?.phone ?? '', companyId: initial?.companyId ?? '', source: initial?.source ?? 'manuel', tags: (initial?.tags ?? []).join(', ') });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true);
    try {
      await post(api, '/contact/save', { ...f, id: initial?.id, companyId: f.companyId || null, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) });
      toast.success(initial ? 'Contact modifié' : 'Contact créé');
      onSaved();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <Card className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom"><Input value={f.firstName} onChange={set('firstName')} /></Field>
        <Field label="Nom *"><Input value={f.lastName} onChange={set('lastName')} /></Field>
        <Field label="E-mail"><Input value={f.email} onChange={set('email')} placeholder="nom@exemple.tn" /></Field>
        <Field label="Téléphone"><Input value={f.phone} onChange={set('phone')} placeholder="+216 …" /></Field>
        <Field label="Entreprise">
          <Select value={f.companyId} onChange={(v) => setF({ ...f, companyId: v })} options={[{ value: '', label: '— Aucune —' }, ...(companies.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        </Field>
        <Field label="Source"><Input value={f.source} onChange={set('source')} /></Field>
        <div className="sm:col-span-2"><Field label="Tags (séparés par des virgules)"><Input value={f.tags} onChange={set('tags')} placeholder="vip, prospect" /></Field></div>
      </div>
      <div className="flex justify-end gap-2"><Button onClick={onCancel}>Annuler</Button><Button loading={busy} onClick={() => void submit()}>Enregistrer</Button></div>
    </Card>
  );
}

function ContactsList({ api, navigate }: AdminPageProps<Record<string, never>>) {
  const [q, setQ] = useState(''); const [source, setSource] = useState(''); const [tag, setTag] = useState('');
  const [adding, setAdding] = useState(false); const [importing, setImporting] = useState(false);
  const search = useDebounced(q, 300);
  const { page, setPage, pageSize, setPageSize } = usePaging('crm-contacts', { resetKey: { search, source, tag } });
  const list = useAsync(() => get<{ items: Contact[]; total: number }>(api, '/contacts', { q: search, source, tag, page, size: pageSize }), [search, source, tag, page, pageSize]);
  const dash = useAsync(() => get<{ leadsBySource: { source: string }[]; tags: string[] }>(api, '/dashboard'), [api]);

  const exportCsv = async () => { try { saveText(`contacts-${new Date().toISOString().slice(0, 10)}.csv`, (await get<{ csv: string }>(api, '/export')).csv); } catch (e) { fail(e); } };
  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const r = await post<{ created: number; duplicates: unknown[]; errors: { line: number; message: string }[] }>(api, '/import', { csv: await fileToCsv(file), onDuplicate: 'skip' });
      toast.success(`${r.created} créé(s), ${r.duplicates.length} doublon(s) ignoré(s), ${r.errors.length} erreur(s)`);
      if (r.errors.length) toast.error(`Ligne ${r.errors[0].line} : ${r.errors[0].message}`);
      void list.reload();
    } catch (e) { fail(e); } finally { setImporting(false); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Contacts" description="Prospects et clients : recherche, filtres, historique des échanges." actions={
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-black hover:bg-slate-50">
            <Upload className="h-4 w-4" />{importing ? 'Import…' : 'Importer CSV / Excel'}
            <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
          </label>
          <Button icon={Download} onClick={() => void exportCsv()}>Exporter</Button>
          <Button icon={Plus} onClick={() => setAdding(true)}>Nouveau contact</Button>
        </div>} />
      {adding ? <ContactForm api={api} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); void list.reload(); }} /> : null}
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail ou téléphone…" className="pl-9" />
          </div>
          <Select value={source} onChange={setSource} className="w-44" options={[{ value: '', label: 'Toutes les sources' }, ...(dash.data?.leadsBySource ?? []).map((s) => ({ value: s.source, label: s.source }))]} />
          <Select value={tag} onChange={setTag} className="w-40" options={[{ value: '', label: 'Tous les tags' }, ...(dash.data?.tags ?? []).map((t) => ({ value: t, label: t }))]} />
        </div>
        {list.error ? <div className="p-4"><ErrorState message={list.error} onRetry={list.reload} /></div>
          : !list.data ? <PageSkeleton />
          : !list.data.items.length ? <EmptyState icon={Users} title="Aucun contact" description="Ajoutez un contact ou collez le formulaire de capture sur une page du site." />
          : (<>
            <Table>
              <thead><tr><Th>Contact</Th><Th>Téléphone</Th><Th>Source</Th><Th>Tags</Th><Th>Créé le</Th></tr></thead>
              <tbody>
                {list.data.items.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => navigate(`/${c.id}`)}>
                    <Td><p className="font-medium text-slate-900">{fullName(c)}</p><p className="truncate text-xs text-slate-500">{c.email ?? '—'}</p></Td>
                    <Td>{c.phone || '—'}</Td>
                    <Td><Badge>{c.source}</Badge></Td>
                    <Td><div className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div></Td>
                    <Td>{fmtDate(c.createdAt)}</Td>
                  </tr>))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={list.data.total} onPage={setPage} onPageSize={setPageSize} noun="contacts" />
          </>)}
      </Card>
    </div>
  );
}

function ContactDetail({ api, navigate, id }: AdminPageProps<Record<string, never>> & { id: string }) {
  const d = useAsync(() => get<{ contact: Contact; company: Company | null; deals: Deal[]; timeline: Activity[] }>(api, '/contact', { id }), [id]);
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState({ type: 'note', note: '' });
  const [deal, setDeal] = useState({ title: '', amount: '', stage: 'nouveau' });

  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />;
  if (!d.data) return <PageSkeleton />;
  const { contact, company, deals, timeline } = d.data;

  const addNote = async () => { try { await post(api, '/activity/add', { contactId: id, ...note }); setNote({ ...note, note: '' }); await d.reload(); } catch (e) { fail(e); } };
  const addDeal = async () => { try { await post(api, '/deal/save', { contactId: id, ...deal, amount: Number(deal.amount) || 0 }); setDeal({ title: '', amount: '', stage: 'nouveau' }); await d.reload(); } catch (e) { fail(e); } };
  const remove = async () => {
    if (!(await confirm({ title: 'Supprimer ce contact ?', message: 'Ses affaires et son historique seront supprimés.', confirmLabel: 'Supprimer', danger: true }))) return;
    try { await post(api, '/contact/delete', { id }); toast.success('Contact supprimé'); navigate('/'); } catch (e) { fail(e); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={fullName(contact)} description={[contact.email, contact.phone, company?.name].filter(Boolean).join(' · ') || 'Aucune coordonnée'} actions={
        <div className="flex gap-2"><Button icon={ArrowLeft} onClick={() => navigate('/')}>Retour</Button><Button onClick={() => setEditing(!editing)}>Modifier</Button><Button icon={Trash2} onClick={() => void remove()}>Supprimer</Button></div>} />
      {editing ? <ContactForm api={api} initial={contact} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); void d.reload(); }} /> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-3">
            <h3 className="font-semibold text-slate-900">Ajouter à l’historique</h3>
            <div className="flex flex-wrap gap-2">
              <Select value={note.type} onChange={(v) => setNote({ ...note, type: v })} className="w-36" options={[{ value: 'note', label: 'Note' }, { value: 'call', label: 'Appel' }, { value: 'email', label: 'E-mail' }]} />
            </div>
            <textarea className={field} rows={3} value={note.note} onChange={(e) => setNote({ ...note, note: e.target.value })} placeholder="Compte rendu, résumé de l’appel, e-mail envoyé…" />
            <div className="flex justify-end"><Button onClick={() => void addNote()}>Ajouter</Button></div>
          </Card>
          <Card className="space-y-4">
            <h3 className="font-semibold text-slate-900">Historique</h3>
            {!timeline.length ? <p className="text-sm text-slate-500">Aucun échange enregistré.</p> : (
              <ol className="space-y-4 border-l border-slate-200 pl-4">
                {timeline.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400" />
                    <p className="text-xs text-slate-500"><Badge>{TYPE_LABEL[a.type]}</Badge> <span className="ml-1">{fmtDateTime(a.occurredAt)}</span></p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{a.note}</p>
                  </li>))}
              </ol>)}
          </Card>
        </div>
        <Card className="space-y-3 self-start">
          <h3 className="font-semibold text-slate-900">Affaires</h3>
          {deals.map((x) => <div key={x.id} className="rounded-lg border border-slate-100 p-3 text-sm"><p className="font-medium">{x.title}</p><p className="text-slate-500">{STAGE_OPTIONS.find((s) => s.value === x.stage)?.label} · {money(x.amount)}</p></div>)}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <Input value={deal.title} onChange={(e) => setDeal({ ...deal, title: e.target.value })} placeholder="Titre de l’affaire" />
            <Input value={deal.amount} onChange={(e) => setDeal({ ...deal, amount: e.target.value })} placeholder="Montant (TND)" />
            <Select value={deal.stage} onChange={(v) => setDeal({ ...deal, stage: v })} options={STAGE_OPTIONS} />
            <Button icon={Plus} onClick={() => void addDeal()}>Créer l’affaire</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ContactsPage(props: AdminPageProps<Record<string, never>>) {
  const id = props.subpath.split('/').filter(Boolean)[0];
  return id ? <ContactDetail key={id} id={id} {...props} /> : <ContactsList {...props} />;
}

// ───────────────────────── Entreprises ─────────────────────────
function CompaniesPage({ api, navigate, subpath }: AdminPageProps<Record<string, never>>) {
  const id = subpath.split('/').filter(Boolean)[0];
  const confirm = useConfirm();
  const [f, setF] = useState({ name: '', website: '', phone: '', address: '' });
  const [adding, setAdding] = useState(false);
  const list = useAsync(() => get<{ items: Company[]; total: number }>(api, '/companies', { size: 100 }), [api]);
  const detail = useAsync(() => (id ? get<{ company: Company; contacts: Contact[] }>(api, '/company', { id }) : Promise.resolve(null)), [id]);

  const save = async () => { try { await post(api, '/company/save', f); setAdding(false); setF({ name: '', website: '', phone: '', address: '' }); await list.reload(); } catch (e) { fail(e); } };
  const remove = async () => {
    if (!(await confirm({ title: 'Supprimer l’entreprise ?', message: 'Les contacts sont conservés, simplement détachés.', confirmLabel: 'Supprimer', danger: true }))) return;
    try { await post(api, '/company/delete', { id }); navigate('/'); } catch (e) { fail(e); }
  };

  if (id) {
    if (detail.error) return <ErrorState message={detail.error} onRetry={detail.reload} />;
    if (!detail.data) return <PageSkeleton />;
    const { company, contacts } = detail.data;
    return (
      <div className="space-y-4">
        <PageHeader title={company.name} description={[company.website, company.phone, company.address].filter(Boolean).join(' · ') || 'Aucune coordonnée'} actions={<div className="flex gap-2"><Button icon={ArrowLeft} onClick={() => navigate('/')}>Retour</Button><Button icon={Trash2} onClick={() => void remove()}>Supprimer</Button></div>} />
        <Card padded={false}>
          {!contacts.length ? <EmptyState icon={Users} title="Aucun contact rattaché" description="Rattachez un contact depuis sa fiche." /> : (
            <Table><thead><tr><Th>Contact</Th><Th>E-mail</Th><Th>Téléphone</Th></tr></thead><tbody>
              {contacts.map((c) => <tr key={c.id}><Td className="font-medium text-slate-900">{fullName(c)}</Td><Td>{c.email ?? '—'}</Td><Td>{c.phone || '—'}</Td></tr>)}
            </tbody></Table>)}
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Entreprises" description="Regroupez plusieurs contacts par société." actions={<Button icon={Plus} onClick={() => setAdding(true)}>Nouvelle entreprise</Button>} />
      {adding ? (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom *"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Site web"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Téléphone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Adresse"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2"><Button onClick={() => setAdding(false)}>Annuler</Button><Button onClick={() => void save()}>Enregistrer</Button></div>
        </Card>) : null}
      <Card padded={false}>
        {list.error ? <div className="p-4"><ErrorState message={list.error} onRetry={list.reload} /></div> : !list.data ? <PageSkeleton /> : !list.data.items.length ? <EmptyState icon={Users} title="Aucune entreprise" description="Créez votre première entreprise." /> : (
          <Table><thead><tr><Th>Entreprise</Th><Th>Site</Th><Th>Téléphone</Th></tr></thead><tbody>
            {list.data.items.map((c) => <tr key={c.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => navigate(`/${c.id}`)}><Td className="font-medium text-slate-900">{c.name}</Td><Td>{c.website || '—'}</Td><Td>{c.phone || '—'}</Td></tr>)}
          </tbody></Table>)}
      </Card>
    </div>
  );
}

// ───────────────────────── Pipeline (kanban) ─────────────────────────
interface Column { stage: string; label: string; total: number; deals: Deal[] }

function DealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.6 : 1, touchAction: 'none' }}
      className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm active:cursor-grabbing">
      <p className="font-medium text-slate-900">{deal.title}</p>
      <p className="text-xs text-slate-500">{deal.contactName}</p>
      <p className="mt-1 font-semibold tabular-nums">{money(deal.amount)}</p>
      {deal.expectedClose ? <p className="text-xs text-slate-500">Clôture prévue : {fmtDate(deal.expectedClose)}</p> : null}
    </div>
  );
}

function StageColumn({ col }: { col: Column }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.stage });
  return (
    <div ref={setNodeRef} className={`flex min-h-[220px] w-72 shrink-0 flex-col gap-2 rounded-xl border p-3 ${isOver ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-baseline justify-between"><h3 className="font-semibold text-slate-800">{col.label} <span className="text-xs font-normal text-slate-500">({col.deals.length})</span></h3><span className="text-xs font-medium tabular-nums text-slate-600">{money(col.total)}</span></div>
      {col.deals.map((d) => <DealCard key={d.id} deal={d} />)}
    </div>
  );
}

function PipelinePage({ api }: AdminPageProps<Record<string, never>>) {
  const data = useAsync(() => get<Column[]>(api, '/pipeline'), [api]);
  const [board, setBoard] = useState<Column[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  useEffect(() => { if (data.data) setBoard(data.data); }, [data.data]);

  const onDragEnd = async (e: DragEndEvent) => {
    if (!board || !e.over) return;
    const dealId = String(e.active.id), stage = String(e.over.id);
    const from = board.find((c) => c.deals.some((d) => d.id === dealId));
    const deal = from?.deals.find((d) => d.id === dealId);
    if (!from || !deal || from.stage === stage) return;
    const next = board.map((c) => {
      const deals = c.stage === from.stage ? c.deals.filter((d) => d.id !== dealId) : c.stage === stage ? [...c.deals, { ...deal, stage }] : c.deals;
      return { ...c, deals, total: deals.reduce((s, d) => s + d.amount, 0) };
    });
    setBoard(next); // affichage immédiat, puis confirmation serveur
    try { await post(api, '/deal/move', { id: dealId, stage }); } catch (err) { fail(err); await data.reload(); }
  };

  if (data.error) return <ErrorState message={data.error} onRetry={data.reload} />;
  if (!board) return <PageSkeleton />;
  return (
    <div className="space-y-4">
      <PageHeader title="Pipeline" description="Glissez les affaires d’une colonne à l’autre pour changer leur étape." />
      <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
        <div className="flex gap-3 overflow-x-auto pb-3">{board.map((c) => <StageColumn key={c.stage} col={c} />)}</div>
      </DndContext>
    </div>
  );
}

// ───────────────────────── Tableau de bord ─────────────────────────
function DashboardPage({ api }: AdminPageProps<Record<string, never>>) {
  const d = useAsync(() => get<{ leadsBySource: { source: string; count: number }[]; totalContacts: number; deals: { open: number; won: number; lost: number }; conversionRate: number; wonRevenue: number; openPipeline: number; forecastRevenue: number }>(api, '/dashboard'), [api]);
  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />;
  if (!d.data) return <PageSkeleton />;
  const x = d.data, max = Math.max(1, ...x.leadsBySource.map((s) => s.count));
  return (
    <div className="space-y-6">
      <PageHeader title="CRM — Tableau de bord" description="Vue d’ensemble des leads et des ventes." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contacts" value={x.totalContacts} icon={Users} />
        <StatCard label="Taux de conversion" value={`${x.conversionRate} %`} icon={Users} tone="sky" />
        <StatCard label="CA gagné" value={money(x.wonRevenue)} icon={Users} />
        <StatCard label="CA prévu (pondéré)" value={money(x.forecastRevenue)} icon={Users} tone="sky" />
      </div>
      <Card className="space-y-3">
        <h3 className="font-semibold text-slate-900">Leads par source</h3>
        {x.leadsBySource.map((s) => (
          <div key={s.source} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 truncate text-slate-700">{s.source}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-700" style={{ width: `${(s.count / max) * 100}%` }} /></div>
            <span className="w-8 text-right tabular-nums text-slate-600">{s.count}</span>
          </div>))}
        <p className="text-xs text-slate-500">Conversion = affaires gagnées / affaires clôturées ({x.deals.won} gagnées, {x.deals.lost} perdues). CA prévu = montants des affaires ouvertes pondérés par étape (10 % · 30 % · 60 %).</p>
      </Card>
    </div>
  );
}

export default defineAdminModule<Record<string, never>>({ pages: { dashboard: DashboardPage, contacts: ContactsPage, companies: CompaniesPage, pipeline: PipelinePage } });
