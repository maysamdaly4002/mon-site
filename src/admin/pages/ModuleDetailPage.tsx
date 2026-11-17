/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, BadgeCheck, KeyRound, ShieldAlert, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { InstalledModuleDetail, InstalledModuleInfo } from '../../../server/modules/types';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { errorMessage, useAsync, useEditable } from '../lib/hooks';
import { fmtDate, fmtDateTime } from '../lib/format';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, PageSkeleton, StatCard, Switch, Textarea } from '../ui/primitives';
import { Modal, useConfirm } from '../ui/overlays';
import { SaveBar } from '../ui/SaveBar';
import { SettingsForm } from '../modules/SettingsForm';
import { ModuleIcon, ModuleStatusBadge, notifyModulesChanged, PermissionList, PRICING_LABEL } from '../modules/labels';

type Settings = Record<string, unknown>;

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{children}</span>
    </div>
  );
}

function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {children}
    </Card>
  );
}

function LicenseModal({ module, open, onClose, onSaved }: { module: InstalledModuleDetail; open: boolean; onClose: () => void; onSaved: (m: InstalledModuleInfo) => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const m = await api.modules.setLicense(module.id, key.trim());
      toast.success('Licence vérifiée et enregistrée');
      onSaved(m);
      setKey('');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Clé de licence"
      description={`Collez la clé fournie par NOVALABS pour « ${module.name} ». Elle est vérifiée localement : signature, module, domaine et date d’expiration.`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={busy} disabled={!key.trim().startsWith('SNAPIFY-LIC-')} onClick={submit}>
            Vérifier et enregistrer
          </Button>
        </>
      }
    >
      <Field label="Clé" hint="Commence par SNAPIFY-LIC-">
        <Textarea value={key} onChange={(e) => setKey(e.target.value)} rows={5} className="font-mono text-xs" placeholder="SNAPIFY-LIC-…" />
      </Field>
    </Modal>
  );
}

