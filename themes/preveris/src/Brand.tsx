/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React from 'react';
import { useSnapify } from '@snapify/sdk/theme';
import { cx } from './kit';

/** Logo du site, ou à défaut badge moderne suivi du nom et de la signature. */
export function Brand({ dark, onClick }: { dark?: boolean; onClick: () => void }) {
  const { site, info } = useSnapify();
  const logo = dark ? site.branding.logoDarkUrl || site.branding.logoUrl || '' : site.branding.logoUrl || '';
  const name = (site.branding.siteName || info.name).replace(/®$/, '');
  return (
    <button type="button" onClick={onClick} className="group flex shrink-0 items-center gap-3 text-left" aria-label={`${name} — accueil`}>
      {logo ? (
        <img src={logo} alt={name} className="h-10 w-auto max-w-[190px] object-contain" />
      ) : (
        <>
          <span
            className={cx(
              'pv-display relative flex h-10 w-10 items-center justify-center rounded-xl text-[1.15rem] font-extrabold leading-none shadow-sm transition-all duration-300 group-hover:-translate-y-0.5',
              dark
                ? 'bg-gradient-to-br from-(--pv-accent) to-(--pv-accent-hot) text-white'
                : 'bg-(--pv-ink) text-white group-hover:bg-(--pv-accent)'
            )}
            aria-hidden="true"
          >
            {name.charAt(0).toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-(--pv-paper) bg-(--pv-accent)" />
          </span>
          <span className="flex flex-col">
            <span className={cx('pv-display text-[1.35rem] font-bold tracking-tight leading-none', dark ? 'text-[#f7f5f2]' : 'text-(--pv-ink)')}>{name}</span>
            {site.branding.tagline ? (
              <span className={cx('mt-1 text-[10px] font-semibold uppercase tracking-[0.16em]', dark ? 'text-[#f7f5f2]/60' : 'text-(--pv-muted)')}>{site.branding.tagline}</span>
            ) : null}
          </span>
        </>
      )}
    </button>
  );
}
