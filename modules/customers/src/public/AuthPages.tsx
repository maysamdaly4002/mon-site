/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Heart, MailCheck, Package, ShieldCheck, UserRound } from 'lucide-react';
import type { PublicPageProps } from '@snapify/sdk';
import { COMMERCE_PATHS, isEmail, isPhone, wishlist } from '@snapify/sdk/commerce';
import { Button, Checkbox, Container, FormField, Link, Notice, TextInput } from '@snapify/sdk/ui/commerce';
import { api, applyMe } from './session';
import type { Me, Settings } from '../types';

const MIN_PASSWORD = 8;

/** Retour après connexion : uniquement une adresse interne au site. */
export function safeNext(search: string): string {
  const next = new URLSearchParams(search).get('suite') || '';
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : COMMERCE_PATHS.account;
}

const withNext = (path: string, search: string) => {
  const next = new URLSearchParams(search).get('suite');
  return next ? `${path}?suite=${encodeURIComponent(next)}` : path;
};

function AuthCard({ title, subtitle, children, aside }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Container className="py-12 sm:py-20">
      <div className={aside ? 'mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_380px] lg:items-start' : 'mx-auto max-w-md'}>
        <div className="rounded-3xl border border-px-border-soft bg-white p-6 shadow-sm sm:p-10">
          <h1 className="font-heading text-2xl font-semibold text-px-navy sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-px-muted">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
        {aside}
      </div>
    </Container>
  );
}

export function PasswordInput({ value, onChange, autoComplete, invalid }: { value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} invalid={invalid} maxLength={200} onChange={(e) => onChange(e.target.value)} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-px-muted hover:text-px-navy">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Benefits() {
  const items = [
    { icon: Package, title: 'Suivi de vos commandes', text: 'Lorem ipsum dolor sit amet, retrouvez chaque commande et son statut.' },
    { icon: UserRound, title: 'Commande express', text: 'Vos adresses enregistrées, sans tout ressaisir à chaque achat.' },
    { icon: Heart, title: 'Favoris synchronisés', text: 'Consectetur adipiscing elit : vos coups de cœur sur tous vos appareils.' },
  ];
  return (
    <aside className="space-y-6 rounded-3xl bg-px-surface p-8">
      <p className="font-heading text-lg font-semibold text-px-navy">Pourquoi créer un compte ?</p>
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-px-primary shadow-sm">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-px-navy">{title}</p>
            <p className="mt-0.5 text-sm text-px-text">{text}</p>
          </div>
        </div>
      ))}
    </aside>
  );
}

export function LoginPage({ navigate, search, settings, setMeta }: PublicPageProps<Settings>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setMeta({ title: 'Connexion' }), [setMeta]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email.trim()) || !password) return setError('Saisissez votre adresse e-mail et votre mot de passe.');
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ customer: Me }>('/login', { email: email.trim(), password, remember, wishlist: wishlist.ids() });
      applyMe(r.customer);
      navigate(safeNext(search));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Connexion"
      subtitle="Accédez à vos commandes, adresses et favoris."
      aside={settings.allowRegistration ? (
        <div className="space-y-4">
          <Benefits />
          <Button variant="outline" block size="lg" onClick={() => navigate(withNext(COMMERCE_PATHS.register, search))}>
            Créer un compte
          </Button>
        </div>
      ) : undefined}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <FormField label="Adresse e-mail" required>
          <TextInput type="email" autoComplete="email" autoFocus value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Mot de passe" required>
          <PasswordInput autoComplete="current-password" value={password} onChange={setPassword} />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox checked={remember} onChange={setRemember}>
            Rester connecté
          </Checkbox>
          <Link to="/compte/mot-de-passe-oublie/" navigate={navigate} className="text-sm font-medium text-px-primary hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" size="lg" block loading={busy}>
          Se connecter
        </Button>
      </form>
    </AuthCard>
  );
}

