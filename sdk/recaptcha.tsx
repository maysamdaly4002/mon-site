/**
 * Snapify — champ reCAPTCHA pour les formulaires publics (module hamdiayari.recaptcha)
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { useEffect, useRef, useState } from 'react';

export type RecaptchaPublicConfig = {
  siteKey: string;
  version: 'v2' | 'v3';
  action?: string;
};

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      getResponse: (id?: number) => string;
      reset: (id?: number) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
    __snapifyRecaptcha?: {
      siteKey: string;
      version: 'v2' | 'v3';
      action: string;
      getToken: () => Promise<string>;
    };
  }
}

const SCRIPT_ID = 'snapify-recaptcha-script';

function ensureScript(siteKey: string, version: 'v2' | 'v3') {
  if (document.getElementById(SCRIPT_ID)) return;
  const s = document.createElement('script');
  s.id = SCRIPT_ID;
  s.async = true;
  s.defer = true;
  s.src =
    version === 'v3'
      ? `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
      : 'https://www.google.com/recaptcha/api.js?render=explicit';
  document.head.appendChild(s);
}

/** Récupère un jeton (v2 widget ou v3 execute). */
export async function getRecaptchaToken(cfg?: RecaptchaPublicConfig | null): Promise<string> {
  if (window.__snapifyRecaptcha?.getToken) return window.__snapifyRecaptcha.getToken();
  if (!cfg?.siteKey) return '';
  const version = cfg.version === 'v3' ? 'v3' : 'v2';
  ensureScript(cfg.siteKey, version);
  await new Promise<void>((resolve, reject) => {
    let n = 0;
    const tick = () => {
      if (window.grecaptcha) return resolve();
      if (n++ > 50) return reject(new Error('reCAPTCHA indisponible'));
      setTimeout(tick, 100);
    };
    tick();
  });
  return new Promise((resolve, reject) => {
    window.grecaptcha!.ready(() => {
      if (version === 'v3') {
        window
          .grecaptcha!.execute(cfg.siteKey, { action: cfg.action || 'contact' })
          .then(resolve)
          .catch(() => reject(new Error('reCAPTCHA v3 impossible')));
      } else {
        const token = window.grecaptcha!.getResponse();
        if (!token) reject(new Error('Cochez la case « Je ne suis pas un robot ».'));
        else resolve(token);
      }
    });
  });
}

/** Widget v2 (case à cocher). Invisible pour v3. */
export function RecaptchaField({ config }: { config?: RecaptchaPublicConfig | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!config?.siteKey || config.version === 'v3') return;
    ensureScript(config.siteKey, 'v2');
    let cancelled = false;
    const tryRender = (n = 0) => {
      if (cancelled || !ref.current) return;
      if (!window.grecaptcha) {
        if (n < 50) setTimeout(() => tryRender(n + 1), 100);
        else setErr('Impossible de charger reCAPTCHA.');
        return;
      }
      window.grecaptcha.ready(() => {
        if (cancelled || !ref.current || widgetId.current !== null) return;
        try {
          widgetId.current = window.grecaptcha!.render(ref.current, {
            sitekey: config.siteKey,
            theme: 'light',
          });
        } catch {
          setErr('Widget reCAPTCHA indisponible.');
        }
      });
    };
    tryRender();
    return () => {
      cancelled = true;
    };
  }, [config?.siteKey, config?.version]);

  if (!config?.siteKey) return null;
  if (config.version === 'v3') {
    return <p className="text-[11px] text-slate-400">Protection anti-robot Google reCAPTCHA activée.</p>;
  }
  return (
    <div className="space-y-1">
      <div ref={ref} className="g-recaptcha" />
      {err ? <p className="text-xs text-rose-600">{err}</p> : null}
    </div>
  );
}
