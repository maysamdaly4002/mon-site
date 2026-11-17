/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Folder, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  ImageField,
  Input,
  Modal,
  PageHeader,
  Skeleton,
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
import { COMMERCE_PATHS } from '@snapify/sdk/commerce';
import type { Settings } from '../types';
import type { AdminCategory } from './ProductsPage';

type Draft = { id?: string; name: string; slug: string; description: string; image: string };

export function CategoriesPage({ api }: AdminPageProps<Settings>) {
  const confirm = useConfirm();
  const list = useAsync(() => api.get<{ categories: AdminCategory[] }>('/categories'), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const cats = list.data?.categories ?? [];

  const open = (c?: AdminCategory) => {
    setSlugTouched(!!c);
    setDraft(c ? { id: c.id, name: c.name, slug: c.slug, description: c.description, image: c.image } : { name: '', slug: '', description: '', image: '' });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.id) await api.put(`/categories/${draft.id}`, draft);
      else await api.post('/categories', draft);
      toast.success(draft.id ? 'Catégorie enregistrée' : 'Catégorie créée');
      setDraft(null);
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: AdminCategory) => {
    const ok = await confirm({
      title: `Supprimer « ${c.name} » ?`,
      message: c.count ? `Les ${c.count} produit${c.count > 1 ? 's' : ''} de cette catégorie restent en ligne, sans cette catégorie.` : 'Cette catégorie ne contient aucun produit.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success('Catégorie supprimée');
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const ids = cats.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    list.setData({ categories: ids.map((id) => cats.find((c) => c.id === id)!) });
    try {
      await api.post('/categories/reorder', { ids });
    } catch (e) {
      toast.error(errorMessage(e));
      void list.reload();
    }
  };

  return (
    <div>
      <PageHeader
        title="Catégories"
        description="Organisez le catalogue ; l’ordre choisi ici est celui de la boutique."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => open()}>
            Nouvelle catégorie
          </Button>
        }
      />
      <Card padded={false}>
        {list.error ? (
          <div className="p-4">
            <ErrorState message={list.error} onRetry={list.reload} />
          </div>
        ) : !list.data ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !cats.length ? (
          <EmptyState
            icon={Folder}
            title="Aucune catégorie"
            description="Les catégories regroupent vos produits : Céramique, Textile, Décoration…"
            action={
              <Button variant="primary" icon={Plus} onClick={() => open()}>
                Nouvelle catégorie
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-20">Ordre</Th>
                <Th>Catégorie</Th>
                <Th>Adresse</Th>
                <Th className="text-right">Produits</Th>
                <Th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {cats.map((c, i) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <Td>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" aria-label="Monter" disabled={i === 0} onClick={() => void move(i, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Descendre" disabled={i === cats.length - 1} onClick={() => void move(i, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Td>
                  <Td>
                    <button type="button" className="flex items-center gap-3 text-left" onClick={() => open(c)}>
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">{c.image ? <img src={c.image} alt="" className="h-full w-full object-cover" /> : null}</span>
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{c.name}</span>
                        {c.description ? <span className="block max-w-md truncate text-xs text-slate-500">{c.description}</span> : null}
                      </span>
                    </button>
                  </Td>
                  <Td className="font-mono text-xs text-slate-500">{COMMERCE_PATHS.category(c.slug)}</Td>
                  <Td className="text-right tabular-nums">{c.count}</Td>
                  <Td>
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" aria-label="Voir sur le site" onClick={() => window.open(COMMERCE_PATHS.category(c.slug), '_blank', 'noopener')}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => open(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => void remove(c)}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Annuler</Button>
            <Button variant="primary" loading={saving} disabled={!draft?.name.trim()} onClick={() => void save()}>
              Enregistrer
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <Field label="Nom">
              <Input autoFocus value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: slugTouched ? draft.slug : slugify(e.target.value) })} />
            </Field>
            <Field label="Adresse">
              <Input
                prefix="/boutique/"
                value={draft.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setDraft({ ...draft, slug: slugify(e.target.value) });
                }}
              />
            </Field>
            <Field label="Description" hint="Affichée en haut de la page de la catégorie.">
              <Textarea value={draft.description} maxLength={1000} rows={3} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="Image">
              <ImageField value={draft.image} onChange={(url) => setDraft({ ...draft, image: url })} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
