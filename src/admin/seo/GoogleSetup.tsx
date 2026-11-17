/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, CheckCircle2, ChevronDown, Copy, ExternalLink, FileJson, KeyRound, Lightbulb, ShieldCheck, Trash2 } from 'lucide-react';
import { api, type GoogleStatus } from '../lib/api';
import { errorMessage } from '../lib/hooks';
import { Alert, Badge, Button, Card, cx, Field, Input } from '../ui/primitives';
import { Modal, useConfirm } from '../ui/overlays';

const CONSOLE = {
  project: 'https://console.cloud.google.com/projectcreate',
  api: 'https://console.cloud.google.com/apis/library/searchconsole.googleapis.com',
  branding: 'https://console.cloud.google.com/auth/branding',
  audience: 'https://console.cloud.google.com/auth/audience',
  client: 'https://console.cloud.google.com/auth/clients/create',
  clients: 'https://console.cloud.google.com/auth/clients',
  permissions: 'https://myaccount.google.com/connections',
  searchConsole: 'https://search.google.com/search-console/welcome',
};

/** Messages affichés au retour de Google (paramètre `reason`). */
export function googleErrorMessage(reason: string | null): string {
  switch (reason) {
    case 'access_denied':
      return 'Google a refusé l’accès : soit vous avez cliqué sur « Annuler », soit l’application est encore en mode « Test » et ce compte Google n’est pas déclaré comme utilisateur test. Publiez l’application (étape 3) puis réessayez.';
    case 'redirect_uri_mismatch':
      return 'L’URI de redirection ne correspond pas à celle déclarée dans l’ID client Google. Recopiez-la exactement (étape 4).';
    case 'invalid_client':
      return 'Google ne reconnaît pas l’ID client ou le code secret. Vérifiez les identifiants enregistrés.';
    case 'invalid_grant':
      return 'Le code d’autorisation a expiré. Relancez la connexion.';
    case 'no_refresh_token':
      return 'Google n’a pas fourni d’accès permanent. Retirez l’application de votre compte Google (Sécurité › Applications tierces) puis reconnectez-vous.';
    case 'scope_denied':
      return 'L’accès à Search Console n’a pas été coché sur l’écran de Google. Relancez la connexion et cochez toutes les autorisations demandées.';
    case 'state':
      return 'La demande de connexion a expiré (plus de 10 minutes) ou le serveur a redémarré entre-temps. Relancez la connexion.';
    case 'network':
      return 'Le serveur n’a pas pu joindre Google. Vérifiez sa connexion Internet.';
    default:
      return 'La connexion à Google a échoué. Réessayez, puis consultez « Problèmes fréquents » si l’erreur persiste.';
  }
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
        <Button
          icon={done ? Check : Copy}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
        >
          {done ? 'Copié' : 'Copier'}
        </Button>
      </div>
    </div>
  );
}

const ConsoleLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer">
    <Button size="sm" icon={ExternalLink}>
      {children}
    </Button>
  </a>
);

