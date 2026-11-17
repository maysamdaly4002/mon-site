/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { isEmail, isPhone, wishlist } from '@snapify/sdk/commerce';
import { AVATAR_ACCEPT, prepareAvatar } from '@snapify/sdk/image';
import { Button, FormField, Notice, Spinner, TextInput } from '@snapify/sdk/ui/commerce';
import { PasswordInput } from './AuthPages';
import { CustomerAvatar } from './Avatar';
import { api, applyMe } from './session';
import type { Me } from '../types';

const MIN_PASSWORD = 8;

function Card({ title, text, children, danger }: { title: string; text?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={danger ? 'rounded-2xl border border-rose-200 bg-rose-50/40 p-6 sm:p-8' : 'rounded-2xl border border-px-border-soft bg-white p-6 sm:p-8'}>
      <h2 className="font-heading text-lg font-semibold text-px-navy">{title}</h2>
      {text ? <p className="mt-1 text-sm text-px-muted">{text}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function InfoForm({ me }: { me: Me }) {
  const [f, setF] = useState({ firstName: me.firstName, lastName: me.lastName, phone: me.phone, email: me.email, password: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const emailChanged = f.email.trim().toLowerCase() !== me.email;
  const dirty = emailChanged || f.firstName !== me.firstName || f.lastName !== me.lastName || f.phone !== me.phone;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.firstName.trim() || !f.lastName.trim()) return setMsg({ tone: 'danger', text: 'Indiquez votre prénom et votre nom.' });
    if (!isEmail(f.email.trim())) return setMsg({ tone: 'danger', text: 'Adresse e-mail invalide.' });
    if (f.phone.trim() && !isPhone(f.phone)) return setMsg({ tone: 'danger', text: 'Numéro de téléphone invalide.' });
    if (emailChanged && !f.password) return setMsg({ tone: 'danger', text: 'Saisissez votre mot de passe actuel pour changer d’adresse e-mail.' });
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post<{ customer: Me }>('/profile', { ...f, email: f.email.trim() });
      applyMe(r.customer);
      setF((x) => ({ ...x, email: r.customer.email, password: '' }));
      setMsg({ tone: 'success', text: 'Vos informations ont été mises à jour.' });
    } catch (err) {
      setMsg({ tone: 'danger', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      {msg ? (
        <Notice tone={msg.tone} className="sm:col-span-2">
          {msg.text}
        </Notice>
      ) : null}
      <FormField label="Prénom" required>
        <TextInput autoComplete="given-name" value={f.firstName} maxLength={60} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
      </FormField>
      <FormField label="Nom" required>
        <TextInput autoComplete="family-name" value={f.lastName} maxLength={60} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
      </FormField>
      <FormField label="Adresse e-mail" required>
        <TextInput type="email" autoComplete="email" value={f.email} maxLength={254} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </FormField>
      <FormField label="Téléphone">
        <TextInput type="tel" autoComplete="tel" value={f.phone} maxLength={24} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </FormField>
      {emailChanged ? (
        <FormField label="Mot de passe actuel" hint="Demandé pour confirmer le changement d’adresse e-mail." required className="sm:col-span-2">
          <PasswordInput autoComplete="current-password" value={f.password} onChange={(v) => setF({ ...f, password: v })} />
        </FormField>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" loading={busy} disabled={!dirty}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.current) return setMsg({ tone: 'danger', text: 'Saisissez votre mot de passe actuel.' });
    if (f.next.length < MIN_PASSWORD) return setMsg({ tone: 'danger', text: `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.` });
    if (f.next !== f.confirm) return setMsg({ tone: 'danger', text: 'Les deux mots de passe ne correspondent pas.' });
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/password', { current: f.current, next: f.next });
      setF({ current: '', next: '', confirm: '' });
      setMsg({ tone: 'success', text: 'Mot de passe modifié. Vos autres appareils ont été déconnectés.' });
    } catch (err) {
      setMsg({ tone: 'danger', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      {msg ? (
        <Notice tone={msg.tone} className="sm:col-span-2">
          {msg.text}
        </Notice>
      ) : null}
      <FormField label="Mot de passe actuel" required className="sm:col-span-2">
        <PasswordInput autoComplete="current-password" value={f.current} onChange={(v) => setF({ ...f, current: v })} />
      </FormField>
      <FormField label="Nouveau mot de passe" hint={`${MIN_PASSWORD} caractères minimum.`} required>
        <PasswordInput autoComplete="new-password" value={f.next} onChange={(v) => setF({ ...f, next: v })} />
      </FormField>
      <FormField label="Confirmation" required>
        <PasswordInput autoComplete="new-password" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} />
      </FormField>
      <div className="sm:col-span-2">
        <Button type="submit" variant="dark" loading={busy}>
          Changer le mot de passe
        </Button>
      </div>
    </form>
  );
}

function DeleteAccount({ navigate }: { navigate: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/delete-account', { password });
      applyMe(null);
      wishlist.set([]);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => setOpen(true)}>
        Supprimer mon compte
      </Button>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <FormField label="Confirmez avec votre mot de passe" required>
        <PasswordInput autoComplete="current-password" value={password} onChange={setPassword} />
      </FormField>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="danger" loading={busy} disabled={!password}>
          Supprimer définitivement
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** Photo de profil : recadrée en carré et allégée dans le navigateur avant l'envoi. */
function AvatarForm({ me }: { me: Me }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy('upload');
    setMsg(null);
    try {
      const image = await prepareAvatar(file);
      setPreview(image.preview);
      const r = await api.post<{ customer: Me }>('/avatar', { dataBase64: image.dataBase64, mimeType: image.mimeType });
      applyMe(r.customer);
      setMsg({ tone: 'success', text: 'Votre photo de profil a été mise à jour.' });
    } catch (err) {
      setMsg({ tone: 'danger', text: (err as Error).message });
    } finally {
      setPreview(null);
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy('remove');
    setMsg(null);
    try {
      const r = await api.post<{ customer: Me }>('/avatar/delete');
      applyMe(r.customer);
      setMsg({ tone: 'success', text: 'Votre photo a été supprimée.' });
    } catch (err) {
      setMsg({ tone: 'danger', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files[0]);
          }}
          disabled={!!busy}
          aria-label="Changer la photo de profil"
          className={`group relative w-fit shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-px-primary ${dragging ? 'ring-2 ring-px-primary' : ''}`}
        >
          <CustomerAvatar person={{ ...me, avatarUrl: preview ?? me.avatarUrl }} className="h-24 w-24 text-2xl" />
          <span className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition ${busy === 'upload' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {busy === 'upload' ? <Spinner className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
          </span>
          <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-px-primary text-white shadow">
            <Camera className="h-3.5 w-3.5" />
          </span>
        </button>
        <input ref={input} type="file" accept={AVATAR_ACCEPT} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        <div>
          <p className="text-sm text-px-text">Cliquez sur la photo ou déposez une image. JPG, PNG ou WebP ; elle est recadrée en carré automatiquement.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={!!busy}>
              <ImagePlus className="h-4 w-4" /> {me.avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
            </Button>
            {me.avatarUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={remove} loading={busy === 'remove'} disabled={!!busy}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileSection({ me, navigate, avatars = true }: { me: Me; navigate: (p: string) => void; avatars?: boolean }) {
  return (
    <div className="space-y-6">
      {avatars ? (
        <Card title="Photo de profil">
          <AvatarForm me={me} />
        </Card>
      ) : null}
      <Card title="Informations personnelles">
        <InfoForm me={me} />
      </Card>
      <Card title="Mot de passe" text="Changer de mot de passe déconnecte vos autres appareils.">
        <PasswordForm />
      </Card>
      <Card title="Supprimer mon compte" text="Votre compte, vos adresses et vos favoris sont effacés. Les commandes déjà passées restent enregistrées par la boutique pour sa comptabilité." danger>
        <DeleteAccount navigate={navigate} />
      </Card>
    </div>
  );
}
