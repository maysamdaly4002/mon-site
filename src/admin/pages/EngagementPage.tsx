/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useCallback } from 'react';
import { ChevronDown, ChevronUp, MousePointerClick, Plus, Puzzle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FloatingButtonConfig } from '../../../server/cms/types';
import { api } from '../lib/api';
import { useEditable } from '../lib/hooks';
import { useSite, useSiteData } from '../context/SiteContext';
import { Alert, Button, EmptyState, Field, Input, PageHeader, Section, Select, Switch } from '../ui/primitives';
import { SaveBar } from '../ui/SaveBar';
import { LinkInput } from '../editor/fields';

interface State {
  buttons: FloatingButtonConfig[];
}

const DEFAULT_BAR: FloatingButtonConfig[] = [
  { id: 'call', label: 'Appeler', path: 'tel:', style: 'outline', enabled: true },
  { id: 'contact', label: 'Parler de votre projet', path: '/contact/', style: 'primary', enabled: true },
];

function PhonePreview({ state }: { state: State }) {
  const site = useSiteData();
  const buttons = state.buttons.filter((b) => b.enabled && b.label);
  return (
    <div className="mx-auto w-[270px] overflow-hidden rounded-[30px] border-[7px] border-slate-900 bg-white shadow-2xl">
      <div className="relative h-[480px] bg-gradient-to-b from-slate-50 to-white">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <span className="text-sm font-bold" style={{ color: site.branding.colors.navy }}>
            {site.branding.siteName}
          </span>
          <span className="h-3 w-5 rounded-sm bg-slate-200" />
        </div>
        <div className="space-y-2 p-4">
          <div className="h-24 rounded-lg" style={{ background: site.branding.colors.navy }} />
          <div className="h-3 w-3/4 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-200" />
          <div className="h-3 w-2/3 rounded bg-slate-100" />
        </div>
        <div className="absolute inset-x-3 bottom-3 flex gap-2">
          {(buttons.length ? buttons : DEFAULT_BAR).slice(0, 2).map((b) => (
              <span
                key={b.id}
                className="flex-1 truncate rounded-lg px-2 py-2 text-center text-xs font-semibold"
                style={
                  b.style === 'primary'
                    ? { background: site.branding.colors.primary, color: '#fff' }
                    : b.style === 'outline'
                      ? { border: `1.5px solid ${site.branding.colors.primary}`, color: site.branding.colors.primary, background: '#fff' }
                      : { color: site.branding.colors.navy, background: '#f1f5f9' }
                }
              >
                {b.label}
              </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EngagementPage() {
  const site = useSiteData();
  const { patchSite } = useSite();
  const initial = React.useMemo<State>(() => ({ buttons: site.floatingButtons }), [site.floatingButtons]);

  const save = useCallback(
    async (s: State) => {
      await api.saveFloatingButtons(s.buttons);
      patchSite('floatingButtons', s.buttons);
    },
    [patchSite]
  );
  const ed = useEditable<State>(initial, save);
  if (!ed.value) return null;
  const { buttons } = ed.value;
  const setButtons = (b: FloatingButtonConfig[]) => ed.patch({ buttons: b });

  return (
    <div className="space-y-6">
      <PageHeader title="Boutons flottants" description="Les boutons d’action affichés en permanence en bas de l’écran sur mobile." />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Alert tone="info" icon={Puzzle}>
            Le bouton WhatsApp et l’assistant IA sont désormais des modules : réglez-les depuis{' '}
            <Link to="/modules" className="font-semibold underline">
              Modules installés
            </Link>
            .
          </Alert>
          <Section
            title={
              <span className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-brand-600" /> Boutons d’action flottants
              </span>
            }
            description="Barre fixée en bas de l’écran sur mobile. Sans bouton configuré, le site affiche « Appeler » et « Parler de votre projet ». Deux boutons au maximum."
            actions={
              <Button size="sm" icon={Plus} disabled={buttons.length >= 4} onClick={() => setButtons([...buttons, { id: crypto.randomUUID(), label: '', path: '/contact/', style: 'primary', enabled: true }])}>
                Ajouter
              </Button>
            }
          >
            {buttons.length === 0 ? (
              <EmptyState icon={MousePointerClick} title="Aucun bouton" description="Ajoutez un bouton pour inciter vos visiteurs à passer à l’action." />
            ) : (
              buttons.map((b, i) => (
                <div key={b.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_150px]">
                    <Field label="Libellé">
                      <Input value={b.label} onChange={(e) => setButtons(buttons.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)))} placeholder="Demander un audit" />
                    </Field>
                    <Field label="Destination">
                      <LinkInput value={b.path} onChange={(path) => setButtons(buttons.map((x) => (x.id === b.id ? { ...x, path } : x)))} />
                    </Field>
                    <Field label="Style">
                      <Select
                        value={b.style}
                        onChange={(style) => setButtons(buttons.map((x) => (x.id === b.id ? { ...x, style: style as FloatingButtonConfig['style'] } : x)))}
                        options={[
                          { value: 'primary', label: 'Plein' },
                          { value: 'outline', label: 'Contour' },
                          { value: 'ghost', label: 'Discret' },
                        ]}
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Switch checked={b.enabled} onChange={(enabled) => setButtons(buttons.map((x) => (x.id === b.id ? { ...x, enabled } : x)))} label="Actif" />
                    <div className="flex">
                      <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => setButtons(swap(buttons, i, i - 1))}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={i === buttons.length - 1} onClick={() => setButtons(swap(buttons, i, i + 1))}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setButtons(buttons.filter((x) => x.id !== b.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
            {buttons.filter((b) => b.enabled).length > 2 ? <Alert tone="warning">Seuls les deux premiers boutons actifs sont affichés sur mobile.</Alert> : null}
          </Section>
        </div>

        <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Aperçu mobile</p>
          <PhonePreview state={ed.value} />
        </div>
      </div>
      <SaveBar dirty={ed.dirty} saving={ed.saving} onSave={ed.commit} onReset={ed.reset} blocker={ed.blocker} />
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