/** Formulaire ID client + code secret, avec import du fichier JSON téléchargé depuis Google. */
export function CredentialsForm({ status, onSaved, onCancel }: { status: GoogleStatus; onSaved: () => void; onCancel?: () => void }) {
  const [clientId, setClientId] = useState(status.source === 'settings' ? status.clientId : '');
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keepSecret = status.source === 'settings' && clientId.trim() === status.clientId;
  const idValid = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(clientId.trim());

  const importJson = async (file: File) => {
    try {
      const json = JSON.parse(await file.text()) as { web?: { client_id?: string; client_secret?: string; redirect_uris?: string[] }; installed?: unknown };
      if (!json.web) {
        setError(json.installed ? 'Ce fichier correspond à une application de bureau : créez un ID client de type « Application Web ».' : 'Fichier non reconnu : téléchargez le JSON de l’ID client depuis la console Google.');
        return;
      }
      setClientId(json.web.client_id ?? '');
      setSecret(json.web.client_secret ?? '');
      setError(
        json.web.redirect_uris && !json.web.redirect_uris.includes(status.redirectUri)
          ? `Attention : l’URI ${status.redirectUri} ne figure pas dans les URI de redirection de ce client. Ajoutez-la dans la console Google.`
          : null
      );
      toast.success('Identifiants importés depuis le fichier');
    } catch {
      setError('Fichier JSON illisible.');
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.google.saveCredentials(clientId.trim(), secret.trim());
      toast.success('Identifiants vérifiés auprès de Google et enregistrés');
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 transition hover:border-brand-400 hover:bg-brand-50/40">
        <FileJson className="h-5 w-5 text-slate-400" />
        <span>
          <span className="font-medium text-slate-800">Importer le fichier JSON</span> téléchargé depuis Google (facultatif)
        </span>
        <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void importJson(e.target.files[0]).then(() => (e.target.value = ''))} />
      </label>
      <Field label="ID client" hint="Se termine par .apps.googleusercontent.com">
        <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="123456789012-abc….apps.googleusercontent.com" className="font-mono text-xs" invalid={!!clientId && !idValid} autoComplete="off" spellCheck={false} />
      </Field>
      <Field label="Code secret du client" hint={keepSecret ? 'Laissez vide pour conserver le code secret enregistré.' : 'Commence généralement par GOCSPX-. Il est chiffré dans la base de données.'}>
        <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={keepSecret ? '•••••••• (inchangé)' : 'GOCSPX-…'} className="font-mono text-xs" autoComplete="new-password" />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button type="submit" variant="primary" icon={ShieldCheck} loading={saving} disabled={!idValid || (!secret.trim() && !keepSecret)}>
          Vérifier et enregistrer
        </Button>
      </div>
    </form>
  );
}

const STEPS = ['project', 'api', 'consent', 'client', 'credentials'] as const;
type StepId = (typeof STEPS)[number];
const STORE_KEY = 'snapify.googleSetup';

function loadDone(): Set<StepId> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]') as StepId[]);
  } catch {
    return new Set();
  }
}

