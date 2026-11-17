/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/** Confirmation d'installation : provenance, signature, licence et permissions demandées. */
import { useRef, useState } from 'react';
import { BadgeCheck, KeyRound, ShieldAlert, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { InstalledModuleInfo, StagedPackageInfo } from '../../../server/modules/types';
import { api } from '../lib/api';
import { errorMessage } from '../lib/hooks';
import { Alert, Badge, Button } from '../ui/primitives';
import { Modal } from '../ui/overlays';
import { fileToBase64, ModuleIcon, notifyModulesChanged, PermissionList, PRICING_LABEL } from './labels';

const EXTENSION = { module: '.snapmod', theme: '.snaptheme' } as const;

/** Import manuel d'un paquet `.snapmod` ou `.snaptheme` (vérifié côté serveur avant toute confirmation). */
export function ImportPackageButton({ kind = 'module', onInstalled }: { kind?: 'module' | 'theme'; onInstalled?: (m: InstalledModuleInfo) => void }) {
  const ext = EXTENSION[kind];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [staged, setStaged] = useState<StagedPackageInfo | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(ext)) {
      toast.error(`Choisissez un fichier ${ext}`);
      return;
    }
    setBusy(true);
    try {
      setStaged(await api.modules.upload(file.name, await fileToBase64(file)));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <input ref={input} type="file" accept={ext} hidden onChange={(e) => void pick(e.target.files?.[0])} />
      <Button icon={Upload} loading={busy} onClick={() => input.current?.click()}>
        {kind === 'theme' ? 'Importer un thème' : 'Importer un module'}
      </Button>
      <InstallDialog staged={staged} onClose={() => setStaged(null)} onInstalled={onInstalled} />
    </>
  );
}

const ACTION_LABEL: Record<StagedPackageInfo['action'], string> = {
  install: 'Installer',
  update: 'Mettre à jour',
  reinstall: 'Réinstaller',
  downgrade: 'Revenir à cette version',
};

export function InstallDialog({ staged, onClose, onInstalled }: { staged: StagedPackageInfo | null; onClose: () => void; onInstalled?: (m: InstalledModuleInfo) => void }) {
  const [busy, setBusy] = useState(false);
  if (!staged) return null;
  const m = staged.manifest;
  const isTheme = m.kind === 'theme';
  const blocked = staged.blockers.length > 0;

  const install = async () => {
    setBusy(true);
    try {
      const installed = await api.modules.install(staged.token);
      toast.success(`${installed.name} ${installed.version} installé`);
      notifyModulesChanged();
      onInstalled?.(installed);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`${ACTION_LABEL[staged.action]} « ${m.name} »`}
      description={staged.installedVersion ? `Version installée : ${staged.installedVersion} → ${m.version}` : `Version ${m.version}`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={install} loading={busy} disabled={blocked}>
            {ACTION_LABEL[staged.action]}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {isTheme && m.screenshot ? (
          <img src={m.screenshot} alt={`Aperçu du thème ${m.name}`} className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover object-top" />
        ) : null}
        <div className="flex items-start gap-3">
          {isTheme ? null : <ModuleIcon name={m.icon} />}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              {m.name}
              {isTheme ? <Badge tone="info">Thème</Badge> : null}
              <Badge tone={m.pricing === 'free' ? 'success' : 'brand'}>{PRICING_LABEL[m.pricing]}</Badge>
            </p>
            <p className="text-xs text-slate-500">
              {m.id} · par {m.author.name}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{m.description}</p>
          </div>
        </div>

        {staged.blockers.map((b) => (
          <Alert key={b} tone="danger" icon={ShieldAlert} title="Installation bloquée">
            {b}
          </Alert>
        ))}

        <div className="space-y-2 rounded-xl border border-slate-200 p-4">
          {staged.signature.valid ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <ShieldCheck className="h-4 w-4" /> Signé par NOVALABS (clé {staged.signature.kid}) : contenu authentique et intact
            </p>
          ) : staged.signature.devUnsigned ? (
            <p className="flex items-center gap-2 text-sm text-amber-700">
              <ShieldAlert className="h-4 w-4" /> Paquet non signé, accepté uniquement parce que le mode développeur est actif
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-rose-700">
              <ShieldAlert className="h-4 w-4" /> Signature absente ou invalide
            </p>
          )}
          <p className={`flex items-center gap-2 text-sm ${staged.license.state === 'valid' ? 'text-emerald-700' : 'text-amber-700'}`}>
            {staged.license.state === 'valid' ? <BadgeCheck className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            {staged.license.message}
            {staged.license.state === 'missing' && m.pricing === 'paid' ? ' — vous pourrez la saisir après l’installation' : ''}
          </p>
        </div>

        {isTheme ? (
          <p className="text-sm text-slate-500">
            Un thème ne change que l’apparence du site : il n’exécute aucun code serveur et n’a accès à aucune donnée privée.
            {staged.action === 'install' ? ' Après l’installation, vous pourrez le prévisualiser avant de l’activer.' : ''}
          </p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ce module pourra</p>
            <PermissionList permissions={m.permissions} hasServer={m.hasServer} />
          </div>
        )}
      </div>
    </Modal>
  );
}
