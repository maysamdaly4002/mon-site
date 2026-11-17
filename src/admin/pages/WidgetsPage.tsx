/**
 * Snapify — Zones de widgets (style Apparence > Widgets)
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import React, { useCallback, useMemo, useState } from 'react';
import { GripVertical, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import type { CoreWidgetKind, WidgetArea, WidgetInstance } from '../../../server/cms/types';
import { api } from '../lib/api';
import { useEditable } from '../lib/hooks';
import { useSite, useSiteData } from '../context/SiteContext';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from '../ui/primitives';
import { SaveBar } from '../ui/SaveBar';

const KIND_OPTS: { value: CoreWidgetKind | 'module'; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'html', label: 'HTML' },
  { value: 'menu', label: 'Menu' },
  { value: 'recent_posts', label: 'Articles récents' },
  { value: 'search', label: 'Recherche' },
  { value: 'module', label: 'Module' },
];

const newId = () => `w-${crypto.randomUUID().slice(0, 8)}`;

export default function WidgetsPage() {
  const site = useSiteData();
  const { patchSite, reload } = useSite();
  const [areaId, setAreaId] = useState(site.widgetAreas?.[0]?.id || 'footer-1');

  const save = useCallback(
    async (areas: WidgetArea[]) => {
      await api.saveWidgetAreas(areas);
      patchSite('widgetAreas', areas);
    },
    [patchSite]
  );
  const ed = useEditable<WidgetArea[]>(site.widgetAreas || [], save, { successMessage: 'Widgets enregistrés' });
  const areas = ed.value || [];
  const area = areas.find((a) => a.id === areaId) || areas[0];
  const menus = site.menus || [];

  const setWidgets = (widgets: WidgetInstance[]) => {
    if (!area) return;
    ed.setValue(areas.map((a) => (a.id === area.id ? { ...a, widgets } : a)));
  };

  const addWidget = (kind: CoreWidgetKind | 'module') => {
    if (!area) return;
    const base: WidgetInstance = {
      id: newId(),
      kind,
      title: KIND_OPTS.find((k) => k.value === kind)?.label || kind,
      data:
        kind === 'menu'
          ? { menuId: menus[0]?.id || 'footer' }
          : kind === 'recent_posts'
            ? { limit: 5 }
            : kind === 'text'
              ? { body: '' }
              : kind === 'html'
                ? { html: '' }
                : kind === 'module'
                  ? { module: '', widget: '', options: {} }
                  : {},
    };
    setWidgets([...area.widgets, base]);
  };

  const updateWidget = (id: string, patch: Partial<WidgetInstance>) => {
    if (!area) return;
    setWidgets(area.widgets.map((w) => (w.id === id ? { ...w, ...patch, data: { ...w.data, ...(patch.data || {}) } } : w)));
  };

  const move = (i: number, dir: -1 | 1) => {
    if (!area) return;
    const j = i + dir;
    if (j < 0 || j >= area.widgets.length) return;
    const next = [...area.widgets];
    [next[i], next[j]] = [next[j], next[i]];
    setWidgets(next);
  };

  const tabs = useMemo(() => areas.map((a) => ({ value: a.id, label: a.label })), [areas]);

  if (!areas.length) {
    return (
      <div className="space-y-4">
        <PageHeader title="Widgets" description="Zones d’affichage du thème (pied de page, barre latérale blog…)." />
        <Alert tone="warning" title="Aucune zone">
          Rechargez le site ou réactivez le thème pour initialiser les zones par défaut.
          <Button size="sm" className="mt-3" onClick={() => void reload()}>
            Recharger
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Widgets"
        description="Comme WordPress : assignez des widgets aux zones du thème (footer, sidebar blog)."
        actions={
          <div className="flex flex-wrap gap-2">
            {KIND_OPTS.map((k) => (
              <Button key={k.value} size="sm" icon={Plus} onClick={() => addWidget(k.value)}>
                {k.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setAreaId(t.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${area?.id === t.value ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {area ? (
        <Card>
          <div className="mb-4">
            <h2 className="text-[15px] font-semibold text-slate-900">{area.label}</h2>
            {area.description ? <p className="text-xs text-slate-500">{area.description}</p> : null}
            <p className="mt-1 font-mono text-[11px] text-slate-400">id: {area.id}</p>
          </div>
          {!area.widgets.length ? (
            <EmptyState icon={LayoutTemplate} title="Zone vide" description="Ajoutez un widget depuis les boutons ci-dessus." />
          ) : (
            <ul className="space-y-3">
              {area.widgets.map((w, i) => (
                <li key={w.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <GripVertical className="h-4 w-4 text-slate-300" />
                    <Badge>{KIND_OPTS.find((k) => k.value === w.kind)?.label || w.kind}</Badge>
                    <Input className="max-w-xs" value={w.title} onChange={(e) => updateWidget(w.id, { title: e.target.value })} placeholder="Titre du widget" />
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                        ↑
                      </Button>
                      <Button size="sm" disabled={i === area.widgets.length - 1} onClick={() => move(i, 1)}>
                        ↓
                      </Button>
                      <Button size="sm" variant="danger" icon={Trash2} onClick={() => setWidgets(area.widgets.filter((x) => x.id !== w.id))} />
                    </div>
                  </div>
                  {w.kind === 'text' ? (
                    <Field label="Contenu">
                      <Textarea rows={3} value={String(w.data.body || '')} onChange={(e) => updateWidget(w.id, { data: { body: e.target.value } })} />
                    </Field>
                  ) : null}
                  {w.kind === 'html' ? (
                    <Field label="HTML">
                      <Textarea rows={4} className="font-mono text-xs" value={String(w.data.html || '')} onChange={(e) => updateWidget(w.id, { data: { html: e.target.value } })} />
                    </Field>
                  ) : null}
                  {w.kind === 'menu' ? (
                    <Field label="Menu source">
                      <Select
                        value={String(w.data.menuId || '')}
                        onChange={(v) => updateWidget(w.id, { data: { menuId: v } })}
                        options={menus.map((m) => ({ value: m.id, label: `${m.label} (${m.id})` }))}
                      />
                    </Field>
                  ) : null}
                  {w.kind === 'recent_posts' ? (
                    <Field label="Nombre d’articles">
                      <Input type="number" min={1} max={20} value={Number(w.data.limit) || 5} onChange={(e) => updateWidget(w.id, { data: { limit: Number(e.target.value) || 5 } })} />
                    </Field>
                  ) : null}
                  {w.kind === 'module' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Module (id)">
                        <Input value={String(w.data.module || '')} onChange={(e) => updateWidget(w.id, { data: { module: e.target.value } })} placeholder="novalabs.shop" />
                      </Field>
                      <Field label="Widget">
                        <Input value={String(w.data.widget || '')} onChange={(e) => updateWidget(w.id, { data: { widget: e.target.value } })} placeholder="products" />
                      </Field>
                    </div>
                  ) : null}
                  {w.kind === 'search' ? <p className="text-xs text-slate-500">Affiche un champ de recherche vers le blog.</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <SaveBar dirty={ed.dirty} saving={ed.saving} onSave={ed.commit} onReset={ed.reset} blocker={ed.blocker} />
    </div>
  );
}
