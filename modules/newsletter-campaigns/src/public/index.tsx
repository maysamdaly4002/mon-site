import { useEffect, useState } from 'react';
import { definePublicModule, type PublicPageProps, type WidgetProps } from '@snapify/sdk';
import type { Settings } from '../types';

type State = 'idle' | 'loading' | 'done' | 'error';

function SignupWidget({ options, api }: WidgetProps<Settings, { title?: string; buttonLabel?: string }>) {
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  const submit = async () => {
    setState('loading');
    try {
      await api.post('/subscribe', { email, website: trap });
      setState('done');
      setMessage('Presque terminé : ouvrez l’e-mail que nous venons de vous envoyer et confirmez votre inscription.');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Une erreur est survenue.');
    }
  };

  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <h2 className="text-xl font-bold text-px-navy">{options.title || 'Restez informé'}</h2>
      {state === 'done' ? (
        <p className="mt-3 text-slate-600">{message}</p>
      ) : (
        <div className="mt-4 flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" aria-label="Adresse e-mail" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2" />
          <input type="text" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          <button type="button" disabled={state === 'loading'} onClick={() => void submit()} className="rounded-xl bg-px-primary px-4 py-2 font-semibold text-white disabled:opacity-60">
            {options.buttonLabel || 'Je m’inscris'}
          </button>
        </div>
      )}
      {state === 'error' ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
    </section>
  );
}

/** Pages /newsletter/confirmer/?token=… et /newsletter/desinscription/?token=… */
function NewsletterPage({ api, path, search, setMeta }: PublicPageProps<Settings>) {
  const isConfirm = path.includes('/confirmer');
  const token = new URLSearchParams(search).get('token') || '';
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMeta({ title: isConfirm ? 'Confirmation d’inscription' : 'Désinscription' });
  }, [isConfirm, setMeta]);

  useEffect(() => {
    if (!isConfirm || !token) return;
    setState('loading');
    api.post('/confirm', { token }).then(() => setState('done')).catch((e) => { setState('error'); setMessage(e instanceof Error ? e.message : 'Lien invalide.'); });
  }, [api, isConfirm, token]);

  const unsubscribe = async () => {
    setState('loading');
    try { await api.post('/unsubscribe', { token }); setState('done'); }
    catch (e) { setState('error'); setMessage(e instanceof Error ? e.message : 'Lien invalide.'); }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold text-px-navy">{isConfirm ? 'Confirmation d’inscription' : 'Désinscription'}</h1>
      {!token ? <p className="mt-4 text-slate-600">Lien incomplet.</p> : null}
      {isConfirm && state === 'done' ? <p className="mt-4 text-slate-600">Merci, votre inscription est confirmée.</p> : null}
      {!isConfirm && token && state !== 'done' ? (
        <div className="mt-4">
          <p className="text-slate-600">Voulez-vous vraiment ne plus recevoir la newsletter ?</p>
          <button type="button" disabled={state === 'loading'} onClick={() => void unsubscribe()} className="mt-4 rounded-xl bg-px-primary px-4 py-2 font-semibold text-white disabled:opacity-60">Me désinscrire</button>
        </div>
      ) : null}
      {!isConfirm && state === 'done' ? <p className="mt-4 text-slate-600">Vous êtes désinscrit. Vous ne recevrez plus nos e-mails.</p> : null}
      {state === 'error' ? <p className="mt-4 text-red-600">{message}</p> : null}
    </div>
  );
}

export default definePublicModule<Settings>({ page: NewsletterPage, widgets: { signup: SignupWidget } });