/** Assistant pas à pas : projet Google Cloud, API, écran de consentement, ID client, saisie des identifiants. */
export function GoogleSetupWizard({ status, canManage, onConfigured }: { status: GoogleStatus; canManage: boolean; onConfigured: () => void }) {
  const [done, setDone] = useState<Set<StepId>>(loadDone);
  const firstOpen = STEPS.find((s) => !done.has(s)) ?? 'credentials';
  const [open, setOpen] = useState<StepId>(firstOpen);
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)/.test(status.javascriptOrigin);

  const mark = (id: StepId, value = true) => {
    const next = new Set(done);
    if (value) next.add(id);
    else next.delete(id);
    setDone(next);
    localStorage.setItem(STORE_KEY, JSON.stringify([...next]));
    if (value) {
      const after = STEPS[STEPS.indexOf(id) + 1];
      if (after) setOpen(after);
    }
  };

  const steps: { id: StepId; title: string; time: string; body: React.ReactNode }[] = [
    {
      id: 'project',
      title: 'Créer un projet Google Cloud',
      time: '1 min',
      body: (
        <>
          <p>
            Connectez-vous avec le compte Google qui gère votre site dans Search Console, puis créez un projet. Nommez-le par exemple <strong>« Snapify – {new URL(status.publicUrl).hostname} »</strong>. Aucune
            carte bancaire n’est demandée : l’API Search Console est gratuite.
          </p>
          <p className="text-slate-500">Vous avez déjà un projet (ou un projet Firebase) ? Vous pouvez le réutiliser : sélectionnez-le en haut de la console.</p>
          <ConsoleLink href={CONSOLE.project}>Créer le projet</ConsoleLink>
        </>
      ),
    },
    {
      id: 'api',
      title: 'Activer l’API Google Search Console',
      time: '30 s',
      body: (
        <>
          <p>
            Vérifiez que votre projet est bien sélectionné en haut de la page, puis cliquez sur <strong>« Activer »</strong>.
          </p>
          <ConsoleLink href={CONSOLE.api}>Ouvrir l’API Search Console</ConsoleLink>
        </>
      ),
    },
    {
      id: 'consent',
      title: 'Configurer l’écran de consentement',
      time: '2 min',
      body: (
        <>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Cliquez sur <strong>« Commencer »</strong>. Nom de l’application : le nom de votre site ; e-mail d’assistance : le vôtre.
            </li>
            <li>
              Audience : choisissez <strong>« Externe »</strong> (ou « Interne » si votre adresse est un compte Google Workspace de votre entreprise : vous pourrez alors ignorer le point 4).
            </li>
            <li>Indiquez votre e-mail de contact, acceptez les conditions et cliquez sur « Créer ».</li>
            <li>
              Ouvrez <strong>Audience</strong> et cliquez sur <strong>« Publier l’application »</strong> (état « En production »).
            </li>
          </ol>
          <Alert tone="warning" icon={Lightbulb} title="Pourquoi publier ?">
            En mode « Test », Google coupe l’accès au bout de 7 jours et il faudrait se reconnecter chaque semaine. Publier ne rend rien public et ne nécessite pas de validation par Google pour votre
            propre usage : lors de la connexion, Google affichera seulement « Google n’a pas validé cette application » ; cliquez alors sur <strong>« Paramètres avancés »</strong> puis{' '}
            <strong>« Accéder à … »</strong>.
          </Alert>
          <div className="flex flex-wrap gap-2">
            <ConsoleLink href={CONSOLE.branding}>Écran de consentement</ConsoleLink>
            <ConsoleLink href={CONSOLE.audience}>Audience (publier)</ConsoleLink>
          </div>
        </>
      ),
    },
    {
      id: 'client',
      title: 'Créer l’ID client OAuth',
      time: '1 min',
      body: (
        <>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Type d’application : <strong>« Application Web »</strong> ; nom : « Snapify ».
            </li>
            <li>
              Dans <strong>« Origines JavaScript autorisées »</strong>, ajoutez :
            </li>
          </ol>
          <CopyRow label="Origine JavaScript autorisée" value={status.javascriptOrigin} />
          <ol start={3} className="list-decimal space-y-1.5 pl-5">
            <li>
              Dans <strong>« URI de redirection autorisés »</strong>, ajoutez exactement :
            </li>
          </ol>
          <CopyRow label="URI de redirection autorisé" value={status.redirectUri} />
          <ol start={4} className="list-decimal space-y-1.5 pl-5">
            <li>
              Cliquez sur « Créer ». Google affiche l’<strong>ID client</strong> et le <strong>code secret</strong> : téléchargez le fichier JSON ou copiez les deux valeurs (le code secret ne sera
              plus affiché en entier ensuite).
            </li>
          </ol>
          {isLocal ? (
            <Alert tone="info">
              Vous êtes sur un poste local : ces adresses conviennent pour tester. Une fois le site en ligne, ajoutez au même ID client l’origine et l’URI de votre domaine (
              <code className="font-mono text-xs">{new URL(status.publicUrl).origin}</code>), puis reconnectez le compte depuis l’administration en ligne.
            </Alert>
          ) : null}
          <ConsoleLink href={CONSOLE.client}>Créer l’ID client</ConsoleLink>
        </>
      ),
    },
    {
      id: 'credentials',
      title: 'Coller les identifiants dans Snapify',
      time: '30 s',
      body: canManage ? (
        <>
          <p>Snapify vérifie les identifiants auprès de Google avant de les enregistrer.</p>
          <CredentialsForm
            status={status}
            onSaved={() => {
              mark('credentials');
              onConfigured();
            }}
          />
        </>
      ) : (
        <Alert tone="warning">Cette étape est réservée aux personnes autorisées à modifier les paramètres avancés. Transmettez l’ID client et le code secret à un administrateur.</Alert>
      ),
    },
  ];

  const completed = STEPS.filter((s) => done.has(s)).length;

  return (
    <Card padded={false}>
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Connecter Google Search Console</h2>
            <p className="mt-0.5 max-w-2xl text-[13px] text-slate-500">
              Comme Site Kit sur WordPress, Snapify affiche vos clics, impressions et positions Google. Il suffit de créer une fois un accès dans la console Google Cloud — comptez 5 minutes.
            </p>
          </div>
          <Badge tone={completed === STEPS.length ? 'success' : 'neutral'}>
            {completed} / {STEPS.length} étapes
          </Badge>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(completed / STEPS.length) * 100}%` }} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          <strong className="font-medium text-slate-600">Firebase ou Google Cloud ?</strong> Inutile de passer par Firebase : tout se fait dans la console Google Cloud (un projet Firebase est de toute
          façon un projet Google Cloud, réutilisable ici).
        </p>
      </div>
      <ol>
        {steps.map((s, i) => {
          const isDone = done.has(s.id);
          const isOpen = open === s.id;
          return (
            <li key={s.id} className="border-b border-slate-100 last:border-0">
              <button type="button" onClick={() => setOpen(isOpen ? ('' as StepId) : s.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50">
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isDone ? 'bg-emerald-500 text-white' : isOpen ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cx('flex-1 text-sm font-medium', isDone ? 'text-slate-500' : 'text-slate-900')}>{s.title}</span>
                <span className="text-xs text-slate-400">{s.time}</span>
                <ChevronDown className={cx('h-4 w-4 text-slate-400 transition', isOpen && 'rotate-180')} />
              </button>
              {isOpen ? (
                <div className="space-y-3 px-5 pb-5 pl-[60px] text-sm text-slate-600">
                  {s.body}
                  {s.id !== 'credentials' ? (
                    <div className="pt-1">
                      <Button size="sm" variant={isDone ? 'ghost' : 'primary'} icon={isDone ? undefined : CheckCircle2} onClick={() => mark(s.id, !isDone)}>
                        {isDone ? 'Marquer comme non fait' : 'C’est fait, étape suivante'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** Identifiants en place : origine, modification, suppression. */
export function CredentialsCard({ status, canManage, onChanged }: { status: GoogleStatus; canManage: boolean; onChanged: () => void }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <KeyRound className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">Identifiants OAuth Google</p>
          <p className="truncate font-mono text-xs text-slate-500">{status.clientId}</p>
          <p className="text-xs text-slate-400">{status.source === 'env' ? 'Définis dans le fichier .env du serveur' : 'Enregistrés dans l’administration (code secret chiffré)'}</p>
        </div>
      </div>
      {canManage ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => setEditing(true)}>
            {status.source === 'env' ? 'Remplacer' : 'Modifier'}
          </Button>
          {status.source === 'settings' ? (
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              className="text-rose-600 hover:bg-rose-50"
              onClick={async () => {
                if (
                  !(await confirm({
                    title: 'Supprimer les identifiants Google ?',
                    message: 'Le compte Google sera déconnecté et les données Search Console ne seront plus affichées.',
                    confirmLabel: 'Supprimer',
                    danger: true,
                  }))
                )
                  return;
                try {
                  await api.google.deleteCredentials();
                  toast.success('Identifiants supprimés');
                  onChanged();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Supprimer
            </Button>
          ) : null}
        </div>
      ) : null}
      <Modal open={editing} onClose={() => setEditing(false)} title="Identifiants OAuth Google" description="Changer d’ID client déconnecte le compte Google : il faudra vous reconnecter.">
        <div className="space-y-4">
          <CopyRow label="URI de redirection à déclarer dans l’ID client" value={status.redirectUri} />
          <CredentialsForm
            status={status}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
          />
        </div>
      </Modal>
    </Card>
  );
}

const PROBLEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: '« Erreur 400 : redirect_uri_mismatch »',
    a: 'L’URI de redirection déclarée dans l’ID client ne correspond pas exactement à celle de Snapify (http/https, port, barre finale). Recopiez-la depuis l’étape 4, enregistrez dans la console, attendez une minute et réessayez.',
  },
  {
    q: '« Accès bloqué : l’application n’a pas terminé la procédure de validation »',
    a: 'L’application est en mode « Test » et votre compte n’est pas déclaré comme utilisateur test. Publiez-la (étape 3, Audience › « Publier l’application ») ou ajoutez votre adresse dans « Utilisateurs test ».',
  },
  {
    q: '« Google n’a pas validé cette application »',
    a: 'C’est normal pour une application que vous utilisez vous-même : cliquez sur « Paramètres avancés » puis « Accéder à … (non sécurisé) ». Aucune validation Google n’est nécessaire.',
  },
  {
    q: 'Il faut se reconnecter chaque semaine',
    a: 'L’application est restée en mode « Test » : Google y limite les autorisations à 7 jours. Publiez-la (étape 3) puis reconnectez le compte une dernière fois.',
  },
  {
    q: '« L’API n’est pas activée »',
    a: (
      <>
        Activez l’API Google Search Console dans le même projet que l’ID client (étape 2), puis patientez une à deux minutes.{' '}
        <a href={CONSOLE.api} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
          Ouvrir l’API
        </a>
      </>
    ),
  },
  {
    q: 'Aucune propriété dans la liste',
    a: 'Le compte Google connecté n’a pas accès au site dans Search Console. Ajoutez le site dans Search Console avec ce compte (ou demandez au propriétaire de vous y ajouter), puis rechargez la page.',
  },
  {
    q: 'J’ai perdu le code secret',
    a: (
      <>
        Dans la liste des{' '}
        <a href={CONSOLE.clients} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
          ID clients
        </a>
        , ouvrez le client « Snapify » et ajoutez un nouveau code secret, puis enregistrez-le ici avec « Modifier ».
      </>
    ),
  },
];

export function GoogleTroubleshooting() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Card padded={false}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-slate-900">Problèmes fréquents</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {PROBLEMS.map((p, i) => (
          <li key={p.q}>
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm text-slate-800 transition hover:bg-slate-50">
              <span className="flex-1">{p.q}</span>
              <ChevronDown className={cx('h-4 w-4 shrink-0 text-slate-400 transition', open === i && 'rotate-180')} />
            </button>
            {open === i ? <p className="px-5 pb-4 text-[13px] leading-relaxed text-slate-600">{p.a}</p> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Aide quand le compte connecté ne voit aucune propriété Search Console. */
export function NoPropertyHelp({ status, onOpenSettings }: { status: GoogleStatus; onOpenSettings: () => void }) {
  return (
    <Alert tone="info" title="Ajoutez votre site dans Search Console">
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>
          Ouvrez{' '}
          <a href={CONSOLE.searchConsole} target="_blank" rel="noreferrer" className="font-medium underline">
            Google Search Console
          </a>{' '}
          avec le compte {status.accountEmail ? <strong>{status.accountEmail}</strong> : 'connecté'} et choisissez « Préfixe de l’URL » : <code className="font-mono text-xs">{status.publicUrl}</code>.
        </li>
        <li>
          Méthode « Balise HTML » : copiez le code proposé et collez-le dans{' '}
          <button type="button" onClick={onOpenSettings} className="font-medium underline">
            Réglages globaux › Google Search Console
          </button>
          {status.verificationTag ? ' (déjà renseigné)' : ''}, enregistrez, puis cliquez sur « Valider » dans Search Console.
        </li>
        <li>Revenez ici et rechargez la page : la propriété apparaîtra dans la liste.</li>
      </ol>
    </Alert>
  );
}