export function RegisterPage({ navigate, search, settings, setMeta }: PublicPageProps<Settings>) {
  const params = new URLSearchParams(search);
  const [f, setF] = useState({ firstName: '', lastName: '', email: params.get('email') || '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setMeta({ title: 'Créer un compte' }), [setMeta]);

  if (!settings.allowRegistration) {
    return (
      <AuthCard title="Créer un compte">
        <Notice tone="info">Les inscriptions sont fermées pour le moment. Vous pouvez toujours commander sans compte.</Notice>
        <Button className="mt-6" variant="outline" onClick={() => navigate(withNext(COMMERCE_PATHS.login, search))}>
          J’ai déjà un compte
        </Button>
      </AuthCard>
    );
  }

  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.firstName.trim()) errs.firstName = 'Indiquez votre prénom.';
    if (!f.lastName.trim()) errs.lastName = 'Indiquez votre nom.';
    if (!isEmail(f.email.trim())) errs.email = 'Adresse e-mail invalide.';
    if ((settings.requirePhone || f.phone.trim()) && !isPhone(f.phone)) errs.phone = 'Numéro de téléphone invalide.';
    if (f.password.length < MIN_PASSWORD) errs.password = `Au moins ${MIN_PASSWORD} caractères.`;
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ customer: Me }>('/register', { ...f, email: f.email.trim(), wishlist: wishlist.ids() });
      applyMe(r.customer);
      navigate(safeNext(search));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Créer un compte"
      subtitle={
        <>
          Déjà inscrit ?{' '}
          <Link to={withNext(COMMERCE_PATHS.login, search)} navigate={navigate} className="font-medium text-px-primary hover:underline">
            Connectez-vous
          </Link>
        </>
      }
      aside={<Benefits />}
    >
      <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
        {error ? (
          <Notice tone="danger" className="sm:col-span-2">
            {error}
          </Notice>
        ) : null}
        <FormField label="Prénom" error={errors.firstName} required>
          <TextInput autoComplete="given-name" autoFocus value={f.firstName} maxLength={60} invalid={!!errors.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </FormField>
        <FormField label="Nom" error={errors.lastName} required>
          <TextInput autoComplete="family-name" value={f.lastName} maxLength={60} invalid={!!errors.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </FormField>
        <FormField label="Adresse e-mail" error={errors.email} required className="sm:col-span-2">
          <TextInput type="email" autoComplete="email" value={f.email} maxLength={254} invalid={!!errors.email} onChange={(e) => set('email', e.target.value)} />
        </FormField>
        <FormField label="Téléphone" error={errors.phone} required={settings.requirePhone} className="sm:col-span-2">
          <TextInput type="tel" autoComplete="tel" placeholder="+216 20 000 000" value={f.phone} maxLength={24} invalid={!!errors.phone} onChange={(e) => set('phone', e.target.value)} />
        </FormField>
        <FormField label="Mot de passe" error={errors.password} hint={errors.password ? undefined : `${MIN_PASSWORD} caractères minimum.`} required className="sm:col-span-2">
          <PasswordInput autoComplete="new-password" value={f.password} invalid={!!errors.password} onChange={(v) => set('password', v)} />
        </FormField>
        <div className="sm:col-span-2">
          <Button type="submit" size="lg" block loading={busy}>
            Créer mon compte
          </Button>
          {settings.privacyPath ? (
            <p className="mt-4 text-center text-xs text-px-muted">
              En créant un compte, vous acceptez notre{' '}
              <Link to={settings.privacyPath} navigate={navigate} className="underline hover:text-px-navy">
                politique de confidentialité
              </Link>
              .
            </p>
          ) : null}
        </div>
      </form>
    </AuthCard>
  );
}

export function ForgotPage({ navigate, setMeta }: PublicPageProps<Settings>) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setMeta({ title: 'Mot de passe oublié' }), [setMeta]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email.trim())) return setError('Adresse e-mail invalide.');
    setBusy(true);
    setError('');
    try {
      await api.post('/password/forgot', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Vérifiez votre boîte mail">
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-px-primary/10 text-px-primary">
            <MailCheck className="h-6 w-6" />
          </span>
          <p className="text-sm leading-relaxed text-px-text">
            Si un compte existe pour <strong className="text-px-navy">{email.trim()}</strong>, vous allez recevoir un lien pour choisir un nouveau mot de passe. Il est valable une heure. Pensez à regarder dans les courriers indésirables.
          </p>
        </div>
        <Button className="mt-8" variant="outline" block onClick={() => navigate(COMMERCE_PATHS.login)}>
          Retour à la connexion
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Mot de passe oublié" subtitle="Indiquez l’adresse e-mail de votre compte : nous vous envoyons un lien de réinitialisation.">
      <form onSubmit={submit} noValidate className="space-y-5">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <FormField label="Adresse e-mail" required>
          <TextInput type="email" autoComplete="email" autoFocus value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <Button type="submit" size="lg" block loading={busy}>
          Envoyer le lien
        </Button>
        <p className="text-center text-sm">
          <Link to={COMMERCE_PATHS.login} navigate={navigate} className="font-medium text-px-primary hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}

export function ResetPage({ navigate, search, setMeta }: PublicPageProps<Settings>) {
  const token = new URLSearchParams(search).get('t') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setMeta({ title: 'Nouveau mot de passe' }), [setMeta]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ customer: Me }>('/password/reset', { token, password });
      applyMe(r.customer);
      navigate(COMMERCE_PATHS.account);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Lien incomplet">
        <Notice tone="warning">Ce lien de réinitialisation est incomplet. Ouvrez le lien reçu par e-mail ou demandez-en un nouveau.</Notice>
        <Button className="mt-6" onClick={() => navigate('/compte/mot-de-passe-oublie/')}>
          Demander un nouveau lien
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nouveau mot de passe" subtitle="Choisissez un mot de passe que vous n’utilisez pas ailleurs.">
      <form onSubmit={submit} noValidate className="space-y-5">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <FormField label="Nouveau mot de passe" hint={`${MIN_PASSWORD} caractères minimum.`} required>
          <PasswordInput autoComplete="new-password" value={password} onChange={setPassword} />
        </FormField>
        <FormField label="Confirmation" required>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={setConfirm} />
        </FormField>
        <Button type="submit" size="lg" block loading={busy}>
          <ShieldCheck className="h-4 w-4" /> Enregistrer et me connecter
        </Button>
      </form>
    </AuthCard>
  );
}