export default function ModuleDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { can } = useAuth();
  const isSuper = can('modules.manage');
  const canEdit = can('modules.settings');
  const { data, setData, error, loading, reload } = useAsync(() => api.modules.detail(id), [id]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const initial = useMemo(() => data?.settings ?? null, [data?.settings]);
  const save = useCallback(
    async (value: Settings) => {
      try {
        const r = await api.modules.saveSettings(id, value);
        setFieldErrors({});
        return r.settings;
      } catch (e) {
        if (e instanceof ApiError && e.fields) setFieldErrors(e.fields);
        throw e;
      }
    },
    [id]
  );
  const ed = useEditable<Settings>(initial, save, { successMessage: 'Réglages du module enregistrés' });

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const m = data;

  const merge = (info: InstalledModuleInfo) => {
    setData({ ...m, ...info });
    notifyModulesChanged();
  };

  const toggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      merge(await api.modules.setEnabled(m.id, enabled));
      toast.success(enabled ? 'Module activé' : 'Module désactivé');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  const uninstall = async () => {
    const ok = await confirm({
      title: `Désinstaller « ${m.name} » ?`,
      message: 'Le module disparaîtra du site et ses réglages ainsi que ses données seront supprimés. Vous pourrez le réinstaller depuis la marketplace.',
      confirmLabel: 'Désinstaller',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.modules.uninstall(m.id);
      notifyModulesChanged();
      toast.success(`${m.name} désinstallé`);
      navigate('/modules');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const statusTone = m.status.code === 'disabled' ? 'info' : m.status.code.startsWith('license') ? 'warning' : 'danger';
  const report = m.report;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link to="/modules" className="hover:text-slate-800">
            Modules installés
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <ModuleIcon name={m.icon} className="h-9 w-9" />
            {m.name}
            <ModuleStatusBadge code={m.status.code} />
          </span>
        }
        description={m.description}
        actions={
          isSuper ? (
            <>
              <Switch checked={m.enabled} disabled={toggling} onChange={(v) => void toggle(v)} label={m.enabled ? 'Activé' : 'Désactivé'} />
              <Button variant="ghost" icon={Trash2} className="text-rose-600 hover:bg-rose-50" onClick={() => void uninstall()}>
                Désinstaller
              </Button>
            </>
          ) : null
        }
      />

      {m.status.code !== 'active' ? (
        <Alert
          tone={statusTone}
          icon={statusTone === 'info' ? undefined : ShieldAlert}
          action={
            m.status.code.startsWith('license') && isSuper ? (
              <Button size="sm" icon={KeyRound} onClick={() => setLicenseOpen(true)}>
                Saisir une licence
              </Button>
            ) : undefined
          }
        >
          {m.status.message}
        </Alert>
      ) : null}

      {report?.alerts?.map((a, i) => (
        <Alert key={i} tone={a.tone} title={a.title}>
          {a.text}
        </Alert>
      ))}
      {report?.stats?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {report.stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} icon={Activity} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {m.settingsSchema.length && ed.value ? (
            <fieldset disabled={!canEdit} className="min-w-0">
              <SettingsForm fields={m.settingsSchema} value={ed.value} errors={fieldErrors} onChange={(p) => ed.patch(p)} />
            </fieldset>
          ) : (
            <EmptyState icon={SlidersHorizontal} title="Aucun réglage" description="Ce module fonctionne sans configuration." />
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <SideCard title="Licence">
            <p className={`flex items-start gap-2 text-sm ${m.license.state === 'valid' ? 'text-emerald-700' : 'text-amber-700'}`}>
              {m.license.state === 'valid' ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />}
              {m.license.message}
            </p>
            {m.license.licenseId ? (
              <div className="mt-3 divide-y divide-slate-100">
                <InfoRow label="Titulaire">{m.license.licensee}</InfoRow>
                <InfoRow label="Formule">{m.license.plan}</InfoRow>
                <InfoRow label="Domaines">{m.license.domains?.includes('*') ? 'Tous' : m.license.domains?.join(', ')}</InfoRow>
                <InfoRow label="Expiration">{m.license.expiresAt ? fmtDate(m.license.expiresAt) : 'Jamais'}</InfoRow>
                <InfoRow label="Référence">
                  <span className="font-mono text-xs">{m.license.licenseId}</span>
                </InfoRow>
              </div>
            ) : null}
            {isSuper ? (
              <Button size="sm" className="mt-3 w-full" icon={KeyRound} onClick={() => setLicenseOpen(true)}>
                {m.license.licenseId ? 'Remplacer la licence' : 'Saisir une licence'}
              </Button>
            ) : null}
          </SideCard>

          <SideCard title="Sécurité">
            {m.signature.valid ? (
              <p className="flex items-start gap-2 text-sm text-emerald-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Signé par NOVALABS (clé {m.signature.kid}). Les fichiers sont contrôlés à chaque démarrage.
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-amber-700">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {m.signature.devUnsigned ? 'Module non signé, chargé uniquement en mode développeur.' : 'Signature invalide : le module est bloqué.'}
              </p>
            )}
            <p className="mb-2 mt-4 text-xs font-medium text-slate-500">Permissions accordées</p>
            <PermissionList permissions={m.permissions} hasServer={m.hasServer} />
          </SideCard>

          <SideCard title="Informations">
            <div className="divide-y divide-slate-100">
              <InfoRow label="Version">{m.version}</InfoRow>
              <InfoRow label="Éditeur">
                {m.author.url ? (
                  <a href={m.author.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                    {m.author.name}
                  </a>
                ) : (
                  m.author.name
                )}
              </InfoRow>
              <InfoRow label="Tarif">
                <Badge tone={m.pricing === 'free' ? 'success' : 'brand'}>{PRICING_LABEL[m.pricing]}</Badge>
              </InfoRow>
              <InfoRow label="Catégorie">{m.category}</InfoRow>
              <InfoRow label="Identifiant">
                <span className="font-mono text-xs">{m.id}</span>
              </InfoRow>
              <InfoRow label="Provenance">{m.source === 'marketplace' ? 'Marketplace' : 'Import manuel'}</InfoRow>
              <InfoRow label="Installé le">{fmtDateTime(m.installedAt)}</InfoRow>
              <InfoRow label="Mis à jour le">{fmtDateTime(m.updatedAt)}</InfoRow>
            </div>
          </SideCard>
        </div>
      </div>

      <LicenseModal module={m} open={licenseOpen} onClose={() => setLicenseOpen(false)} onSaved={() => {
          void reload();
          notifyModulesChanged();
        }} />
      <SaveBar dirty={ed.dirty} saving={ed.saving} onSave={ed.commit} onReset={ed.reset} blocker={ed.blocker} />
    </div>
  );
}
