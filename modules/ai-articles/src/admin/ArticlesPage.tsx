/**
 * Snapify — module Articles IA
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Pencil, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  errorMessage,
  toast,
  useAsync,
  useConfirm,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import type { AiArticle, Settings } from '../types';

type Row = AiArticle & { id: string; createdAt: string };

export function ArticlesPage({ api, subpath, navigate }: AdminPageProps<Settings>) {
  const confirm = useConfirm();
  const list = useAsync(() => api.get<{ articles: Row[] }>('/articles'), []);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const rows = list.data?.articles ?? [];
  const focusId = subpath.replace(/^\//, '');

  useEffect(() => {
    if (!focusId || !rows.length) return;
    const found = rows.find((r) => r.id === focusId);
    if (found) setEdit(found);
  }, [focusId, rows]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await api.put(`/articles/${edit.id}`, edit);
      toast.success('Article enregistré');
      setEdit(null);
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!(await confirm({ title: `Supprimer « ${row.title} » ?`, message: 'Définitif.', confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/articles/${row.id}`);
      toast.success('Article supprimé');
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Articles IA"
        description="Brouillons et publications générés par l’IA."
        actions={
          <Button onClick={() => navigate('/m/novalabs.ai-articles/generate', { absolute: true })}>Générer</Button>
        }
      />

      {list.error ? <ErrorState message={errorMessage(list.error)} onRetry={() => void list.reload()} /> : null}
      {!list.error && !list.loading && rows.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun article" description="Générez votre premier article depuis l’onglet Générer." />
      ) : null}

      {rows.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Titre</Th>
              <Th>Fournisseur</Th>
              <Th>Statut</Th>
              <Th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-slate-500">/{r.slug}/</div>
                </Td>
                <Td className="text-sm capitalize">
                  {r.provider} · {r.model}
                </Td>
                <Td>
                  <Badge tone={r.status === 'published' ? 'success' : 'neutral'}>{r.status === 'published' ? 'Publié' : 'Brouillon'}</Badge>
                </Td>
                <Td>
                  <div className="flex gap-1">
                    {r.status === 'published' ? (
                      <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => window.open(`/articles-ia/${r.slug}/`, '_blank')} />
                    ) : null}
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(r)} />
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void remove(r)} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}

      {edit ? (
        <Modal title="Éditer l’article" open onClose={() => setEdit(null)} size="lg">
          <div className="grid gap-4">
            <Field label="Titre">
              <Input value={edit.title} onChange={({ target: { value: v } }) => setEdit({ ...edit, title: v })} />
            </Field>
            <Field label="Extrait">
              <Textarea value={edit.excerpt} rows={2} onChange={({ target: { value: v } }) => setEdit({ ...edit, excerpt: v })} />
            </Field>
            <Field label="Contenu HTML">
              <Textarea value={edit.html} rows={12} className="font-mono text-xs" onChange={({ target: { value: v } }) => setEdit({ ...edit, html: v })} />
            </Field>
            <Field label="Image de couverture (URL)">
              <Input value={edit.coverImage} onChange={({ target: { value: v } }) => setEdit({ ...edit, coverImage: v })} />
            </Field>
            <Field label="Statut">
              <Select
                value={edit.status}
                onChange={(v) => setEdit({ ...edit, status: v as 'draft' | 'published' })}
                options={[
                  { value: 'draft', label: 'Brouillon' },
                  { value: 'published', label: 'Publié' },
                ]}
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEdit(null)}>
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
