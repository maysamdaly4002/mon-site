/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React from 'react';
import { useSnapify } from '@snapify/sdk/theme';
import { cx } from './kit';

/** Logo du site, ou à défaut monogramme en arche suivi du nom et de la signature. */
export function Brand({ dark, onClick }: { dark?: boolean; onClick: () => void }) {
  const { site, info } = useSnapify();
  const logo = dark ? site.branding.logoDarkUrl || '' : site.branding.logoUrl;
  const name = (site.branding.siteName || info.name).replace(/®$/, '');
  return (
    <button type="button" onClick={onClick} className="group flex shrink-0 items-center gap-3 text-left" aria-label={`${name} — accueil`}>
      {logo ? (
        <img src={logo} alt={name} className="h-10 w-auto max-w-[190px] object-contain" />
      ) : (
        <>
          <span
            className={cx(
              'dg-display flex h-11 w-9 items-end justify-center rounded-t-full pb-1.5 text-[1.45rem] leading-none transition-colors',
              dark ? 'bg-[#f5f0e8] text-(--dg-ink)' : 'bg-(--dg-ink) text-(--dg-paper) group-hover:bg-(--dg-accent)'
            )}
            aria-hidden="true"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="flex flex-col">
            <span className={cx('dg-display text-[1.6rem] leading-none', dark ? 'text-[#f5f0e8]' : 'text-(--dg-ink)')}>{name}</span>
            {site.branding.tagline ? (
              <span className={cx('mt-1 text-[10px] font-semibold uppercase tracking-[0.2em]', dark ? 'text-[#f5f0e8]/55' : 'text-(--dg-muted)')}>{site.branding.tagline}</span>
            ) : null}
          </span>
        </>
      )}
    </button>
  );
}
