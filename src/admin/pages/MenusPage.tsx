/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, Copy, CornerDownRight, ExternalLink, GripVertical, Menu as MenuIcon, Monitor, Pencil, Plus, Smartphone, Star, Trash2 } from 'lucide-react';
import type { MenuConfig, MenuItem } from '../../../server/cms/types';
import { api } from '../lib/api';
import { useEditable } from '../lib/hooks';
import { useSiteData, useSite } from '../context/SiteContext';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Switch, Tabs } from '../ui/primitives';
import { Modal, useConfirm } from '../ui/overlays';
import { SaveBar } from '../ui/SaveBar';
import { LinkInput } from '../editor/fields';

const newId = () => `m-${crypto.randomUUID().slice(0, 8)}`;
const PROTECTED = new Set(['primary', 'mobile', 'footer']);
const slugifyMenu = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || `menu-${Date.now().toString(36)}`;

function ItemModal({ item, onClose, onSave }: { item: MenuItem | null; onClose: () => void; onSave: (i: MenuItem) => void }) {
  const site = useSiteData();
  const [draft, setDraft] = useState<MenuItem | null>(item);
  React.useEffect(() => setDraft(item), [item]);
  if (!draft) return null;
  const set = (p: Partial<MenuItem>) => setDraft({ ...draft, ...p });
  const pageOptions = [
    { value: '', label: 'Choisir une page du site…' },
    ...site.pages.map((p) => ({ value: p.path, label: `${p.title} — ${p.path}` })),
    ...site.posts.filter((p) => p.status === 'published').map((p) => ({ value: `/blog/${p.slug}/`, label: `Article : ${p.title}` })),
  ];
  const valid = draft.label.trim() && draft.path.trim();
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item?.label ? 'Modifier le lien' : 'Nouveau lien'}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              onSave({ ...draft, label: draft.label.trim(), path: draft.path.trim() });
              onClose();
            }}
          >
            Valider
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Libellé affiché">
          <Input autoFocus value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="Ex. : Nos expertises" />
        </Field>
        <Field label="Page de destination">
          <Select
            value={pageOptions.some((o) => o.value === draft.path) ? draft.path : ''}
            onChange={(v) => {
              if (!v) return;
              const page = site.pages.find((p) => p.path === v);
              set({ path: v, label: draft.label || page?.title || '' });
            }}
            options={pageOptions}
          />
        </Field>
        <Field label="Ou adresse personnalisée" hint="Chemin interne (/contact/), ancre (#offre) ou lien externe (https://…).">
          <LinkInput value={draft.path} onChange={(v) => set({ path: v })} />
        </Field>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
          <div className="py-3">
            <Switch checked={!!draft.openInNewTab} onChange={(v) => set({ openInNewTab: v })} label="Ouvrir dans un nouvel onglet" />
          </div>
          <div className="py-3">
            <Switch checked={!!draft.highlight} onChange={(v) => set({ highlight: v })} label="Mettre en avant (bouton)" description="Affiche ce lien sous forme de bouton coloré, idéal pour « Contact »." />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Row({
  item,
  depth,
  first,
  last,
  onEdit,
  onDelete,
  onMove,
  onAddChild,
  dragHandle,
}: {
  item: MenuItem;
  depth: 0 | 1;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (d: -1 | 1) => void;
  onAddChild?: () => void;
  dragHandle?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 ${depth ? 'ml-9' : ''}`}>
      {depth ? <CornerDownRight className="ml-1 h-4 w-4 text-slate-300" /> : dragHandle}
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="truncate text-sm font-medium text-slate-800">{item.label}</span>
        <span className="truncate text-xs text-slate-400">{item.path}</span>
        {item.highlight ? (
          <Badge tone="brand">
            <Star className="h-3 w-3" /> Bouton
          </Badge>
        ) : null}
        {item.openInNewTab ? (
          <Badge>
            <ExternalLink className="h-3 w-3" /> Nouvel onglet
          </Badge>
        ) : null}
      </button>
      <div className="flex shrink-0 items-center">
        {onAddChild ? (
          <Button size="sm" variant="ghost" icon={Plus} onClick={onAddChild} title="Ajouter un sous-lien">
            <span className="hidden md:inline">Sous-lien</span>
          </Button>
        ) : null}
        <Button size="icon" variant="ghost" disabled={first} onClick={() => onMove(-1)} title="Monter">
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" disabled={last} onClick={() => onMove(1)} title="Descendre">
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onEdit} title="Modifier">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={onDelete} title="Supprimer">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SortableTopItem(props: { item: MenuItem; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id });
  const handle = (
    <button type="button" className="cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing" {...attributes} {...listeners} title="Glisser pour réordonner">
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? 'relative z-10 opacity-90 shadow-lg' : ''}>
      {props.children(handle)}
    </div>
  );
}

function MenuPreview({ items, mode }: { items: MenuItem[]; mode: 'desktop' | 'mobile' }) {
  const site = useSiteData();
  if (mode === 'mobile') {
    return (
      <div className="mx-auto w-[260px] overflow-hidden rounded-[28px] border-[6px] border-slate-900 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-bold" style={{ color: site.branding.colors.navy }}>
            {site.branding.siteName}
          </span>
          <MenuIcon className="h-4 w-4 text-slate-500" />
        </div>
        <ul className="max-h-[380px] overflow-y-auto p-3">
          {items.map((i) => (
            <li key={i.id}>
              <span
                className="block rounded-lg px-3 py-2.5 text-sm font-medium"
                style={i.highlight ? { background: site.branding.colors.primary, color: '#fff', textAlign: 'center', marginTop: 8 } : { color: site.branding.colors.text }}
              >
                {i.label}
              </span>
              {i.children?.map((c) => (
                <span key={c.id} className="block px-6 py-1.5 text-[13px] text-slate-500">
                  {c.label}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-6 px-5 py-4">
        <span className="shrink-0 text-sm font-bold" style={{ color: site.branding.colors.navy }}>
          {site.branding.siteName}
        </span>
        <nav className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          {items.map((i) =>
            i.highlight ? (
              <span key={i.id} className="rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white" style={{ background: site.branding.colors.primary }}>
                {i.label}
              </span>
            ) : (
              <span key={i.id} className="flex items-center gap-1 text-[13px] font-medium" style={{ color: site.branding.colors.text }}>
                {i.label}
                {i.children?.length ? <ChevronDown className="h-3 w-3 opacity-60" /> : null}
              </span>
            )
          )}
        </nav>
      </div>
    </div>
  );
}

export default function MenusPage() {
  const site = useSiteData();
  const { patchSite, reload } = useSite();
  const confirm = useConfirm();
  const [tab, setTab] = useState('primary');
  const [editing, setEditing] = useState<{ item: MenuItem; parentId?: string; isNew: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIdVal, setNewIdVal] = useState('');

  const save = useCallback(
    async (menus: MenuConfig[]) => {
      const original = site.menus;
      for (const m of menus) {
        const before = original.find((o) => o.id === m.id);
        if (!before || JSON.stringify(before.items) !== JSON.stringify(m.items) || before.label !== m.label) {
          await api.saveMenu(m.id, m.items, m.label);
        }
      }
      patchSite('menus', menus);
    },
    [site.menus, patchSite]
  );
  const ed = useEditable<MenuConfig[]>(site.menus, save, { successMessage: 'Menus enregistrés' });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const menus = ed.value || [];
  const menu = menus.find((m) => m.id === tab) || menus[0];
  const activeTab = menu?.id || tab;
  const items = useMemo(() => menu?.items || [], [menu]);
  const setItems = (next: MenuItem[]) => ed.setValue(menus.map((m) => (m.id === activeTab ? { ...m, items: next } : m)));

  const upsert = (item: MenuItem, parentId?: string) => {
    if (!parentId) {
      setItems(items.some((i) => i.id === item.id) ? items.map((i) => (i.id === item.id ? { ...item, children: i.children } : i)) : [...items, item]);
      return;
    }
    setItems(
      items.map((p) =>
        p.id !== parentId
          ? p
          : { ...p, children: (p.children || []).some((c) => c.id === item.id) ? (p.children || []).map((c) => (c.id === item.id ? item : c)) : [...(p.children || []), item] }
      )
    );
  };

  const remove = async (item: MenuItem, parentId?: string) => {
    if (item.children?.length && !(await confirm({ title: 'Supprimer ce lien ?', message: `Ses ${item.children.length} sous-lien(s) seront également supprimés.`, confirmLabel: 'Supprimer', danger: true }))) return;
    if (!parentId) setItems(items.filter((i) => i.id !== item.id));
    else setItems(items.map((p) => (p.id === parentId ? { ...p, children: (p.children || []).filter((c) => c.id !== item.id) } : p)));
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setItems(arrayMove(items, items.findIndex((i) => i.id === e.active.id), items.findIndex((i) => i.id === e.over!.id)));
  };

  const copyFromPrimary = async () => {
    const primary = menus.find((m) => m.id === 'primary');
    if (!primary) return;
    if (items.length && !(await confirm({ title: 'Remplacer ce menu ?', message: 'Les liens actuels seront remplacés par ceux du menu principal.', confirmLabel: 'Remplacer' }))) return;
    setItems(structuredClone(primary.items).map((i) => ({ ...i, id: newId(), children: i.children?.map((c) => ({ ...c, id: newId() })) })));
  };

  const createMenu = async () => {
    const id = (newIdVal.trim() || slugifyMenu(newLabel)).slice(0, 40);
    const label = newLabel.trim() || id;
    if (!id || menus.some((m) => m.id === id)) return;
    await api.createMenu(id, label);
    const next = [...menus, { id, label, items: [] as MenuItem[] }];
    ed.setValue(next);
    patchSite('menus', next);
    setTab(id);
    setCreating(false);
    setNewLabel('');
    setNewIdVal('');
  };

  const deleteMenu = async () => {
    if (!menu || PROTECTED.has(menu.id)) return;
    if (!(await confirm({ title: 'Supprimer ce menu ?', message: `Le menu « ${menu.label} » sera définitivement retiré.`, confirmLabel: 'Supprimer', danger: true }))) return;
    await api.deleteMenu(menu.id);
    const next = menus.filter((m) => m.id !== menu.id);
    ed.setValue(next);
    patchSite('menus', next);
    setTab(next[0]?.id || 'primary');
    void reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menus"
        description="Emplacements de navigation : principal, mobile, pied de page, colonnes footer, ou menus personnalisés."
        actions={
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Nouveau menu
          </Button>
        }
      />
      <Tabs
        value={activeTab}
        onChange={setTab}
        tabs={menus.map((m) => ({
          value: m.id,
          label: m.label,
          icon: m.id === 'mobile' ? Smartphone : m.id === 'primary' ? Monitor : MenuIcon,
        }))}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">{menu?.label}</h2>
              <p className="text-xs text-slate-500">
                id: <span className="font-mono">{menu?.id}</span> — glissez les liens pour les réordonner.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTab !== 'primary' ? (
                <Button size="sm" icon={Copy} onClick={() => void copyFromPrimary()}>
                  Copier le menu principal
                </Button>
              ) : null}
              {!PROTECTED.has(activeTab) ? (
                <Button size="sm" variant="danger" icon={Trash2} onClick={() => void deleteMenu()}>
                  Supprimer le menu
                </Button>
              ) : null}
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing({ item: { id: newId(), label: '', path: '' }, isNew: true })}>
                Ajouter un lien
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState icon={MenuIcon} title="Menu vide" description="Ajoutez votre premier lien." />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <SortableTopItem key={item.id} item={item}>
                      {(handle) => (
                        <div className="space-y-2">
                          <Row
                            item={item}
                            depth={0}
                            first={i === 0}
                            last={i === items.length - 1}
                            dragHandle={handle}
                            onEdit={() => setEditing({ item, isNew: false })}
                            onDelete={() => void remove(item)}
                            onMove={(d) => setItems(arrayMove(items, i, i + d))}
                            onAddChild={activeTab !== 'footer' ? () => setEditing({ item: { id: newId(), label: '', path: '' }, parentId: item.id, isNew: true }) : undefined}
                          />
                          {(item.children || []).map((c, ci, arr) => (
                            <Row
                              key={c.id}
                              item={c}
                              depth={1}
                              first={ci === 0}
                              last={ci === arr.length - 1}
                              onEdit={() => setEditing({ item: c, parentId: item.id, isNew: false })}
                              onDelete={() => void remove(c, item.id)}
                              onMove={(d) => setItems(items.map((p) => (p.id === item.id ? { ...p, children: arrayMove(arr, ci, ci + d) } : p)))}
                            />
                          ))}
                        </div>
                      )}
                    </SortableTopItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Card>

        <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aperçu</p>
          <MenuPreview items={items} mode={activeTab === 'mobile' ? 'mobile' : 'desktop'} />
        </div>
      </div>

      <ItemModal item={editing?.item || null} onClose={() => setEditing(null)} onSave={(item) => upsert(item, editing?.parentId)} />
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nouveau menu"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Annuler</Button>
            <Button variant="primary" disabled={!newLabel.trim() && !newIdVal.trim()} onClick={() => void createMenu()}>
              Créer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Libellé">
            <Input
              autoFocus
              value={newLabel}
              onChange={(e) => {
                setNewLabel(e.target.value);
                if (!newIdVal) setNewIdVal(slugifyMenu(e.target.value));
              }}
              placeholder="Ex. : Réseaux sociaux"
            />
          </Field>
          <Field label="Identifiant" hint="Utilisé par le thème et les widgets (ex. social, footer-col-1).">
            <Input value={newIdVal} onChange={(e) => setNewIdVal(slugifyMenu(e.target.value))} className="font-mono" />
          </Field>
        </div>
      </Modal>
      <SaveBar dirty={ed.dirty} saving={ed.saving} onSave={ed.commit} onReset={ed.reset} blocker={ed.blocker} />
    </div>
  );
}
