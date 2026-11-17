/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';

interface MaintenanceNotice {
  title: string;
  message: string;
  logo?: string;
  siteName?: string;
}

/** État annoncé par le serveur dans le HTML (voir `injectMaintenance`). */
function initialNotice(): MaintenanceNotice | null {
  try {
    const raw = document.getElementById('snapify-maintenance')?.textContent;
    return raw ? (JSON.parse(raw) as MaintenanceNotice) : null;
  } catch {
    return null;
  }
}

/**
 * Le serveur tranche au chargement ; l'état est revérifié à chaque navigation et au retour
 * sur l'onglet, pour qu'un visiteur déjà sur le site bascule dès l'activation.
 */
export function MaintenanceGate({ path, children }: { path: string; children: React.ReactNode }) {
  const [notice, setNotice] = useState<MaintenanceNotice | null>(initialNotice);

  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch('/api/public/maintenance-status', { cache: 'no-store', credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((s: ({ enabled: boolean } & MaintenanceNotice) | null) => {
          if (alive && s) setNotice(s.enabled ? s : null);
        })
        .catch(() => undefined);
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [path]);

  if (!notice) return <>{children}</>;
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-px-navy px-6 text-center text-white">
      <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-px-primary/15 blur-3xl" />
      <div className="relative max-w-xl">
        {notice.logo ? <img src={notice.logo} alt={notice.siteName || ''} className="mx-auto mb-10 h-10 object-contain" /> : null}
        <span className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
          <Wrench className="h-6 w-6 text-px-primary" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{notice.title || 'Site en maintenance'}</h1>
        {notice.message ? <p className="mt-4 text-lg leading-relaxed text-slate-300">{notice.message}</p> : null}
      </div>
    </div>
  );
}
