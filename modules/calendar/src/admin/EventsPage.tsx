/**
 * Snapify — module Calendrier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { useState } from 'react';
import { Calendar, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Switch,
  Table,
  Td,
  Textarea,
  Th,
  errorMessage,
  slugify,
  toast,
  useAsync,
  useConfirm,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import type { CalEvent, Settings } from '../types';

type Row = CalEvent & { id: string };
type Draft = Partial<CalEvent> & { id?: string };

const empty = (): Draft => ({
  title: '',
  slug: '',
  description: '',
  location: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '10:00',
  allDay: false,
  color: '#00C6BA',
  status: 'published',
});

export function EventsPage({ api }: AdminPageProps<Settings>) {
  const confirm = useConfirm();
  const list = useAsync(() => api.get<{ events: Row[] }>('/events'), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const rows = list.data?.events ?? [];

  const open = (e?: Row) => {
    setSlugTouched(!!e);
    setDraft(e ? { ...e } : empty());
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.id) await api.put(`/events/${draft.id}`, draft);
      else await api.post('/events', draft);
      toast.success(draft.id ? 'Événement enregistré' : 'Événement créé');
      setDraft(null);
      void list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: Row) => {
    if (!(await confirm({ title: `Supprimer « ${e.title} » ?`, message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/events/${e.id}`);
      toast.success('Événement supprimé');
      void list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Événements"
        description="Gérez l’agenda affiché sur le site (/agenda/)."
        actions={
          <Button icon={Plus} onClick={() => open()}>
            Nouvel événement
          </Button>
        }
      />

      {list.error ? <ErrorState message={errorMessage(list.error)} onRetry={() => void list.reload()} /> : null}
      {!list.error && !list.loading && rows.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Aucun événement"
          description="Ajoutez votre premier rendez-vous, atelier ou date importante."
          action={
            <Button icon={Plus} onClick={() => open()}>
              Nouvel événement
            </Button>
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Titre</Th>
              <Th>Lieu</Th>
              <Th>Statut</Th>
              <Th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <Td>
                  <div className="font-medium">{e.date}</div>
                  <div className="text-xs text-slate-500">{e.allDay ? 'Journée entière' : `${e.startTime || '—'} – ${e.endTime || '—'}`}</div>
                </Td>
                <Td>
                  <span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ background: e.color }} />
                  {e.title}
                </Td>
                <Td>{e.location || '—'}</Td>
                <Td>{e.status === 'published' ? 'Publié' : 'Brouillon'}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => open(e)} />
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void remove(e)} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}

      {draft ? (
        <Modal title={draft.id ? 'Modifier l’événement' : 'Nouvel événement'} open onClose={() => setDraft(null)} size="lg">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titre">
              <Input
                value={draft.title || ''}
                onChange={({ target: { value: v } }) =>
                  setDraft((d) => ({
                    ...d!,
                    title: v,
                    slug: slugTouched ? d!.slug : slugify(`${v}-${d!.date || ''}`),
                  }))
                }
              />
            </Field>
            <Field label="Adresse (slug)">
              <Input
                value={draft.slug || ''}
                onChange={({ target: { value: v } }) => {
                  setSlugTouched(true);
                  setDraft((d) => ({ ...d!, slug: v }));
                }}
              />
            </Field>
            <Field label="Date (AAAA-MM-JJ)">
              <Input value={draft.date || ''} placeholder="2026-10-20" onChange={({ target: { value: v } }) => setDraft((d) => ({ ...d!, date: v }))} />
            </Field>
            <Field label="Début (HH:mm)">
              <Input value={draft.startTime || ''} placeholder="09:00" onChange={({ target: { value: v } }) => setDraft((d) => ({ ...d!, startTime: v }))} />
            </Field>
            <Field label="Fin (HH:mm)">
              <Input value={draft.endTime || ''} placeholder="10:00" onChange={({ target: { value: v } }) => setDraft((d) => ({ ...d!, endTime: v }))} />
            </Field>
            <Field label="Lieu">
              <Input value={draft.location || ''} onChange={({ target: { value: v } }) => setDraft((d) => ({ ...d!, location: v }))} />
            </Field>
            <Field label="Description">
              <Textarea value={draft.description || ''} rows={4} onChange={({ target: { value: v } }) => setDraft((d) => ({ ...d!, description: v }))} />
            </Field>
            <Field label="Couleur (#hex)">
              <Input value={draft.color || '#00C6BA'} placeholder="#00C6BA" onChange={({ target: { value: v } }) => setDraft((d) => ({ ...d!, color: v }))} />
            </Field>
            <Field label="Statut">
              <Select
                value={draft.status || 'published'}
                onChange={(v) => setDraft((d) => ({ ...d!, status: v as 'published' | 'draft' }))}
                options={[
                  { value: 'published', label: 'Publié' },
                  { value: 'draft', label: 'Brouillon' },
                ]}
              />
            </Field>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Switch checked={!!draft.allDay} onChange={(v) => setDraft((d) => ({ ...d!, allDay: v }))} />
              <span className="text-sm text-slate-700">Journée entière</span>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              Enregistrer
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
