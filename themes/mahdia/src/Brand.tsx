/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React from 'react';
import { useSnapify } from '@snapify/sdk/theme';
import { cx } from './kit';

/** Logo du site, ou à défaut monogramme en vague suivi du nom. */
export function Brand({ dark, onClick, compact }: { dark?: boolean; onClick: () => void; compact?: boolean }) {
  const { site, info } = useSnapify();
  const logo = dark ? site.branding.logoDarkUrl || '' : site.branding.logoUrl;
  const name = (site.branding.siteName || info.name).replace(/®$/, '');
  return (
    <button type="button" onClick={onClick} className="group flex shrink-0 items-center gap-2.5 text-left" aria-label={`${name} — accueil`}>
      {logo ? (
        <img src={logo} alt={name} className="h-9 w-auto max-w-[170px] object-contain sm:h-10" />
      ) : (
        <>
          <span
            className={cx(
              'mh-display flex h-10 w-10 items-center justify-center rounded-[18px_6px_18px_6px] text-lg transition-colors',
              dark ? 'bg-(--mh-on-dark) text-(--mh-ink)' : 'bg-(--mh-ink) text-(--mh-on-dark) group-hover:bg-(--mh-accent)'
            )}
            aria-hidden="true"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <span className={cx('flex-col', compact ? 'hidden sm:flex' : 'flex')}>
            <span className={cx('mh-display text-[1.35rem] leading-none', dark ? 'text-(--mh-on-dark)' : 'text-(--mh-ink)')}>{name}</span>
            {site.branding.tagline ? <span className={cx('mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] md:block', dark ? 'text-(--mh-on-dark)/55' : 'text-(--mh-muted)')}>{site.branding.tagline}</span> : null}
          </span>
        </>
      )}
    </button>
  );
}
