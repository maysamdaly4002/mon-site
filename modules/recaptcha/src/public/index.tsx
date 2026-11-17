/**
 * Snapify — module Google reCAPTCHA
 * © 2026 Hamdi Ayari — hamdi.ayari@novalabs.tn
 */
import { useEffect } from 'react';
import { definePublicModule, type PublicModuleProps } from '@snapify/sdk';
import type { Settings } from '../types';

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

function loadScript(siteKey: string, version: 'v2' | 'v3') {
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

function RecaptchaBoot({ settings, isPreview }: PublicModuleProps<Settings>) {
  useEffect(() => {
    if (isPreview) return;
    if (!settings.enabled || !settings.siteKey?.trim()) {
      delete window.__snapifyRecaptcha;
      return;
    }
    const siteKey = settings.siteKey.trim();
    const version = settings.version === 'v3' ? 'v3' : 'v2';
    const action = (settings.v3Action || 'contact').slice(0, 40);
    loadScript(siteKey, version);

    window.__snapifyRecaptcha = {
      siteKey,
      version,
      action,
      getToken: () =>
        new Promise((resolve, reject) => {
          const wait = (n = 0) => {
            if (!window.grecaptcha) {
              if (n > 40) return reject(new Error('reCAPTCHA indisponible'));
              return setTimeout(() => wait(n + 1), 100);
            }
            window.grecaptcha!.ready(() => {
              if (version === 'v3') {
                window
                  .grecaptcha!.execute(siteKey, { action })
                  .then(resolve)
                  .catch(() => reject(new Error('reCAPTCHA v3 impossible')));
              } else {
                const token = window.grecaptcha!.getResponse();
                if (!token) reject(new Error('Cochez la case « Je ne suis pas un robot ».'));
                else resolve(token);
              }
            });
          };
          wait();
        }),
    };

    return () => {
      delete window.__snapifyRecaptcha;
    };
  }, [settings.enabled, settings.siteKey, settings.version, settings.v3Action, isPreview]);

  return null;
}

export default definePublicModule<Settings>({
  slots: {
    floating: RecaptchaBoot,
  },
});
