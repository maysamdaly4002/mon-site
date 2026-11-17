/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, RotateCcw, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { SettingField } from '../../../sdk/index';
import { useAuth } from '../context/AuthContext';
import { useSiteData } from '../context/SiteContext';
import { api, ApiError } from '../lib/api';
import { errorMessage, useAsync, useEditable } from '../lib/hooks';
import { Alert, Badge, Button, EmptyState, ErrorState, PageHeader, PageSkeleton, Select } from '../ui/primitives';
import { SaveBar } from '../ui/SaveBar';
import { DeviceSwitch, PreviewFrame, type Device } from '../editor/PreviewFrame';
import { SettingsForm } from '../modules/SettingsForm';

type Settings = Record<string, unknown>;

const defaults = (schema: SettingField[]): Settings => Object.fromEntries(schema.map((f) => [f.key, f.default]));

export default function ThemeCustomizePage() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  const isSuper = can('appearance.themes');
  const site = useSiteData();
  const list = useAsync(() => api.themes.list(), []);
  const themes = list.data?.themes ?? [];
  const themeId = params.get('theme') || themes.find((t) => t.active)?.id || '';
  const detail = useAsync(() => (themeId ? api.themes.detail(themeId) : Promise.resolve(null)), [themeId]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [path, setPath] = useState('/');
  const [device, setDevice] = useState<Device>('desktop');
  const [activating, setActivating] = useState(false);

  const initial = useMemo(() => detail.data?.settings ?? null, [detail.data?.settings]);
  const save = useCallback(
    async (value: Settings) => {
      try {
        const r = await api.themes.saveSettings(themeId, value);
        setFieldErrors({});
        return r.settings;
      } catch (e) {
        if (e instanceof ApiError && e.fields) setFieldErrors(e.fields);
        throw e;
      }
    },
    [themeId]
  );
  const ed = useEditable<Settings>(initial, save, { successMessage: 'Options du thème enregistrées' });

  const t = detail.data;
  const payload = useMemo(() => (t?.descriptor ? { theme: { descriptor: t.descriptor, settings: ed.value ?? t.settings } } : {}), [t?.descriptor, t?.settings, ed.value]);

  const pages = site.pages
    .filter((p) => p.status === 'published')
    .sort((x, y) => x.path.localeCompare(y.path))
    .map((p) => ({ value: p.path, label: p.path === '/' ? 'Accueil' : p.title }));

  const activate = async () => {
    if (!t) return;
    setActivating(true);
    try {
      if (ed.dirty && !(await ed.commit())) return;
      await api.themes.activate(t.id);
      toast.success(`${t.name} est maintenant le thème du site`);
      detail.reload();
      list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setActivating(false);
    }
  };

  if ((list.loading && !list.data) || (detail.loading && !detail.data)) return <PageSkeleton />;
  if (list.error && !list.data) return <ErrorState message={list.error} onRetry={list.reload} />;
  if (!themeId) {
    return <EmptyState icon={SlidersHorizontal} title="Aucun thème actif" description="Installez puis activez un thème depuis Apparence > Thèmes." />;
  }
  if (detail.error && !detail.data) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  if (!t) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link to="/themes" className="hover:text-slate-800">
            Thèmes
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            Personnaliser « {t.name} »
            {t.active ? (
              <Badge tone="success" dot>
                Actif
              </Badge>
            ) : (
              <Badge tone="info">Aperçu</Badge>
            )}
          </span>
        }
        description={t.active ? 'Les options s’appliquent au site dès leur enregistrement.' : 'Ce thème n’est pas encore actif : les visiteurs voient toujours le thème actuel.'}
        actions={
          <>
            {themes.length > 1 ? (
              <div className="w-52">
                <Select
                  value={t.id}
                  onChange={(id) => setParams({ theme: id })}
                  options={themes.map((x) => ({ value: x.id, label: x.active ? `${x.name} (actif)` : x.name }))}
                />
              </div>
            ) : null}
            {!t.active && isSuper ? (
              <Button variant="primary" icon={CheckCircle2} loading={activating} disabled={!t.descriptor} onClick={() => void activate()}>
                {ed.dirty ? 'Enregistrer et activer' : 'Activer ce thème'}
              </Button>
            ) : null}
          </>
        }
      />

      {!t.descriptor ? (
        <Alert tone="danger" icon={ShieldAlert} title="Aperçu indisponible">
          {t.status.message}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <div className="min-w-0 space-y-4">
          {t.settingsSchema.length && ed.value ? (
            <>
              <fieldset disabled={!can('appearance.customize')} className="min-w-0">
                <SettingsForm fields={t.settingsSchema} value={ed.value} errors={fieldErrors} onChange={(p) => ed.patch(p)} />
              </fieldset>
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => ed.patch(defaults(t.settingsSchema))}>
                Options par défaut du thème
              </Button>
            </>
          ) : (
            <EmptyState icon={SlidersHorizontal} title="Aucune option" description="Ce thème ne propose pas de réglage." />
          )}
        </div>
        <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
          <div className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                {t.active ? <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> : <Eye className="h-3.5 w-3.5" />}
                {t.active ? 'Aperçu en direct' : `Aperçu de ${t.name}`}
              </span>
              <div className="ml-auto w-48">
                <Select value={path} onChange={setPath} options={pages.length ? pages : [{ value: '/', label: 'Accueil' }]} />
              </div>
              <DeviceSwitch value={device} onChange={setDevice} />
            </div>
            <div className="min-h-0 flex-1">
              <PreviewFrame path={path} payload={payload} device={device} />
            </div>
          </div>
        </div>
      </div>
      <SaveBar dirty={ed.dirty} saving={ed.saving} onSave={ed.commit} onReset={ed.reset} blocker={ed.blocker} />
    </div>
  );
}
